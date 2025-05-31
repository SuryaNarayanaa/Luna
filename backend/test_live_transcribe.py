#!/usr/bin/env python3
"""
Test script for live microphone transcription.
Run this to test the live transcription functionality.
"""

import sys
import os

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.services.live_transcribe import live_transcribe_microphone

def main():
    """Run live transcription test."""
    print("🎤 Live Transcription Test")
    print("=" * 50)
    
    # Test with basic settings
    try:
        result = live_transcribe_microphone(
        model_size="large-v3",  # Same model - will be reused
        language="auto",
        output_dir="live_transcriptions/"
        )
        
        print(f"\n✅ Transcription completed successfully!")
        print(f"📊 Total segments transcribed: {len(result.segments)}")
        
    except KeyboardInterrupt:
        print("\n⏹️  Test stopped by user")
    except Exception as e:
        print(f"\n❌ Error during transcription: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
