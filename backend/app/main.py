from fastapi import FastAPI
import uvicorn
import warnings
import numpy as np
from app.utils.logger import setup_logger,logger
import sys
import os
import torch
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import json
from fastapi.middleware.cors import CORSMiddleware

# torch.cuda.empty_cache()     
# torch.cuda.ipc_collect()
print(torch.version.cuda) 
print(torch.backends.cudnn.version()) 
print(torch.backends.cudnn.is_available())     

sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))
from app.services import tts_service


setup_logger()
logger.info("Starting backend")

app = FastAPI()

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for video assets
app.mount("/assets", StaticFiles(directory="assests"), name="assets")

@app.get("/")
async def root():
    return {"message": "LUNA Backend API"}

@app.get("/video")
async def get_video():
    """Serve the demo video file"""
    video_path = os.path.join(os.path.dirname(__file__), "../assests/video/demo1.mp4")
    return FileResponse(video_path, media_type="video/mp4")

@app.get("/transcription/{filename}")
async def get_transcription(filename: str):
    """Get transcription data"""
    transcription_path = os.path.join(os.path.dirname(__file__), f"../assests/transcription/{filename}")
    
    if not os.path.exists(transcription_path):
        return {"error": "Transcription file not found"}
    
    with open(transcription_path, "r") as f:
        transcription_data = json.load(f)
    
    return {"transcription": transcription_data}

@app.get("/transcriptions")
async def list_transcriptions():
    """List available transcription files"""
    transcription_dir = os.path.join(os.path.dirname(__file__), "../assests/transcription")
    files = [f for f in os.listdir(transcription_dir) if f.endswith('.json')]
    return {"files": files}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)