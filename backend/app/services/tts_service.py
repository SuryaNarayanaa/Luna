from difflib import SequenceMatcher
import os
import sys
import numpy as np
import soundfile as sf
import tempfile
import librosa
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

    # Load original audio with librosa
    orig_audio, orig_sr = librosa.load(original_wav_path, sr=None)
    out_audio = np.array([])
    cursor_samples = 0

    prompt_duration_samples = int(7.0 * orig_sr)  # 7 seconds in samples
    prompt_audio = orig_audio[:prompt_duration_samples]
    
    # Save prompt audio
    prompt_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    sf.write(prompt_file.name, prompt_audio, orig_sr)
    prompt_audio_path = prompt_file.name
    prompt_file.close()  # Close the file before using it
    logging.info(f"---Speaker prompt extracted (0-7s) → {prompt_audio_path}")

    prompt_segments, _ = model.transcribe(prompt_audio_path, beam_size=5)
    prompt_text = " ".join(seg.text.strip() for seg in prompt_segments)
    logging.info(f"Prompt transcript: \"{prompt_text[:60]}…\"")

    # Generate a unique prompt name without extension
    import uuid
    prompt_name = f"prompt_{uuid.uuid4().hex[:8]}"
    
    # Create customs directory relative to the vall_e_x directory
    vall_e_x_dir = os.path.join(project_root, "backend", "vall_e_x")
    customs_dir = os.path.join(vall_e_x_dir, "customs")
    os.makedirs(customs_dir, exist_ok=True)
    
    try:
        # Change to vall_e_x directory before creating prompt
        original_cwd = os.getcwd()
        os.chdir(vall_e_x_dir)
        
        make_prompt(name=prompt_name, audio_prompt_path=prompt_audio_path, transcript=prompt_text)
        prompt_for_generation = prompt_name
        logging.info(f"Created prompt: {prompt_name}")
        
        # Change back to original directory
        os.chdir(original_cwd)
    except Exception as e:
        logging.error(f"Prompt creation failed: {e}")
        if 'original_cwd' in locals():
            os.chdir(original_cwd)
        raise

    for i, diff in enumerate(diffs, 1):
        logging.info(f"--- Processing diff {i}/{len(diffs)} ---")
        start_samples = int(diff["start"] * orig_sr)
        end_samples = int(diff["end"] * orig_sr)
        
        # Add audio from cursor to start of diff
        out_audio = np.concatenate([out_audio, orig_audio[cursor_samples:start_samples]])

        if diff["type"] == "remove":
            logging.info(f"---Removing audio from {diff['start']:.2f}s to {diff['end']:.2f}s---")
        elif diff["type"] in ("replace", "insert"):
            text = diff["new_text"]
            duration = diff["end"] - diff["start"]
            logging.info(f"---Diff Type: {diff['type']} | Text: \"{text}\" | Duration: {duration:.2f}s---")
            
            try:
                # Change to vall_e_x directory for generation
                original_cwd = os.getcwd()
                os.chdir(vall_e_x_dir)
                
                audio_np = synthesize_segment(text, duration, prompt_for_generation)
                
                # Change back to original directory
                os.chdir(original_cwd)
                
                # Resample if necessary to match original sample rate
                if SAMPLE_RATE != orig_sr:
                    audio_np = librosa.resample(audio_np, orig_sr=SAMPLE_RATE, target_sr=orig_sr)
                
                out_audio = np.concatenate([out_audio, audio_np])
                logging.info(f"🎙️ Inserted synthesized segment into output")
            except Exception as e:
                if 'original_cwd' in locals():
                    os.chdir(original_cwd)
                logging.error(f"⚠️ Skipping diff due to synthesis failure: {e}")
        else:
            logging.warning(f"⚠️ Unknown diff type: {diff['type']}")

        cursor_samples = end_samples

    # Add remaining audio
    out_audio = np.concatenate([out_audio, orig_audio[cursor_samples:]])
    
    # Save output
    output_path = "./assests/audio/changed_audio.wav"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    sf.write(output_path, out_audio, orig_sr)

    # Clean up temporary files - add small delay and error handling
    try:
        time.sleep(0.1)  # Small delay to ensure file is released
        os.unlink(prompt_audio_path)
    except PermissionError:
        logging.warning(f"Could not delete temporary audio file: {prompt_audio_path}")
    
    # Clean up the generated prompt file
    try:
        prompt_npz_path = os.path.join(customs_dir, f"{prompt_name}.npz")
        if os.path.exists(prompt_npz_path):
            os.unlink(prompt_npz_path)
    except Exception as e:
        logging.warning(f"Could not clean up prompt file: {e}")

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