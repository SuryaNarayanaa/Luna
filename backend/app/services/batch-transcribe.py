from faster_whisper import WhisperModel
import os
from pydub import AudioSegment
import tempfile
from concurrent.futures import ThreadPoolExecutor
import subprocess
import json

def extract_audio_from_video(video_path:str, output_path: str) -> str:
    os.makedirs(output_path, exist_ok=True)
    audio_output = os.path.join(output_path, "extracted_audio.wav")
    cmd = [
        "ffmpeg",
        "-i", video_path,      # input file
        "-vn",                 # no video
        "-acodec", "pcm_s16le",# audio codec (wav)
        "-ar", "44100",        # sample rate
        "-ac", "2",            # stereo audio
        audio_output
    ]
    subprocess.run(cmd, check=True)
    return audio_output

def chunk_audio(audio_path, chunk_length_ms=30000, overlap_ms=1000):
    audio = AudioSegment.from_wav(audio_path)
    chunks = []
    start = 0
    while start < len(audio):
        end = min(start + chunk_length_ms, len(audio))
        chunk = audio[start:end]
        chunks.append(chunk)
        start += chunk_length_ms - overlap_ms
    return chunks

model_size = "large-v3"
model = WhisperModel(model_size, device="cuda", compute_type="float16")

def transcribe_chunk(chunk, index, offset):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        chunk.export(f.name, format="wav")
        segments, _ = model.transcribe(f.name, beam_size=5)

        # Adjust each segment’s start/end by the `offset`
        adjusted = []
        for seg in segments:
            adjusted.append({
                "start": seg.start + offset,
                "end":   seg.end   + offset,
                "text":  seg.text
            })

        return {"index": index, "segments": adjusted}
    

def process_video(video_path, output_dir):
    audio_path = extract_audio_from_video(video_path, output_dir)
    chunks = chunk_audio(audio_path)

    # Compute time offsets per chunk
    stride_ms = 30000 - 1000  # chunk_length_ms - overlap_ms
    offsets = [i * stride_ms / 1000.0 for i in range(len(chunks))]

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [
            executor.submit(transcribe_chunk, chunk, i, offsets[i])
            for i, chunk in enumerate(chunks)
        ]
        results = [f.result() for f in futures]

    results.sort(key=lambda x: x["index"])
    full_transcript = []
    last_end = 0.0

    for res in results:
        for seg in res["segments"]:
            # Optional de-duplication: skip segments overlapping previous end
            if seg["start"] >= last_end:
                full_transcript.append(seg)
                last_end = seg["end"]

    return full_transcript

current_dir = os.path.dirname(os.path.abspath(__file__))

video_path = os.path.join(current_dir, "../../assests/video/demo1.mp4")
output_dir = os.path.join(current_dir, "../../assests/audio")
transcribe_path = os.path.join(current_dir, "../../assests/transcription")

os.makedirs(transcribe_path, exist_ok=True)

transcript = process_video(video_path, output_dir)
json_output_path = os.path.join(transcribe_path, "transcription.json")
with open(json_output_path, "w") as json_file:
    json.dump(transcript, json_file, indent=4)

print("Transcript saved to:", json_output_path)

