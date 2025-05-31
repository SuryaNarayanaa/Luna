import warnings
import numpy as np
import os
import sys
import json
import time
import tempfile
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Optional, Union, Tuple
from pathlib import Path
import subprocess
from functools import lru_cache
from app.model_manager.faster_whispher import model_manager
import torch

import librosa
import soundfile as sf
from faster_whisper import WhisperModel
from app.utils.logger import setup_logger, logger
class AudioExtractor:
    
    def __init__(self, sample_rate: int = 44100, channels: int = 2):
        self.sample_rate = sample_rate
        self.channels = channels
        self._check_ffmpeg()
    
    def _check_ffmpeg(self):
        try:
            subprocess.run(["ffmpeg", "-version"], 
                         capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise RuntimeError("FFmpeg not found. Please install FFmpeg and add it to PATH.")
    
    def extract_audio(self, video_path: Union[str, Path], 
                     output_dir: Union[str, Path]) -> str:
        video_path = Path(video_path)
        output_dir = Path(output_dir)
        
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        audio_filename = f"{video_path.stem}_extracted.wav"
        audio_output = output_dir / audio_filename
        
        cmd = [
            "ffmpeg",
            "-i", str(video_path),
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", str(self.sample_rate),
            "-ac", str(self.channels),
            "-y",
            str(audio_output)
        ]
        
        logger.info(f"Extracting audio from {video_path.name}...")
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            logger.info(f"Audio extracted successfully: {audio_output}")
            return str(audio_output)
            
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg extraction failed: {e.stderr}")
            raise


class AudioChunker:
    
    def __init__(self, chunk_length_ms: int = 30000, overlap_ms: int = 1000):
        self.chunk_length_ms = chunk_length_ms
        self.overlap_ms = overlap_ms
        self.temp_files = []
    
    @lru_cache(maxsize=4)
    def load_audio(self, audio_path: str, target_sr: int = 44100) -> Tuple[np.ndarray, int]:
        try:
            audio, sr = librosa.load(audio_path, sr=target_sr)
            logger.info(f"Loaded audio: {len(audio)/sr:.2f}s at {sr}Hz")
            return audio, sr
        except Exception as e:
            logger.error(f"Failed to load audio {audio_path}: {e}")
            raise
    
    def create_chunks(self, audio_path: Union[str, Path]) -> List[str]:
        audio_path = str(audio_path)
        audio, sr = self.load_audio(audio_path)
        
        chunk_samples = int(self.chunk_length_ms * sr / 1000)
        overlap_samples = int(self.overlap_ms * sr / 1000)
        
        chunks = []
        start = 0
        chunk_index = 0
        
        logger.info(f"Creating chunks: {self.chunk_length_ms}ms with {self.overlap_ms}ms overlap")
        
        while start < len(audio):
            end = min(start + chunk_samples, len(audio))
            chunk = audio[start:end]
            
            try:
                with tempfile.NamedTemporaryFile(
                    suffix=f"_chunk_{chunk_index:04d}.wav", 
                    delete=False
                ) as f:
                    sf.write(f.name, chunk, sr)
                    chunks.append(f.name)
                    self.temp_files.append(f.name)
                    
            except Exception as e:
                logger.error(f"Failed to save chunk {chunk_index}: {e}")
                raise
            
            start += chunk_samples - overlap_samples
            chunk_index += 1
        
        logger.info(f"Created {len(chunks)} audio chunks")
        return chunks
    
    def cleanup_temp_files(self):
        for temp_file in self.temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except Exception as e:
                logger.warning(f"Failed to cleanup temp file {temp_file}: {e}")
        self.temp_files.clear()


class WhisperTranscriber:
    
    def __init__(self, model_size: str = "large-v3", 
                 device: str = "auto", 
                 compute_type: str = "auto",
                 language: str = "auto"):
        self.model_size = model_size
        self.device = self._determine_device(device)
        self.compute_type = self._determine_compute_type(compute_type)
        self.language = None if language.lower() == "auto" else language
        self.model = self._load_model()
    
    def _determine_device(self, device: str) -> str:
        if device == "auto":
            return "cuda" if torch.cuda.is_available() else "cpu"
        return device
    
    def _determine_compute_type(self, compute_type: str) -> str:
        if compute_type == "auto":
            return "float16" if self.device == "cuda" else "float32"
        return compute_type
    
    def _load_model(self) -> WhisperModel:
        logger.info(f"Loading Whisper model '{self.model_size}' on {self.device}")
        
        try:
            model = model_manager.load_model(
                model_size=self.model_size,
                device=self.device,
                compute_type=self.compute_type
            )
            return model
            
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise
    
    def transcribe_chunk(self, chunk_file: str, index: int, 
                        offset: float, beam_size: int = 5) -> Dict:
        try:
            segments, info = self.model.transcribe(
                chunk_file,
                language=self.language,
                beam_size=beam_size,
                word_timestamps=True
            )
            
            # Adjust timestamps by offset
            adjusted_segments = []
            for seg in segments:
                adjusted_segments.append({
                    "start": seg.start + offset,
                    "end": seg.end + offset,
                    "text": seg.text.strip(),
                    "confidence": getattr(seg, 'avg_logprob', 0.0),
                    "no_speech_prob": getattr(seg, 'no_speech_prob', 0.0)
                })
            
            # Clean up chunk file
            try:
                os.unlink(chunk_file)
            except Exception as e:
                logger.warning(f"Failed to cleanup chunk file {chunk_file}: {e}")
            
            return {
                "index": index,
                "segments": adjusted_segments,
                "language": getattr(info, 'language', 'unknown'),
                "language_probability": getattr(info, 'language_probability', 0.0)
            }
            
        except Exception as e:
            logger.error(f"Failed to transcribe chunk {index}: {e}")
            # Still clean up the file on error
            try:
                os.unlink(chunk_file)
            except:
                pass
            return {"index": index, "segments": [], "error": str(e)}


class TranscriptProcessor:
    
    def __init__(self, overlap_threshold: float = 0.1):
        self.overlap_threshold = overlap_threshold
    
    def merge_transcripts(self, results: List[Dict]) -> List[Dict]:
        # Sort results by chunk index
        results.sort(key=lambda x: x["index"])
        
        full_transcript = []
        last_end = 0.0
        
        for result in results:
            if "error" in result:
                logger.warning(f"Skipping chunk {result['index']} due to error: {result['error']}")
                continue
                
            for segment in result["segments"]:
                # Skip segments with high no_speech probability
                if segment.get("no_speech_prob", 0) > 0.9:
                    continue
                
                # Skip overlapping segments
                if segment["start"] >= last_end - self.overlap_threshold:
                    full_transcript.append(segment)
                    last_end = segment["end"]
                else:
                    logger.debug(f"Skipped overlapping segment: {segment['start']:.2f}-{segment['end']:.2f}")
        
        logger.info(f"Merged transcript: {len(full_transcript)} segments")
        return full_transcript
    
    def format_transcript(self, segments: List[Dict]) -> Dict:
        # Full text
        full_text = " ".join(seg["text"] for seg in segments)
        
        # Text with timestamps
        timestamped_text = []
        for seg in segments:
            start_time = self._format_time(seg["start"])
            end_time = self._format_time(seg["end"])
            timestamped_text.append(f"[{start_time} - {end_time}] {seg['text']}")
        
        # Statistics
        total_duration = segments[-1]["end"] if segments else 0.0
        avg_confidence = np.mean([seg.get("confidence", 0) for seg in segments]) if segments else 0.0
        
        return {
            "full_text": full_text,
            "timestamped_text": "\n".join(timestamped_text),
            "segments": segments,
            "statistics": {
                "total_segments": len(segments),
                "total_duration": total_duration,
                "average_confidence": avg_confidence,
                "words_per_minute": len(full_text.split()) / (total_duration / 60) if total_duration > 0 else 0
            }
        }
    
    def _format_time(self, seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"


class TranscriptSaver:
    
    def __init__(self, output_dir: Union[str, Path]):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _save_simplified_transcript(self, transcript_data: Dict, filename_prefix: str) -> Optional[str]:
        try:
            current_file = Path(__file__)
            assests_transcription_dir = current_file.parent.parent.parent / "assests" / "transcription"
            assests_transcription_dir.mkdir(parents=True, exist_ok=True)
            simplified_data = []
            for segment in transcript_data.get("segments", []):
                simplified_data.append({
                    "start": segment["start"],
                    "stop": segment["end"],
                    "text": segment["text"]
                })
        
            simplified_filename = f"{filename_prefix}.json"
            simplified_path = assests_transcription_dir / simplified_filename
            
            with open(simplified_path, 'w', encoding='utf-8') as f:
                json.dump(simplified_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Simplified transcript saved: {simplified_path}")
            return str(simplified_path)
            
        except Exception as e:
            logger.error(f"Failed to save simplified transcript: {e}")
            return None
    
    def save_transcript(self, transcript_data: Dict, 
                       filename_prefix: str = "transcript") -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_filename = f"{filename_prefix}_{timestamp}"
        
        saved_files = {}
        
        # Save JSON format
        json_path = self.output_dir / f"{base_filename}.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump({
                **transcript_data,
                "metadata": {
                    "created_at": datetime.now().isoformat(),
                    "version": "1.0"
                }
            }, f, indent=2, ensure_ascii=False)
        saved_files["json"] = str(json_path)
        
        # Save plain text
        txt_path = self.output_dir / f"{base_filename}.txt"
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(transcript_data["full_text"])
        saved_files["txt"] = str(txt_path)
        
        # Save timestamped text
        srt_path = self.output_dir / f"{base_filename}_timestamped.txt"
        with open(srt_path, 'w', encoding='utf-8') as f:
            f.write(transcript_data["timestamped_text"])
        saved_files["timestamped"] = str(srt_path)

        # Save segments as JSON
        simplified_transcript = self._save_simplified_transcript(transcript_data, filename_prefix)
        if simplified_transcript:
            saved_files["simplified"] = simplified_transcript
        
        logger.info(f"Transcript saved in {len(saved_files)} formats")
        return saved_files


class BatchTranscriber:
    
    def __init__(self, 
                 model_size: str = "large-v3",
                 device: str = "auto",
                 language: str = "auto",
                 chunk_length_ms: int = 30000,
                 overlap_ms: int = 1000,
                 max_workers: int = 4):
        self.extractor = AudioExtractor()
        self.chunker = AudioChunker(chunk_length_ms, overlap_ms)
        self.transcriber = WhisperTranscriber(model_size, device, language=language)
        self.processor = TranscriptProcessor()
        self.max_workers = max_workers
        self.chunk_length_ms = chunk_length_ms
        self.overlap_ms = overlap_ms
    
    def transcribe_file(self, 
                       input_path: Union[str, Path],
                       output_dir: Union[str, Path],
                       filename_prefix: Optional[str] = None) -> Dict:
        input_path = Path(input_path)
        output_dir = Path(output_dir)
        
        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")
        
        start_time = time.time()
        logger.info(f"Starting transcription of {input_path.name}")
        
        try:
            # Extract audio if input is video
            if input_path.suffix.lower() in ['.mp4', '.avi', '.mov', '.mkv', '.webm']:
                logger.info("Detected video file, extracting audio...")
                audio_path = self.extractor.extract_audio(input_path, output_dir / "temp")
            else:
                audio_path = str(input_path)
            
            # Create audio chunks
            chunks = self.chunker.create_chunks(audio_path)
            
            # Calculate time offsets
            stride_ms = self.chunk_length_ms - self.overlap_ms
            offsets = [i * stride_ms / 1000.0 for i in range(len(chunks))]
            
            # Transcribe chunks in parallel
            logger.info(f"Transcribing {len(chunks)} chunks with {self.max_workers} workers...")
            results = []
            
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                # Submit all chunks
                future_to_chunk = {
                    executor.submit(
                        self.transcriber.transcribe_chunk,
                        chunk, i, offsets[i]
                    ): i for i, chunk in enumerate(chunks)
                }
                
                # Collect results as they complete
                for future in as_completed(future_to_chunk):
                    chunk_index = future_to_chunk[future]
                    try:
                        result = future.result()
                        results.append(result)
                        logger.debug(f"Completed chunk {chunk_index + 1}/{len(chunks)}")
                    except Exception as e:
                        logger.error(f"Error transcribing chunk {chunk_index}: {e}")
                        results.append({"index": chunk_index, "segments": [], "error": str(e)})
            
            # Process and merge results
            merged_segments = self.processor.merge_transcripts(results)
            formatted_transcript = self.processor.format_transcript(merged_segments)
            
            # Save transcript
            if filename_prefix is None:
                filename_prefix = input_path.stem
            
            saver = TranscriptSaver(output_dir)
            saved_files = saver.save_transcript(formatted_transcript, filename_prefix)
            
            # Calculate processing time
            processing_time = time.time() - start_time
            audio_duration = formatted_transcript["statistics"]["total_duration"]
            speed_factor = audio_duration / processing_time if processing_time > 0 else 0
            
            logger.info(f"Transcription completed in {processing_time:.2f}s")
            logger.info(f"Audio duration: {audio_duration:.2f}s")
            logger.info(f"Processing speed: {speed_factor:.2f}x real-time")
            
            return {
                "success": True,
                "transcript": formatted_transcript,
                "saved_files": saved_files,
                "statistics": {
                    **formatted_transcript["statistics"],
                    "processing_time": processing_time,
                    "speed_factor": speed_factor,
                    "chunks_processed": len(chunks),
                    "errors": len([r for r in results if "error" in r])
                }
            }
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "transcript": None,
                "saved_files": {},
                "statistics": {}
            }
        
        finally:
            # Cleanup temporary files
            self.chunker.cleanup_temp_files()



video_file = Path(__file__).parent.parent.parent / "assests" / "video" / "demo1.mp4"
output_dir = Path(__file__).parent.parent.parent / "transcripts"


transcriber = BatchTranscriber(
    model_size="large-v3",
    device="auto",
    language="auto",
    chunk_length_ms=30000,
    overlap_ms=1000,
    max_workers=4
)

try:
    print(f"🎬 Starting transcription of: {video_file.name}")
    result = transcriber.transcribe_file(video_file, output_dir)
    
    if result["success"]:
        print(f"✅ {video_file.name}: {result['statistics']['total_segments']} segments")
        print(f"   Processing time: {result['statistics']['processing_time']:.2f}s")
        print(f"   Speed factor: {result['statistics']['speed_factor']:.2f}x real-time")
        print(f"   Files saved:")
        for file_type, file_path in result['saved_files'].items():
            print(f"     - {file_type}: {file_path}")
    else:
        print(f"❌ {video_file.name}: {result['error']}")
        
except Exception as e:
    logger.error(f"Failed to process {video_file}: {e}")
    print(f"❌ Failed to process {video_file}: {e}")