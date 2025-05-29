import os
import torch
import torchaudio
import logging
import langid
from faster_whisper import WhisperModel
import tempfile
langid.set_languages(['en', 'zh', 'ja'])

import numpy as np
from data.tokenizer import (
    AudioTokenizer,
    tokenize_audio,
)
from data.collation import get_text_token_collater
from utils.g2p import PhonemeBpeTokenizer

from macros import *

text_tokenizer = PhonemeBpeTokenizer(tokenizer_path="bpe_69.json")
text_collater = get_text_token_collater()

device = torch.device("cpu")
if torch.cuda.is_available():
    device = torch.device("cuda", 0)
if torch.backends.mps.is_available():
    device = torch.device("mps")
codec = AudioTokenizer(device)

# Initialize faster-whisper model
whisper_model = None

@torch.no_grad()
def transcribe_one(model, audio_path):
    # Use faster-whisper transcription
    segments, info = model.transcribe(audio_path, beam_size=5)
    
    # Get detected language
    detected_language = info.language
    print(f"Detected language: {detected_language}")
    
    # Extract text from segments
    text_segments = []
    for segment in segments:
        text_segments.append(segment.text)
    
    result_text = " ".join(text_segments).strip()
    print(result_text)

    text_pr = result_text
    if text_pr.strip(" ") and text_pr.strip(" ")[-1] not in "?!.,。，？！。、":
        text_pr += "."
    return detected_language, text_pr

def make_prompt(name, audio_prompt_path, transcript=None):
    global text_collater, text_tokenizer, codec
    wav_pr, sr = torchaudio.load(audio_prompt_path)
    # check length
    if wav_pr.size(-1) / sr > 15:
        raise ValueError(f"Prompt too long, expect length below 15 seconds, got {wav_pr.size(-1) / sr} seconds.")
    if wav_pr.size(0) == 2:
        wav_pr = wav_pr.mean(0, keepdim=True)
    text_pr, lang_pr = make_transcript(name, wav_pr, sr, transcript)

    # tokenize audio
    encoded_frames = tokenize_audio(codec, (wav_pr, sr))
    audio_tokens = encoded_frames[0][0].transpose(2, 1).cpu().numpy()

    # tokenize text
    phonemes, langs = text_tokenizer.tokenize(text=f"{text_pr}".strip())
    text_tokens, enroll_x_lens = text_collater(
        [
            phonemes
        ]
    )

    message = f"Detected language: {lang_pr}\n Detected text {text_pr}\n"

    # save as npz file - use simple relative path
    customs_dir = "./customs/"
    os.makedirs(customs_dir, exist_ok=True)
    save_path = os.path.join(customs_dir, f"{name}.npz")
    np.savez(save_path, audio_tokens=audio_tokens, text_tokens=text_tokens, lang_code=lang2code[lang_pr])
    logging.info(f"Successful. Prompt saved to {save_path}")
    
    return save_path


def make_transcript(name, wav, sr, transcript=None):
    if not isinstance(wav, torch.FloatTensor):
        wav = torch.tensor(wav)
    if wav.abs().max() > 1:
        wav /= wav.abs().max()
    if wav.size(-1) == 2:
        wav = wav.mean(-1, keepdim=False)
    if wav.ndim == 1:
        wav = wav.unsqueeze(0)
    assert wav.ndim and wav.size(0) == 1
    
    if transcript is None or transcript == "":
        logging.info("Transcript not given, using faster-whisper...")
        global whisper_model
        if whisper_model is None:
            # Initialize faster-whisper model
            model_size = "medium"
            compute_type = "float16" if torch.cuda.is_available() else "float32"
            whisper_model = WhisperModel(model_size, device="cuda" if torch.cuda.is_available() else "cpu", compute_type=compute_type)
        
        # Create temporary file for faster-whisper
        os.makedirs("./prompts/", exist_ok=True)
        temp_audio_path = f"./prompts/{name}.wav"
        torchaudio.save(temp_audio_path, wav, sr)
        
        lang, text = transcribe_one(whisper_model, temp_audio_path)
        lang_token = lang2token[lang]
        text = lang_token + text + lang_token
        os.remove(temp_audio_path)
    else:
        text = transcript
        lang, _ = langid.classify(text)
        lang_token = lang2token[lang]
        text = lang_token + text + lang_token

    torch.cuda.empty_cache()
    return text, lang
