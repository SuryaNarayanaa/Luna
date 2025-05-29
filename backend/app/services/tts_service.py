from difflib import SequenceMatcher
import os
import sys
import numpy as np
import soundfile as sf
import tempfile
from pydub import AudioSegment
import json
import time

current_file = os.path.abspath(__file__)
project_root = os.path.abspath(os.path.join(current_file, "../../../.."))
sys.path.append(project_root)
sys.path.append(os.path.join(project_root, "backend/vall_e_x"))
sys.path.append(os.path.join(project_root, "backend"))

from app.utils.logger import setup_logger,logger as logging
from vall_e_x.utils.generation import SAMPLE_RATE, generate_audio, preload_models
from vall_e_x.utils.prompt_making import make_prompt
from scipy.io.wavfile import write as write_wav
from scipy.io import wavfile
from faster_whisper import WhisperModel

preload_models()
setup_logger()
model_size = "large-v3"
model = WhisperModel(model_size, device="cuda", compute_type="float16")

def synthesize_segment(text: str, target_duration: float, prompt_path: str) -> np.ndarray:
    logging.info(f"Synthesizing segment | Text: \"{text}\" | Target Duration: {target_duration:.2f}s")
    start_time = time.time()
    try:
        audio = generate_audio(text, prompt=prompt_path)
    except Exception as e:
        logging.exception(f"Error generating audio for text: '{text}'")
        raise
    duration = time.time() - start_time
    logging.info(f"Segment synthesized in {duration:.2f}s")

    target_samples = int(target_duration * SAMPLE_RATE)
    if audio.shape[0] < target_samples:
        audio = np.pad(audio, (0, target_samples - audio.shape[0]))
        logging.info(f"Padded audio to {target_duration:.2f}s")
    else:
        audio = audio[:target_samples]
        logging.info(f"Trimmed audio to {target_duration:.2f}s")

    return audio

def apply_diffs_with_vallex(original_wav_path: str, diffs: list) -> str:
    logging.info(f"🔁 Starting apply_diffs_with_vallex on {original_wav_path}")
    start_total = time.time()

    orig = AudioSegment.from_wav(original_wav_path)
    out = AudioSegment.empty()
    cursor_ms = 0

    prompt_duration_ms = 7000
    prompt = orig[:prompt_duration_ms]
    prompt_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    prompt.export(prompt_file.name, format="wav")
    prompt_path = prompt_file.name
    logging.info(f"---Speaker prompt extracted (0-{prompt_duration_ms}ms) → {prompt_path}")

    
    prompt_segments, _ = model.transcribe(prompt_path, beam_size=5)
    prompt_text = " ".join(seg.text.strip() for seg in prompt_segments)
    logging.info(f"Prompt transcript: \"{prompt_text[:60]}…\"")

    try:
        make_prompt(name=prompt_path, audio_prompt_path=prompt_path,transcript=prompt_text)
    except Exception as e:
        logging.error(f"Prompt creation failed: {e}")
        raise

    for i, diff in enumerate(diffs, 1):
        logging.info(f"--- Processing diff {i}/{len(diffs)} ---")
        start_ms = int(diff["start"] * 1000)
        end_ms = int(diff["end"] * 1000)
        out += orig[cursor_ms:start_ms]

        if diff["type"] == "remove":
            logging.info(f"---Removing audio from {start_ms}ms to {end_ms}ms---")
        elif diff["type"] in ("replace", "insert"):
            text = diff["new_text"]
            duration = (end_ms - start_ms) / 1000.0
            logging.info(f"---Diff Type: {diff['type']} | Text: \"{text}\" | Duration: {duration:.2f}s---")
            
            try:
                audio_np = synthesize_segment(text, duration, prompt_path)
                tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
                sf.write(tmp.name, audio_np, SAMPLE_RATE, subtype="PCM_16")
                segment = AudioSegment.from_wav(tmp.name)
                os.unlink(tmp.name)

                segment = segment.set_frame_rate(orig.frame_rate).set_channels(orig.channels)
                out += segment
                logging.info(f"🎙️ Inserted synthesized segment into output")
            except Exception:
                logging.error(f"⚠️ Skipping diff due to synthesis failure")
        else:
            logging.warning(f"⚠️ Unknown diff type: {diff['type']}")

        cursor_ms = end_ms

    out += orig[cursor_ms:]
    output_path = "./assests/audio/changed_audio.wav"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    out.export(output_path, format="wav")

    os.unlink(prompt_path)
    total_time = time.time() - start_total
    logging.info(f"--Done! Final audio saved to {output_path} in {total_time:.2f}s--")

    return output_path

def compute_diff_tree(original, edited, time_tolerance=0.5):
    diffs = []
    i, j = 0, 0
    while i < len(original) and j < len(edited):
        o, e = original[i], edited[j]
        if abs(o["start"] - e["start"]) < time_tolerance and abs(o["end"] - e["end"]) < time_tolerance:
            if o["text"] != e["text"]:
                diffs.append({
                    "start": o["start"],
                    "end": o["end"],
                    "type": "replace",
                    "new_text": e["text"]
                })
            i += 1
            j += 1

        elif o["end"] <= e["start"]:
            diffs.append({
                "start": o["start"],
                "end": o["end"],
                "type": "remove"
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
                "new_text": e["text"]
            })
            i += 1
            j += 1

    for k in range(i, len(original)):
        diffs.append({
            "start": original[k]["start"],
            "end": original[k]["end"],
            "type": "remove"
        })

    for k in range(j, len(edited)):
        diffs.append({
            "start": edited[k]["start"],
            "end": edited[k]["end"],
            "type": "insert",
            "new_text": edited[k]["text"]
        })

    return diffs
    
current_dir = os.path.dirname(os.path.abspath(__file__))

original_path = os.path.join(current_dir, "../../assests/transcription/transcription.json")
new_path = os.path.join(current_dir, "../../assests/transcription/newtranscripton.json")
original_wav_path = os.path.join(current_dir,"../../assests/audio/extracted_audio.wav")

with open(original_path, "r") as orig_file:
    original = json.load(orig_file)

with open(new_path, "r") as new_file:
    edited = json.load(new_file)

diff = compute_diff_tree(original, edited)
output_path = apply_diffs_with_vallex(original_wav_path,diff)

import platform
import subprocess

def play_audio(path):
    if platform.system() == "Linux":
        subprocess.call(["aplay", path])  # Or try 'paplay' or 'ffplay' if 'aplay' isn't available
    elif platform.system() == "Darwin":  # macOS
        subprocess.call(["afplay", path])
    elif platform.system() == "Windows":
        os.startfile(path)

#play_audio(output_path)
print(output_path)