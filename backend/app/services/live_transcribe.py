# backend/app/services/streaming_asr.py

import sys
import os
import io
import time
import math
import json
import logging
import tempfile
import queue
import threading
from datetime import datetime
from functools import lru_cache
from argparse import ArgumentParser
import torch
import numpy as np
import soundfile as sf
import torchaudio
from pydub import AudioSegment
from faster_whisper import WhisperModel
import sounddevice as sd
from app.model_manager.faster_whispher import model_manager  
from app.utils.logger import setup_logger, logger 


SAMPLING_RATE = 16000  # fixed for online ASR

@lru_cache(maxsize=4)
def load_audio(path: str) -> np.ndarray:
    wav, sr = sf.read(path, dtype="float32")
    if sr != SAMPLING_RATE:
        wav = torchaudio.functional.resample(torch.from_numpy(wav), orig_freq=sr,
                                             new_freq=SAMPLING_RATE).numpy()
    if wav.ndim == 2:
        wav = wav.mean(axis=1)
    return wav

def load_audio_chunk(path: str, start_sec: float, end_sec: float) -> np.ndarray:
    full = load_audio(path)
    start_frame = int(start_sec * SAMPLING_RATE)
    end_frame = int(end_sec * SAMPLING_RATE)
    return full[start_frame:end_frame]

class ASRBase:
    """Abstract base class for ASR backends."""
    sep = ""

    def __init__(self, language: str, model_size: str, cache_dir: str = None, model_dir: str = None):
        if language.lower() == "auto":
            self.original_language = None
        else:
            self.original_language = language
        self.model = self.load_model(model_size, cache_dir, model_dir)

    def load_model(self, model_size, cache_dir, model_dir):
        raise NotImplementedError("Must implement load_model() in subclass")

    def transcribe(self, audio_np: np.ndarray, init_prompt: str = ""):
        raise NotImplementedError("Must implement transcribe() in subclass")

    def ts_words(self, segments):
        out = []
        for seg in segments:
            # Skip very low‐energy “no_speech”
            if hasattr(seg, "no_speech_prob") and seg.no_speech_prob > 0.9:
                continue
            for word in seg.words:
                out.append((word.start, word.end, word.word))
        return out

    def segments_end_ts(self, segments):
        return [s.end for s in segments]

    def use_vad(self):
        raise NotImplementedError("Only faster‐whisper supports VAD filter via parameters")


class FasterWhisperASR(ASRBase):
    sep = ""

    def load_model(self, model_size=None, cache_dir=None, model_dir=None):
       if model_dir is not None:
           # If using a custom model directory, load directly
           logger.info(f"Loading Faster‐Whisper model from directory: {model_dir}")
           return WhisperModel(model_dir, device="cuda", compute_type="float16", download_root=cache_dir)
       elif model_size is not None:
           # Use the shared model manager for standard models
           logger.info(f"Using shared Whisper model: {model_size}")
           return model_manager.load_model(
               model_size=model_size,
               device="auto",
               compute_type="auto"
           )
       else:
           raise ValueError("Either model_size or model_dir must be provided")
    def transcribe(self, audio_np: np.ndarray, init_prompt: str = ""):
        segments, info = self.model.transcribe(
            audio_np,
            language=self.original_language,
            initial_prompt=init_prompt,
            beam_size=5,
            word_timestamps=True,
            condition_on_previous_text=True
        )
        return list(segments)

    def use_vad(self):
        # faster‐whisper exposes a vad_filter arg you can toggle via transcribe_kargs
        # But for simplicity, we skip built‐in VAD. We rely on external VAD or time‐based chunking.
        pass


class HypothesisBuffer:
    """
    Maintains two internal buffers:
      - commited_in_buffer: words already “committed” (finalized)
      - buffer: the next hypotheses that have not been finalized yet
    Implements the “local agreement” policy: only flush words when we see their stable prefix repeated.
    """

    def __init__(self, logfile=sys.stderr):
        self.commited_in_buffer = []  # [(start, end, word), ...]
        self.buffer = []              # new hypotheses
        self.new = []                 # newly inserted before flush
        self.last_commited_time = 0
        self.last_commited_word = None
        self.logfile = logfile

    def insert(self, new_words, offset):
        """
        new_words: list of (start, end, word) with times relative to chunk
        offset: beginning offset in seconds of this chunk
        Shifts times by offset, then compares against buffer to find stable prefix.
        """
        # SHIFT the incoming words
        shifted = [(a + offset, b + offset, w) for (a, b, w) in new_words]
        self.new = [(a, b, w) for (a, b, w) in shifted if a > (self.last_commited_time - 0.1)]

        if not self.new:
            return

        # Remove duplicates at the boundary: if last committed words match prefix of new, drop them
        if self.commited_in_buffer:
            cn = len(self.commited_in_buffer)
            nn = len(self.new)
            max_ngram = min(min(cn, nn), 5)

            for i in range(1, max_ngram + 1):
                c = " ".join(self.commited_in_buffer[-j][2] for j in range(1, i + 1)[::-1])
                tail = " ".join(self.new[j - 1][2] for j in range(1, i + 1))
                if c == tail:
                    # drop those i words from new
                    dropped = self.new[:i]
                    self.new = self.new[i:]
                    logger.debug(f"Dropped {i} duplicate words: {dropped}")
                    break

    def flush(self):
        """
        Finds the longest common prefix between previously buffered words
        and the new words. Returns the list of finalized words [(start,end,word),...].
        """
        commit = []
        while self.new and self.buffer:
            na, nb, nw = self.new[0]
            oa, ob, ow = self.buffer[0]
            if nw == ow:
                # stable word → commit
                commit.append((na, nb, nw))
                self.last_commited_time = nb
                self.last_commited_word = nw
                self.new.pop(0)
                self.buffer.pop(0)
            else:
                break

        # anything left in new becomes future buffer
        self.buffer = self.new.copy()
        self.new = []
        self.commited_in_buffer.extend(commit)
        return commit

    def pop_commited(self, time_point):
        """
        Remove any committed words whose end time ≤ time_point
        (used when trimming the audio buffer).
        """
        self.commited_in_buffer = [
            w for w in self.commited_in_buffer if w[1] > time_point
        ]

    def complete(self):
        """Return all currently buffered (but not yet committed) words."""
        return self.buffer.copy()



class OnlineASRProcessor:
    """
    Buffers incoming float32 audio, runs faster-whisper every time we accumulate enough audio,
    and uses HypothesisBuffer to flush only stable words (local agreement).
    """

    def __init__(self, asr: FasterWhisperASR, buffer_trimming=("segment", 15), logfile=sys.stderr):
        """
        asr: an instance of FasterWhisperASR
        buffer_trimming: ("segment", seconds) or ("sentence", seconds)
        logfile: where to log
        """
        self.asr = asr
        self.tokenizer = None  # not used in segment‐only trimming
        self.logfile = logfile
        self.buffer_trimming_way, self.buffer_trimming_sec = buffer_trimming
        self.init()

    def init(self, offset: float = None):
        """Reset buffers. Call this at the start or after a chunk cut."""
        self.audio_buffer = np.zeros((0,), dtype=np.float32)
        self.transcript_buffer = HypothesisBuffer(logfile=self.logfile)
        self.buffer_time_offset = offset or 0.0
        self.transcript_buffer.last_commited_time = self.buffer_time_offset
        self.commited = []  # List of already committed words, in (start,end,word)

    def insert_audio_chunk(self, audio_chunk: np.ndarray):
        """Append new audio samples to buffer."""
        self.audio_buffer = np.concatenate((self.audio_buffer, audio_chunk), axis=0)

    def prompt(self) -> tuple[str, str]:
        """
        Returns:
          prompt_text: a <200‐character suffix of committed text
          non_prompt: leftover words inside buffer, used for logging only
        """
        k = len(self.commited) - 1
        # Find how many committed words are older than buffer_time_offset
        while k > 0 and self.commited[k - 1][1] > self.buffer_time_offset:
            k -= 1

        prefix_words = [w for (_, _, w) in self.commited[:k]]
        prompt = []
        length = 0
        # Build suffix until ~200 chars
        for w in reversed(prefix_words):
            if length + len(w) + 1 > 200:
                break
            prompt.append(w)
            length += len(w) + 1
        prompt_text = " ".join(reversed(prompt))

        # Non-prompt = committed words inside current buffer
        non_prompt = " ".join(w for (_, _, w) in self.commited[k:])

        return prompt_text, non_prompt

    def process_iter(self) -> (float, float, str):
        """
        Run faster‐whisper on the current audio buffer with the current prompt.
        Inserts word‐timestamps into HypothesisBuffer, flushes stable words, and
        returns ((beg, end, “concatenated stable words”) or (None,None,"") if nothing new).
        """
        # Build prompt & context for initial_prompt and logging
        prompt_text, non_prompt = self.prompt()
        logger.debug(f"PROMPT: \"{prompt_text}\"")
        logger.debug(f"CONTEXT: \"{non_prompt}\"")
        logger.debug(f"Transcribing {len(self.audio_buffer)/SAMPLING_RATE:.2f}s @ offset {self.buffer_time_offset:.2f}s")

        # Run ASR
        segments = self.asr.transcribe(self.audio_buffer, init_prompt=prompt_text)

        # Convert segments → word list
        word_list = self.asr.ts_words(segments)

        # Insert & flush stable words
        self.transcript_buffer.insert(word_list, self.buffer_time_offset)
        committed_now = self.transcript_buffer.flush()
        self.commited.extend(committed_now)

        # Any time we exceed buffer_trimming_sec, we cut
        buffer_len = len(self.audio_buffer) / SAMPLING_RATE
        if self.buffer_trimming_way == "segment":
            # find segment‐based cutoff:
            ends = self.asr.segments_end_ts(segments)
            if len(ends) > 1:
                # we pick second‐to‐last segment if it is ≤ last committed
                last_time = self.commited[-1][1] if self.commited else 0
                e = ends[-2] + self.buffer_time_offset
                if e <= last_time:
                    logger.debug(f"--- segment chunked at {e:.2f}s")
                    self.chunk_at(e)
        else:
            # sentence‐based trimming (not implemented fully)
            pass

        # Build the “flushed output”: (beg, end, text)
        if committed_now:            
            beg = committed_now[0][0]
            end = committed_now[-1][1]
            text = " ".join(w for (_, _, w) in committed_now)
            return (beg, end, text)
        else:
            return (None, None, "")

    def chunk_at(self, t: float):
        """
        Trim audio_buffer so that any audio ≤ t is dropped.
        Also drop any committed words ≤ t from HypothesisBuffer.
        """
        self.transcript_buffer.pop_commited(t)
        cut_samples = int((t - self.buffer_time_offset) * SAMPLING_RATE)
        if cut_samples > 0:
            self.audio_buffer = self.audio_buffer[cut_samples:]
            self.buffer_time_offset = t

    def finish(self) -> tuple[float, float, str]:
        """
        Flush any remaining buffered words at the end of the recording.
        """
        o = self.transcript_buffer.complete()
        if not o:
            return (None, None, "")
        text = " ".join(w for (_, _, w) in o)
        beg = o[0][0]
        end = o[-1][1]
        self.buffer_time_offset += len(self.audio_buffer) / SAMPLING_RATE
        return (beg, end, text)



class MicrophoneRecorder:
    """
    Records audio from microphone in real-time using sounddevice.
    """
    
    def __init__(self, sample_rate=SAMPLING_RATE, channels=1, chunk_duration=0.1):
        """
        sample_rate: Audio sample rate (16000 for Whisper)
        channels: Number of audio channels (1 for mono)
        chunk_duration: Duration of each audio chunk in seconds
        """
        if sd is None:
            raise ImportError("sounddevice is required for microphone recording. Install with: pip install sounddevice")
        
        self.sample_rate = sample_rate
        self.channels = channels
        self.chunk_size = int(sample_rate * chunk_duration)
        self.audio_queue = queue.Queue()
        self.recording = False
        
    def _audio_callback(self, indata, frames, time, status):
        """Callback function for sounddevice recording."""
        if status:
            logger.warning(f"Audio callback status: {status}")
        # Convert to mono float32 and put in queue
        audio_data = indata[:, 0] if self.channels == 1 else indata.mean(axis=1)
        self.audio_queue.put(audio_data.astype(np.float32))
    
    def start_recording(self):
        """Start recording from microphone."""
        self.recording = True
        self.stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            dtype=np.float32,
            blocksize=self.chunk_size,
            callback=self._audio_callback
        )
        self.stream.start()
        logger.info("Microphone recording started")
    
    def stop_recording(self):
        """Stop recording from microphone."""
        self.recording = False
        if hasattr(self, 'stream'):
            self.stream.stop()
            self.stream.close()
        logger.info("Microphone recording stopped")
    
    def get_audio_chunk(self):
        """Get the next audio chunk from the queue."""
        try:
            return self.audio_queue.get(timeout=1.0)
        except queue.Empty:
            return None


class TranscriptionSaver:
    """
    Handles saving transcriptions to files with timestamps.
    """
    
    def __init__(self, output_dir="transcriptions"):
        """
        output_dir: Directory to save transcription files
        """
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        # Create timestamped filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.txt_file = os.path.join(output_dir, f"transcription_{timestamp}.txt")
        self.json_file = os.path.join(output_dir, f"transcription_{timestamp}.json")
        
        # Initialize storage
        self.full_transcript = []
        self.segments = []
        
        logger.info(f"Transcription will be saved to: {self.txt_file}")
    
    def add_segment(self, start_time, end_time, text):
        """Add a transcribed segment."""
        if text.strip():  # Only add non-empty text
            segment = {
                "start": start_time,
                "end": end_time,
                "text": text.strip(),
                "timestamp": datetime.now().isoformat()
            }
            self.segments.append(segment)
            self.full_transcript.append(text.strip())
            
            # Append to text file immediately
            with open(self.txt_file, 'a', encoding='utf-8') as f:
                f.write(f"[{start_time:.2f}s - {end_time:.2f}s] {text.strip()}\n")
    
    def save_final(self):
        """Save the complete transcription to JSON file."""
        final_data = {
            "full_transcript": " ".join(self.full_transcript),
            "segments": self.segments,
            "total_segments": len(self.segments),
            "recording_date": datetime.now().isoformat()
        }
        
        with open(self.json_file, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Final transcription saved to: {self.json_file}")
        return final_data

def live_transcribe_microphone(
    model_size="large-v3",  # Changed default to match batch transcription
    language="auto", 
    min_chunk_duration=1.0,
    buffer_trim_seconds=15.0,
    output_dir="transcriptions",
    device="auto"
):
    """
    Perform live transcription from microphone input using shared model.
    """

    setup_logger()
    logger.info("Starting live microphone transcription...")
    
    # Check if model is already loaded
    if model_manager.is_loaded():
        model_info = model_manager.get_model_info()
        logger.info(f"Using existing model: {model_info}")

    try:
        logger.info(f"Initializing ASR with model '{model_size}'")
        asr = FasterWhisperASR(language=language, model_size=model_size)
        
        # Test model with dummy audio to warm up (only if not already warmed up)
        if not model_manager.is_loaded():
            dummy_audio = np.zeros(int(SAMPLING_RATE * 1.0), dtype=np.float32)
            asr.transcribe(dummy_audio)
            logger.info("Model loaded and warmed up successfully")
        else:
            logger.info("Model already warmed up, skipping dummy transcription")
        
    except Exception as e:
        logger.error(f"Failed to initialize ASR: {e}")
        raise
    
    
    # Initialize online processor
    online_processor = OnlineASRProcessor(
        asr,
        buffer_trimming=("segment", buffer_trim_seconds),
        logfile=sys.stderr
    )
    
    # Initialize microphone recorder
    try:
        recorder = MicrophoneRecorder(
            sample_rate=SAMPLING_RATE,
            channels=1,
            chunk_duration=0.1  # 100ms chunks
        )
    except ImportError as e:
        logger.error(f"Microphone setup failed: {e}")
        raise
    
    # Initialize transcription saver
    saver = TranscriptionSaver(output_dir)
    
    # Start recording
    recorder.start_recording()
    
    try:
        logger.info("Recording... Press Ctrl+C to stop")
        print("\n🎤 Recording started! Speak into your microphone...")
        print("📝 Transcription will appear below:")
        print("⏹️  Press Ctrl+C to stop recording\n")
        
        start_time = time.time()
        audio_buffer_duration = 0.0
        
        while True:
            # Get audio chunk from microphone
            audio_chunk = recorder.get_audio_chunk()
            if audio_chunk is None:
                continue
            
            # Add to processor
            online_processor.insert_audio_chunk(audio_chunk)
            audio_buffer_duration += len(audio_chunk) / SAMPLING_RATE
            
            # Process if we have enough audio
            if audio_buffer_duration >= min_chunk_duration:
                try:
                    result = online_processor.process_iter()
                    
                    if result and result[0] is not None:
                        start_ts, end_ts, text = result
                        
                        # Print to console
                        print(f"🗣️  [{start_ts:.1f}s-{end_ts:.1f}s] {text}")
                        
                        # Save to file
                        saver.add_segment(start_ts, end_ts, text)
                        
                except Exception as e:
                    logger.error(f"Error during transcription: {e}")
                    continue
            
            # Small sleep to prevent excessive CPU usage
            time.sleep(0.01)
            
    except KeyboardInterrupt:
        print("\n⏹️  Recording stopped by user")
        
    finally:
        # Stop recording
        recorder.stop_recording()
        
        # Process any remaining audio
        try:
            final_result = online_processor.finish()
            if final_result and final_result[0] is not None:
                start_ts, end_ts, text = final_result
                print(f"🗣️  [{start_ts:.1f}s-{end_ts:.1f}s] {text}")
                saver.add_segment(start_ts, end_ts, text)
        except Exception as e:
            logger.error(f"Error processing final audio: {e}")
        
        # Save final transcription
        final_data = saver.save_final()
        
        print(f"\n✅ Transcription completed!")
        print(f"📄 Text file: {saver.txt_file}")
        print(f"📊 JSON file: {saver.json_file}")
        print(f"📝 Total segments: {len(saver.segments)}")
        
        return saver


def output_transcript(o, logfile=sys.stderr, start_time=None):
    """
    Given (beg, end, text), print with timestamps relative to start_time.
    """
    if not o or o[0] is None:
        return
    now = (time.time() - start_time) if start_time else 0
    # Output format: emitted_ms, beg_ms, end_ms, text
    print(f"{now*1000:.1f} {o[0]*1000:.1f} {o[1]*1000:.1f} {o[2]}", file=logfile, flush=True)
    print(f"{now*1000:.1f} {o[0]*1000:.1f} {o[1]*1000:.1f} {o[2]}")


def main():
    setup_logger()
    parser = ArgumentParser(prog="live_transcibe.py", description="Live transcription using faster-whisper")
    parser.add_argument("--mode", type=str, choices=["live", "file"], default="live", help="Transcription mode: 'live' for microphone or 'file' for audio file")
    parser.add_argument("audio_path", type=str, nargs='?', help="Path to a 16kHz mono WAV file (only for file mode)")
    parser.add_argument("--model", type=str, default="base", help="Whisper model name or local path")
    parser.add_argument("--lan", type=str, default="auto", help="Language code for transcription")
    parser.add_argument("--min_chunk", type=float, default=1.0, help="Minimum chunk duration (seconds) before invoking ASR")
    parser.add_argument("--buffer_trim", type=float, default=15.0, help="Buffer length (s) before trimming via segment‐based policy")
    parser.add_argument("--output_dir", type=str, default="transcriptions", help="Directory to save transcription files")
    parser.add_argument("--use_vad", action="store_true", help="(✔️ Not implemented) Voice Activity Detection")
    args = parser.parse_args()

    if args.mode == "live":
        # Live microphone transcription
        logger.info("Starting live microphone transcription...")
        live_transcribe_microphone(
            model_size=args.model,
            language=args.lan,
            min_chunk_duration=args.min_chunk,
            buffer_trim_seconds=args.buffer_trim,
            output_dir=args.output_dir
        )
        return

    # File-based transcription (original functionality)
    if not args.audio_path:
        print("Error: audio_path is required for file mode")
        return

    # Load the entire WAV (cached)
    audio_path = args.audio_path
    full_audio = load_audio(audio_path)
    duration = len(full_audio) / SAMPLING_RATE
    logger.info(f"Audio duration: {duration:.2f}s")

    # Instantiate FasterWhisperASR
    asr = FasterWhisperASR(language=args.lan, model_size=args.model, cache_dir=None, model_dir=None)

    # Build online processor with segment trimming
    online = OnlineASRProcessor(
        asr,
        buffer_trimming=("segment", args.buffer_trim),
        logfile=sys.stderr
    )

    # Warm‐up (single‐chunk) to avoid the first‐call lag
    warmup = full_audio[: int(args.min_chunk * SAMPLING_RATE)]
    asr.transcribe(warmup)

    start_time = time.time()
    beg = 0.0
    end = 0.0

    # Simulate real‐time: push audio in steps of min_chunk
    while end < duration:
        time.sleep(max(0.01, args.min_chunk / 2))  # small sleep
        end = time.time() - start_time
        if end > duration:
            end = duration

        chunk = load_audio_chunk(audio_path, beg, end)
        online.insert_audio_chunk(chunk)
        beg = end

        # Process this chunk
        try:
            o = online.process_iter()
        except AssertionError as e:
            logger.error(f"AssertionError during process_iter: {e}")
            continue

        output_transcript(o, logfile=sys.stderr, start_time=start_time)

    # Final flush
    o = online.finish()
    output_transcript(o, logfile=sys.stderr, start_time=start_time)
    logger.info("Streaming transcription completed.")


if __name__ == "__main__":
    main()
