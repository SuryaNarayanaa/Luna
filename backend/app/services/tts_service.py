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

# Add project paths
current_file = os.path.abspath(__file__)
project_root = os.path.abspath(os.path.join(current_file, "../../../.."))
sys.path.append(project_root)
sys.path.append(os.path.join(project_root, "backend"))

from app.utils.logger import setup_logger, logger as logging
from app.model_manager.faster_whispher import model_manager

# Coqui TTS imports
try:
    from TTS.api import TTS
except ImportError:
    raise ImportError("Please install coqui-tts: pip install coqui-tts")

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
                    model_size="large-v3",
                    device=self.device,
                    compute_type="float16" if self.device == "cuda" else "float32"
                )
            
            logging.info("All models loaded successfully")
            
        except Exception as e:
            logging.error(f"Failed to load models: {e}")
            raise
    
    def extract_speaker_embedding(self, 
                                audio_path: Union[str, Path], 
                                min_duration: float = 3.0,
                                max_duration: float = 10.0) -> tuple:
        audio_path = str(audio_path)
        
        # Check cache first
        cache_key = f"{audio_path}_{min_duration}_{max_duration}"
        if cache_key in self.speaker_cache:
            logging.info("Using cached speaker embedding")
            return self.speaker_cache[cache_key]
        
        try:
            # Load audio
            audio, sr = librosa.load(audio_path, sr=None)
            logging.info(f"Loaded audio: {len(audio)/sr:.2f}s at {sr}Hz")
            
            # Transcribe with VAD filtering
            segments, info = self.whisper_model.transcribe(
                audio_path,
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=400,
                )
            )
            
            segments = list(segments)
            if not segments:
                raise ValueError("No speech segments found in audio")
            
            # Score segments for voice cloning quality
            scored_segments = []
            for i, seg in enumerate(segments):
                duration = seg.end - seg.start
                
                if min_duration <= duration <= max_duration:
                    word_count = len(seg.text.split())
                    ends_with_punct = seg.text.strip()[-1] in '.!?'
                    
                    score = (
                        (duration / max_duration) * 0.3 +
                        (word_count / 20) * 0.2 +
                        ends_with_punct * 0.2 +
                        info.language_probability * 0.3
                    )
                    
                    scored_segments.append((score, i, seg))
            
            if not scored_segments:
                # Fallback: use the longest segment
                longest_seg = max(segments, key=lambda s: s.end - s.start)
                scored_segments = [(0.5, 0, longest_seg)]
                logging.warning("No ideal segments found, using longest segment")
            
            # Get best segment
            scored_segments.sort(reverse=True, key=lambda x: x[0])
            best_score, best_idx, best_segment = scored_segments[0]
            
            # Extract audio segment
            start_samples = int(best_segment.start * sr)
            end_samples = int(best_segment.end * sr)
            voice_segment = audio[start_samples:end_samples]
            
            # Save speaker sample to temporary file
            speaker_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            sf.write(speaker_wav.name, voice_segment, sr)
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
                          language: str = "en") -> tuple:
        logging.info(f"Synthesizing: '{text[:50]}...'")
        start_time = time.time()
        
        try:
            # Generate audio using XTTS
            wav = self.tts.tts(
                text=text,
                speaker_wav=speaker_wav,
                language=language
            )
            
            # Convert to numpy array if needed
            if isinstance(wav, list):
                wav = np.array(wav, dtype=np.float32)
            elif torch.is_tensor(wav):
                wav = wav.cpu().numpy().astype(np.float32)
            
            # Get sample rate from TTS model
            sample_rate = 22050  # Default XTTS sample rate
            if hasattr(self.tts, 'synthesizer') and hasattr(self.tts.synthesizer, 'output_sample_rate'):
                sample_rate = self.tts.synthesizer.output_sample_rate
            
            # Adjust duration if specified
            if target_duration is not None:
                target_samples = int(target_duration * sample_rate)
                current_samples = len(wav)
                
                if current_samples < target_samples:
                    # Pad with silence
                    padding = target_samples - current_samples
                    wav = np.pad(wav, (0, padding), mode='constant', constant_values=0)
                    logging.info(f"Padded audio to {target_duration:.2f}s")
                elif current_samples > target_samples:
                    # Trim audio
                    wav = wav[:target_samples]
                    logging.info(f"Trimmed audio to {target_duration:.2f}s")
            
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
        logging.info(f"🔁 Starting XTTS audio modification on {original_wav_path}")
        start_total = time.time()
        
        if output_path is None:
            output_path = os.path.join(project_root, "assests", "audio", "xtts_modified_audio.wav")
        
        # Load original audio
        orig_audio, orig_sr = librosa.load(original_wav_path, sr=None)
        logging.info(f"Loaded original audio: {len(orig_audio)/orig_sr:.2f}s at {orig_sr}Hz")
        
        # Extract speaker embedding
        speaker_wav, speaker_text, start_time, end_time = self.extract_speaker_embedding(
            original_wav_path, min_duration=3.0, max_duration=10.0
        )
        
        logging.info(f"Speaker reference: '{speaker_text[:50]}...' ({end_time-start_time:.2f}s)")
        
        try:
            out_audio = np.array([])
            cursor_samples = 0
            
            for i, diff in enumerate(diffs, 1):
                logging.info(f"--- Processing diff {i}/{len(diffs)}: {diff['type']} ---")
                
                start_samples = int(diff["start"] * orig_sr)
                end_samples = int(diff["end"] * orig_sr)
                
                # Add unchanged audio up to this diff
                out_audio = np.concatenate([out_audio, orig_audio[cursor_samples:start_samples]])
                
                if diff["type"] == "remove":
                    logging.info(f"Removing audio from {diff['start']:.2f}s to {diff['end']:.2f}s")
                    
                elif diff["type"] in ("replace", "insert"):
                    text = diff["new_text"]
                    duration = diff["end"] - diff["start"]
                    
                    try:
                        # Synthesize replacement audio
                        synth_audio, synth_sr = self.synthesize_segment(
                            text=text,
                            speaker_wav=speaker_wav,
                            target_duration=duration if diff["type"] == "replace" else None,
                            language="en"
                        )
                        
                        # Resample if necessary
                        if synth_sr != orig_sr:
                            synth_audio = librosa.resample(
                                synth_audio, 
                                orig_sr=synth_sr, 
                                target_sr=orig_sr
                            )
                        
                        out_audio = np.concatenate([out_audio, synth_audio])
                        logging.info(f"✅ Inserted synthesized segment: '{text[:30]}...'")
                        
                    except Exception as e:
                        logging.error(f"❌ Failed to synthesize segment: {e}")
                        # Fallback: keep original audio for replace, skip for insert
                        if diff["type"] == "replace":
                            out_audio = np.concatenate([out_audio, orig_audio[start_samples:end_samples]])
                
                cursor_samples = end_samples
            
            # Add remaining audio
            out_audio = np.concatenate([out_audio, orig_audio[cursor_samples:]])
            
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
            # Cleanup temporary speaker file
            try:
                if os.path.exists(speaker_wav):
                    os.unlink(speaker_wav)
            except Exception as e:
                logging.warning(f"Could not cleanup speaker file: {e}")
    
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
    
    print(f"✅ Modified audio saved to: {output_path}")
    
except Exception as e:
    logging.error(f"Processing failed: {e}")
    raise
    