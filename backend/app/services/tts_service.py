import os
import sys
import numpy as np
import soundfile as sf
import tempfile
import librosa
import json
import time
import torch
from pathlib import Path
from typing import List, Dict, Optional, Union
from scipy.signal import butter, filtfilt

# Add project paths
current_file = os.path.abspath(__file__)
project_root = os.path.abspath(os.path.join(current_file, "../../../.."))
sys.path.append(project_root)
sys.path.append(os.path.join(project_root, "backend"))

from app.utils.logger import setup_logger, logger as logging
from app.model_manager.faster_whispher import model_manager

# Coqui TTS imports

from TTS.api import TTS


setup_logger()

class CoquiTTSService:
    
    def __init__(self, 
                 model_name: str = "tts_models/multilingual/multi-dataset/xtts_v2",
                 device: str = "auto"):
        self.model_name = model_name
        self.device = "cuda" if torch.cuda.is_available() and device != "cpu" else "cpu"
        
        self.tts = None
        self.whisper_model = None
        self._load_models()
        
        self.speaker_cache = {}
        
        logging.info(f"CoquiTTSService initialized with {model_name} on {self.device}")
    
    def _load_models(self):
        try:
            # Load TTS model
            logging.info(f"Loading TTS model: {self.model_name}")
            self.tts = TTS(self.model_name).to(self.device)
            
            # Load Whisper model for transcription
            if model_manager.is_loaded():
                self.whisper_model = model_manager.get_model()
                logging.info("Using existing Whisper model from model manager")            
            else:
                self.whisper_model = model_manager.load_model(
                    model_size="medium",  # Reduced from medium to small to save memory
                    device=self.device,
                    compute_type="float16" if self.device == "cuda" else "float32"
                )
            
            logging.info("All models loaded successfully")
            
        except Exception as e:
            logging.error(f"Failed to load models: {e}")
            raise
    def extract_speaker_embedding(self, audio_path: Union[str, Path], 
                                min_duration: float = 5.0,  # Increased from 3.0
                                max_duration: float = 15.0) -> tuple:  # Increased from 10.0
        # Clear CUDA cache before processing
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        audio_path = str(audio_path)
        
        # Check cache first
        cache_key = f"{audio_path}_{min_duration}_{max_duration}"
        if cache_key in self.speaker_cache:
            logging.info("Using cached speaker embedding")
            return self.speaker_cache[cache_key]
        
        try:
            # Load audio with higher quality
            audio, sr = librosa.load(audio_path, sr=22050)  # Match XTTS sample rate
            logging.info(f"Loaded audio: {len(audio)/sr:.2f}s at {sr}Hz")
            
            # Transcribe with better parameters
            segments, info = self.whisper_model.transcribe(
                audio_path,
                beam_size=5,  # Increased for better quality
                best_of=5,    # Add best_of parameter
                temperature=0.0,  # More deterministic
                vad_filter=False,
                word_timestamps=True,
                chunk_length=30
            )
            
            segments = list(segments)
            if not segments:
                raise ValueError("No speech segments found in audio")
            
            # Enhanced segment scoring for voice quality
            scored_segments = []
            for i, seg in enumerate(segments):
                duration = seg.end - seg.start
                
                if min_duration <= duration <= max_duration:
                    # Extract audio segment for analysis
                    start_samples = int(seg.start * sr)
                    end_samples = int(seg.end * sr)
                    segment_audio = audio[start_samples:end_samples]
                    
                    # Calculate audio quality metrics
                    rms_energy = np.sqrt(np.mean(segment_audio**2))
                    spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=segment_audio, sr=sr))
                    zero_crossing_rate = np.mean(librosa.feature.zero_crossing_rate(segment_audio))
                    
                    # Text quality metrics
                    word_count = len(seg.text.split())
                    has_punctuation = any(p in seg.text for p in '.!?')
                    is_complete_sentence = seg.text.strip().endswith(('.', '!', '?'))
                    
                    # Comprehensive scoring
                    score = (
                        (duration / max_duration) * 0.25 +  # Duration preference
                        (word_count / 30) * 0.15 +          # Word count
                        is_complete_sentence * 0.2 +        # Complete sentences
                        (rms_energy * 1000) * 0.15 +        # Audio energy
                        info.language_probability * 0.15 +   # Language confidence
                        (1 - zero_crossing_rate) * 0.1      # Voice stability
                    )
                    
                    scored_segments.append((score, i, seg, segment_audio))
            
            if not scored_segments:
                # Fallback: use the longest segment
                longest_seg = max(segments, key=lambda s: s.end - s.start)
                start_samples = int(longest_seg.start * sr)
                end_samples = int(longest_seg.end * sr)
                segment_audio = audio[start_samples:end_samples]
                scored_segments = [(0.5, 0, longest_seg, segment_audio)]
                logging.warning("No ideal segments found, using longest segment")
            
            # Get best segment
            scored_segments.sort(reverse=True, key=lambda x: x[0])
            best_score, best_idx, best_segment, best_audio = scored_segments[0]
            
            # Apply audio enhancement to speaker sample
            enhanced_audio = self._enhance_speaker_audio(best_audio, sr)
            
            # Save enhanced speaker sample
            speaker_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            sf.write(speaker_wav.name, enhanced_audio, sr)
            speaker_wav.close()
            
            result = (
                speaker_wav.name,
                best_segment.text.strip(),
                best_segment.start,
                best_segment.end
            )
            
            # Cache the result
            self.speaker_cache[cache_key] = result
            
            logging.info(f"Selected speaker segment: '{best_segment.text[:50]}...'")
            logging.info(f"Duration: {best_segment.end - best_segment.start:.2f}s, Score: {best_score:.3f}")
            
            return result
            
        except Exception as e:
            logging.error(f"Failed to extract speaker embedding: {e}")
            raise
    def synthesize_segment(self, 
                          text: str, 
                          speaker_wav: str,
                          target_duration: Optional[float] = None,
                          language: str = "en",
                          temperature: float = 0.75,
                          length_penalty: float = 1.0,
                          repetition_penalty: float = 5.0,
                          top_k: int = 50,
                          top_p: float = 0.85) -> tuple:
        logging.info(f"Synthesizing: '{text[:50]}...'")
        start_time = time.time()
        
        # Clear CUDA cache before synthesis
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        try:
            # Enhanced synthesis with better parameters
            wav = self.tts.tts(
                text=text.strip(),
                speaker_wav=speaker_wav,
                language=language,
                temperature=temperature,
                length_penalty=length_penalty,
                repetition_penalty=repetition_penalty,
                top_k=top_k,
                top_p=top_p,
                speed=1.0
            )
            
            # Convert to numpy array
            if isinstance(wav, list):
                wav = np.array(wav, dtype=np.float32)
            elif torch.is_tensor(wav):
                wav = wav.cpu().numpy().astype(np.float32)
            
            # Get sample rate
            sample_rate = 22050
            if hasattr(self.tts, 'synthesizer') and hasattr(self.tts.synthesizer, 'output_sample_rate'):
                sample_rate = self.tts.synthesizer.output_sample_rate
            
            # Apply post-processing
            wav = self._post_process_synthesis(wav, sample_rate)
            
            # Duration adjustment with better blending
            if target_duration is not None:
                wav = self._adjust_duration_smart(wav, sample_rate, target_duration)
            
            synthesis_time = time.time() - start_time
            audio_duration = len(wav) / sample_rate
            rtf = synthesis_time / audio_duration if audio_duration > 0 else 0
            
            logging.info(f"Synthesized {audio_duration:.2f}s audio in {synthesis_time:.2f}s (RTF: {rtf:.2f})")
            
            return wav, sample_rate
            
        except Exception as e:
            logging.error(f"Failed to synthesize segment: {e}")
            raise
    def apply_diffs_with_xtts(self, 
                             original_wav_path: str, 
                             diffs: List[Dict],
                             output_path: Optional[str] = None) -> str:
        logging.info(f"Starting XTTS audio modification on {original_wav_path}")
        start_total = time.time()
        
        if output_path is None:
            output_path = os.path.join(project_root, "backend", "assests", "audio", "xtts_modified_audio.wav")
        
        # Load original audio with consistent sample rate
        orig_audio, orig_sr = librosa.load(original_wav_path, sr=22050)
        logging.info(f"Loaded original audio: {len(orig_audio)/orig_sr:.2f}s at {orig_sr}Hz")
        
        # Extract multiple speaker embeddings for better variety
        speaker_embeddings = self._extract_multiple_speaker_embeddings(original_wav_path)
        
        try:
            out_audio = np.array([])
            cursor_samples = 0
            
            for i, diff in enumerate(diffs, 1):
                logging.info(f"--- Processing diff {i}/{len(diffs)}: {diff['type']} ---")
                
                start_samples = int(diff["start"] * orig_sr)
                end_samples = int(diff["end"] * orig_sr)
                
                # Add unchanged audio up to this diff with crossfade
                if len(out_audio) > 0:
                    unchanged_section = orig_audio[cursor_samples:start_samples]
                    out_audio = self._crossfade_audio(out_audio, unchanged_section, orig_sr)
                else:
                    out_audio = np.concatenate([out_audio, orig_audio[cursor_samples:start_samples]])
                
                if diff["type"] == "remove":
                    logging.info(f"Removing audio from {diff['start']:.2f}s to {diff['end']:.2f}s")
                    
                elif diff["type"] in ("replace", "insert"):
                    text = diff["new_text"]
                    duration = diff["end"] - diff["start"]
                    
                    # Choose best speaker embedding for this text
                    speaker_wav = self._choose_best_speaker_embedding(text, speaker_embeddings)
                    
                    try:
                        # Synthesize with context-aware parameters
                        synth_audio, synth_sr = self.synthesize_segment(
                            text=text,
                            speaker_wav=speaker_wav,
                            target_duration=duration if diff["type"] == "replace" else None,
                            language="en",
                            temperature=0.7,  # Slightly more controlled
                            top_p=0.8
                        )
                        
                        # Resample if necessary
                        if synth_sr != orig_sr:
                            synth_audio = librosa.resample(
                                synth_audio, 
                                orig_sr=synth_sr, 
                                target_sr=orig_sr
                            )
                        
                        # Match spectral characteristics of surrounding audio
                        if diff["type"] == "replace" and start_samples > 0 and end_samples < len(orig_audio):
                            synth_audio = self._match_spectral_envelope(
                                synth_audio, orig_audio, start_samples, end_samples, orig_sr
                            )
                        
                        # Apply smooth transitions
                        synth_audio = self._apply_smooth_transitions(synth_audio, orig_sr)
                        
                        # Blend with surrounding audio
                        out_audio = self._blend_audio_segment(
                            out_audio, synth_audio, orig_audio, 
                            start_samples, end_samples, orig_sr
                        )
                        
                        logging.info(f"✅ Inserted synthesized segment: '{text[:30]}...'")
                        
                    except Exception as e:
                        logging.error(f"❌ Failed to synthesize segment: {e}")
                        # Fallback: keep original audio for replace, skip for insert
                        if diff["type"] == "replace":
                            out_audio = np.concatenate([out_audio, orig_audio[start_samples:end_samples]])
                
                cursor_samples = end_samples
            
            # Add remaining audio with crossfade
            if cursor_samples < len(orig_audio):
                remaining_audio = orig_audio[cursor_samples:]
                out_audio = self._crossfade_audio(out_audio, remaining_audio, orig_sr)
            
            # Final audio enhancement
            out_audio = self._final_audio_enhancement(out_audio, orig_sr)
            
            # Save output
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            sf.write(output_path, out_audio, orig_sr)
            
            total_time = time.time() - start_total
            output_duration = len(out_audio) / orig_sr
            
            logging.info(f"✅ XTTS modification complete!")
            logging.info(f"Output: {output_path} ({output_duration:.2f}s)")
            logging.info(f"Total processing time: {total_time:.2f}s")
            
            return output_path
            
        finally:
            # Cleanup
            for speaker_wav, *_ in speaker_embeddings:
                try:
                    if os.path.exists(speaker_wav):
                        os.unlink(speaker_wav)
                except:                    pass
    
    def _enhance_speaker_audio(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """Enhance speaker audio for better voice cloning"""
        # Normalize audio
        audio = audio / np.max(np.abs(audio)) if np.max(np.abs(audio)) > 0 else audio
        
        # Apply gentle high-pass filter to remove low-frequency noise
        nyquist = sr / 2
        low_cutoff = 80 / nyquist
        b, a = butter(2, low_cutoff, btype='high')
        audio = filtfilt(b, a, audio)
        
        # Apply gentle compression
        threshold = 0.1
        ratio = 3.0
        above_threshold = np.abs(audio) > threshold
        audio[above_threshold] = np.sign(audio[above_threshold]) * (
            threshold + (np.abs(audio[above_threshold]) - threshold) / ratio
        )
        
        # Final normalization
        audio = audio / np.max(np.abs(audio)) * 0.95 if np.max(np.abs(audio)) > 0 else audio
        
        return audio
    
    def _post_process_synthesis(self, wav: np.ndarray, sr: int) -> np.ndarray:
        """Post-process synthesized audio for better quality"""
        # Normalize
        wav = wav / np.max(np.abs(wav)) if np.max(np.abs(wav)) > 0 else wav
        
        # Apply gentle de-essing (reduce harsh s sounds)
        nyquist = sr / 2
        
        # High-frequency gentle roll-off
        high_cutoff = 8000 / nyquist
        b, a = butter(2, high_cutoff, btype='low')
        wav = filtfilt(b, a, wav)
        
        # Dynamic range compression
        wav = self._apply_compression(wav)
        
        return wav
    
    def _apply_compression(self, audio: np.ndarray, 
                          threshold: float = 0.3, 
                          ratio: float = 4.0,
                          attack: float = 0.003,
                          release: float = 0.1) -> np.ndarray:
        """Apply dynamic range compression"""
        compressed = audio.copy()
        envelope = 0.0
        
        for i in range(len(audio)):
            input_level = abs(audio[i])
            
            if input_level > envelope:
                envelope += (input_level - envelope) * attack
            else:
                envelope += (input_level - envelope) * release
            
            if envelope > threshold:
                excess = envelope - threshold
                compressed[i] = audio[i] * (1 - (excess / envelope) * (1 - 1/ratio))
        
        return compressed
    
    def _adjust_duration_smart(self, wav: np.ndarray, sr: int, target_duration: float) -> np.ndarray:
        """Intelligently adjust audio duration"""
        current_duration = len(wav) / sr
        target_samples = int(target_duration * sr)
        
        if abs(current_duration - target_duration) < 0.1:
            return wav  # Close enough, no adjustment needed
        
        if current_duration < target_duration:
            # Need to stretch - use librosa's time stretching
            stretch_factor = target_duration / current_duration
            if stretch_factor <= 1.3:  # Only stretch up to 30%
                wav = librosa.effects.time_stretch(wav, rate=1/stretch_factor)
            else:
                # Add silence at natural pause points
                silence_needed = target_samples - len(wav)
                silence = np.zeros(silence_needed)
                # Add silence at the end with fade
                fade_samples = min(int(0.1 * sr), silence_needed // 2)
                if fade_samples > 0:
                    fade_out = np.linspace(1, 0, fade_samples)
                    fade_in = np.linspace(0, 1, fade_samples)
                    
                    wav[-fade_samples:] *= fade_out
                    silence[:fade_samples] = wav[-fade_samples:] * fade_in
                wav = np.concatenate([wav, silence])
        
        else:
            # Need to compress - use time stretching or trimming
            stretch_factor = target_duration / current_duration
            if stretch_factor >= 0.8:  # Only compress up to 20%
                wav = librosa.effects.time_stretch(wav, rate=1/stretch_factor)
            else:
                # Trim with fade out
                fade_samples = int(0.05 * sr)  # 50ms fade
                trim_point = target_samples - fade_samples
                wav = wav[:trim_point]
                if fade_samples > 0:
                    fade = np.linspace(1, 0, fade_samples)
                    wav = np.concatenate([wav, wav[-fade_samples:] * fade])
        
        return wav[:target_samples]  # Ensure exact length
    
    def _extract_multiple_speaker_embeddings(self, audio_path: str) -> List[tuple]:
        """Extract multiple speaker embeddings for variety"""
        embeddings = []
        
        # Try different duration ranges for speaker samples
        duration_ranges = [
            (3.0, 8.0),   # Short samples
            (5.0, 12.0),  # Medium samples
            (8.0, 15.0),  # Long samples
        ]
        
        for min_dur, max_dur in duration_ranges:
            try:
                embedding = self.extract_speaker_embedding(audio_path, min_dur, max_dur)
                embeddings.append(embedding)
            except Exception as e:
                logging.warning(f"Could not extract embedding for duration {min_dur}-{max_dur}: {e}")
        
        # Fallback: ensure we have at least one embedding
        if not embeddings:
            try:
                embedding = self.extract_speaker_embedding(audio_path, 2.0, 20.0)
                embeddings.append(embedding)
            except Exception as e:
                logging.error(f"Could not extract any speaker embedding: {e}")
                raise
        
        return embeddings
    
    def _choose_best_speaker_embedding(self, text: str, embeddings: List[tuple]) -> str:
        """Choose the best speaker embedding for the given text"""
        if not embeddings:
            raise ValueError("No speaker embeddings available")
        
        if len(embeddings) == 1:
            return embeddings[0][0]  # Return speaker_wav path
        
        # Simple heuristic: choose based on text length
        text_length = len(text.split())
        
        if text_length <= 5:
            # Short text: use short speaker sample
            return embeddings[0][0]
        elif text_length <= 15:
            # Medium text: use medium speaker sample
            return embeddings[min(1, len(embeddings)-1)][0]
        else:
            # Long text: use long speaker sample
            return embeddings[-1][0]
    
    def _crossfade_audio(self, audio1: np.ndarray, audio2: np.ndarray, sr: int, 
                        crossfade_duration: float = 0.05) -> np.ndarray:
        """Apply crossfade between audio segments"""
        if len(audio1) == 0:
            return audio2
        if len(audio2) == 0:
            return audio1
        
        crossfade_samples = int(crossfade_duration * sr)
        crossfade_samples = min(crossfade_samples, len(audio1), len(audio2))
        
        if crossfade_samples <= 0:
            return np.concatenate([audio1, audio2])
        
        # Create fade curves
        fade_out = np.linspace(1, 0, crossfade_samples)
        fade_in = np.linspace(0, 1, crossfade_samples)
        
        # Apply crossfade
        audio1_faded = audio1.copy()
        audio1_faded[-crossfade_samples:] *= fade_out
        
        audio2_faded = audio2.copy()
        audio2_faded[:crossfade_samples] *= fade_in
        
        # Combine
        crossfaded_section = audio1[-crossfade_samples:] + audio2_faded[:crossfade_samples]
        
        return np.concatenate([
            audio1[:-crossfade_samples],
            crossfaded_section,
            audio2[crossfade_samples:]
        ])
    
    def _match_spectral_envelope(self, synth_audio: np.ndarray, orig_audio: np.ndarray, 
                                start_samples: int, end_samples: int, sr: int) -> np.ndarray:
        """Match spectral characteristics of surrounding audio"""
        try:
            # Get surrounding context
            context_before = orig_audio[max(0, start_samples-int(0.5*sr)):start_samples]
            context_after = orig_audio[end_samples:min(len(orig_audio), end_samples+int(0.5*sr))]
            
            if len(context_before) == 0 and len(context_after) == 0:
                return synth_audio
            
            # Combine context
            context = np.concatenate([context_before, context_after])
            
            # Simple spectral matching via RMS energy adjustment
            context_rms = np.sqrt(np.mean(context**2))
            synth_rms = np.sqrt(np.mean(synth_audio**2))
            
            if synth_rms > 0:
                adjustment_factor = context_rms / synth_rms
                # Limit adjustment to reasonable range
                adjustment_factor = np.clip(adjustment_factor, 0.3, 3.0)
                synth_audio = synth_audio * adjustment_factor
            
            return synth_audio
            
        except Exception as e:
            logging.warning(f"Could not match spectral envelope: {e}")
            return synth_audio
    
    def _apply_smooth_transitions(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """Apply smooth fade-in and fade-out to audio"""
        fade_duration = 0.02  # 20ms fade
        fade_samples = int(fade_duration * sr)
        fade_samples = min(fade_samples, len(audio) // 4)  # Don't fade more than 25% of audio
        
        if fade_samples <= 0:
            return audio
        
        # Apply fade-in
        fade_in = np.linspace(0, 1, fade_samples)
        audio[:fade_samples] *= fade_in
        
        # Apply fade-out
        fade_out = np.linspace(1, 0, fade_samples)
        audio[-fade_samples:] *= fade_out
        
        return audio
    
    def _blend_audio_segment(self, out_audio: np.ndarray, synth_audio: np.ndarray, 
                           orig_audio: np.ndarray, start_samples: int, end_samples: int, sr: int) -> np.ndarray:
        """Blend synthesized audio with surrounding original audio"""
        if len(out_audio) == 0:
            return synth_audio
        
        # Simple concatenation with crossfade
        return self._crossfade_audio(out_audio, synth_audio, sr)
    
    def _final_audio_enhancement(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """Apply final enhancement to the complete audio"""
        # Normalize to prevent clipping
        peak = np.max(np.abs(audio))
        if peak > 0.95:
            audio = audio * (0.95 / peak)
        
        # Apply gentle high-frequency roll-off to reduce harshness
        nyquist = sr / 2
        high_cutoff = 12000 / nyquist
        if high_cutoff < 1.0:
            b, a = butter(1, high_cutoff, btype='low')
            audio = filtfilt(b, a, audio)
        
        return audio

    def get_available_models(self) -> List[str]:
        return TTS().list_models()
    def __del__(self):
        # Clear speaker cache files
        for cache_key, (speaker_wav, *_) in self.speaker_cache.items():
            try:
                if os.path.exists(speaker_wav):
                    os.unlink(speaker_wav)
            except:
                pass


def compute_diff_tree(original: List[Dict], edited: List[Dict], time_tolerance: float = 0.5) -> List[Dict]:
        diffs = []
        i, j = 0, 0
        
        while i < len(original) and j < len(edited):
            o, e = original[i], edited[j]
            
            # Check if segments align in time
            if (abs(o["start"] - e["start"]) < time_tolerance and 
                abs(o["end"] - e["end"]) < time_tolerance):
                
                if o["text"].strip() != e["text"].strip():
                    diffs.append({
                        "start": o["start"],
                        "end": o["end"],
                        "type": "replace",
                        "old_text": o["text"],
                        "new_text": e["text"]
                    })
                i += 1
                j += 1
                
            elif o["end"] <= e["start"]:
                diffs.append({
                    "start": o["start"],
                    "end": o["end"],
                    "type": "remove",
                    "old_text": o["text"]
                })
                i += 1
                
            elif e["end"] <= o["start"]:
                diffs.append({
                    "start": e["start"],
                    "end": e["end"],
                    "type": "insert",
                    "new_text": e["text"]
                })
                j += 1
                
            else:
                diffs.append({
                    "start": o["start"],
                    "end": o["end"],
                    "type": "replace",
                    "old_text": o["text"],
                    "new_text": e["text"]
                })
                i += 1
                j += 1
        
        # Handle remaining segments
        while i < len(original):
            diffs.append({
                "start": original[i]["start"],
                "end": original[i]["end"],
                "type": "remove",
                "old_text": original[i]["text"]
            })
            i += 1
        
        while j < len(edited):
            diffs.append({
                "start": edited[j]["start"],
                "end": edited[j]["end"],
                "type": "insert",
                "new_text": edited[j]["text"]
            })
            j += 1
        
        return diffs


def play_audio(path: str):
    import platform
    import subprocess
    
    try:
        if platform.system() == "Linux":
            subprocess.call(["aplay", path])
        elif platform.system() == "Darwin":
            subprocess.call(["afplay", path])
        elif platform.system() == "Windows":
            os.startfile(path)
    except Exception as e:
        logging.error(f"Could not play audio: {e}")


tts_service = CoquiTTSService(
    model_name="tts_models/multilingual/multi-dataset/xtts_v2",
    device="auto"
)

# File paths
current_dir = os.path.dirname(os.path.abspath(__file__))
original_path = os.path.join(current_dir, "../../assests/transcription/transcription.json")
new_path = os.path.join(current_dir, "../../assests/transcription/newtranscripton.json")
original_wav_path = os.path.join(current_dir, "../../assests/audio/extracted_audio.wav")

try:
    # Load transcript files
    with open(original_path, "r") as orig_file:
        original = json.load(orig_file)
    
    with open(new_path, "r") as new_file:
        edited = json.load(new_file)
    
    # Compute differences
    diffs = compute_diff_tree(original, edited)
    logging.info(f"Found {len(diffs)} differences to apply")
    
    # Apply differences using XTTS
    output_path = tts_service.apply_diffs_with_xtts(original_wav_path, diffs)
    
    print(f"Modified audio saved to: {output_path}")
    
except Exception as e:
    logging.error(f"Processing failed: {e}")
    raise
    