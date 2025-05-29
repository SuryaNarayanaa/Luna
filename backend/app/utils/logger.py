import logging
import os

def setup_logger():
    log_level = os.getenv("LOG_LEVEL","INFO").upper()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

logger = logging.getLogger("luna")