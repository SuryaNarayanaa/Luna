from fastapi import FastAPI
import uvicorn
from app.utils.logger import setup_logger,logger
# launcher.py at project root (LUNA/)
import sys
import os
import torch
# torch.cuda.empty_cache()       # Releases unreferenced memory back to CUDA
# torch.cuda.ipc_collect()
print(torch.version.cuda) 
print(torch.backends.cudnn.version()) 
print(torch.backends.cudnn.is_available())     

sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))
from app.services import tts_service


setup_logger()
logger.info("Starting backend")

app = FastAPI()

if __name__ == "__main__":
    uvicorn.run(app)