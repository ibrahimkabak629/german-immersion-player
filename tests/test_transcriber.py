import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.transcriber import transcribe_audio

audio_path = r"C:\Users\ibrah\OneDrive\Documents\Projects\temp_audio.wav"

result = transcribe_audio(audio_path)

if result:
    print("\n FULL TRANSCRIPTION:")
    print(result['text'])
    
    print(f"\n TOTAL SEGMENTS: {len(result['segments'])}")
    print("\n ALL SEGMENTS WITH TIMESTAMPS:")
    for segment in result['segments']:
        print(f"  [{segment['start']:.1f}s -> {segment['end']:.1f}s]: {segment['text']}")
else:
    print("Something went wrong!")