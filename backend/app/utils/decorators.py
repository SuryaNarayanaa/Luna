from functools import wraps
from .logger import logger


def handle_exceptions(func):
    @wraps
    def wrapper(*args,**kwargs):
        try:
            return func(*args,**kwargs)
        except Exception as e: 
            logger.exception(f"Error in {func.__name__}: {e}")
            raise
    return wrapper