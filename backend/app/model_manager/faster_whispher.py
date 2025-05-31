from faster_whisper import WhisperModel
from app.utils.logger import logger
import torch
from typing import Optional

class WhisperModelManager:
    _instance = None
    _model = None
    _model_config = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(WhisperModelManager, cls).__new__(cls)
        return cls._instance
    
    def load_model(self, model_size: str = "large-v3", device: str = "auto", compute_type: str = "auto") -> WhisperModel:
        current_config = (model_size, device, compute_type)
        if self._model is not None and self._model_config == current_config:
            logger.info(f"Reusing existing Whisper model: {model_size}")
            return self._model

        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        
        if compute_type == "auto":
            compute_type = "float16" if device == "cuda" else "float32"
        
        logger.info(f"Loading Whisper model '{model_size}' on {device} with {compute_type}")
        
        try:
            self._model = WhisperModel(
                model_size, 
                device=device, 
                compute_type=compute_type
            )
            self._model_config = current_config
            logger.info(f"Successfully loaded Whisper model: {model_size}")
            return self._model
            
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise
    
    def get_model(self) -> Optional[WhisperModel]:
        return self._model
    
    def is_loaded(self) -> bool:
        return self._model is not None
    
    def get_model_info(self) -> Optional[dict]:
        if self._model_config is None:
            return None
        
        model_size, device, compute_type = self._model_config
        return {
            "model_size": model_size,
            "device": device,
            "compute_type": compute_type
        }

model_manager = WhisperModelManager()