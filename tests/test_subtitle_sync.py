import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.transcriber import transcribe_audio
from src.core.subtitle_sync import generate_srt, generate_dual_srt

# Use our real audio file from before
audio_path = r"C:\Users\ibrah\OneDrive\Documents\Projects\temp_audio.wav"

# Get real transcription data
print("Loading real transcription data...")
result = transcribe_audio(audio_path)

if result:
    print(f"Got {len(result['segments'])} real segments!\n")

    # Convert to the format subtitle_sync expects
    segments = [
        {
            "start": seg["start"],
            "end": seg["end"],
            "original": seg["text"],
            "translated": f"[DE] {seg['text']}"  # placeholder until translator is ready
        }
        for seg in result["segments"]
    ]

    # Generate both SRT files
    generate_srt(segments, "test_output.srt")
    generate_dual_srt(segments, "test_output_dual.srt")

    # Print results
    print("\nSINGLE SRT:")
    with open("test_output.srt", "r", encoding="utf-8") as f:
        print(f.read())

    print("\nDUAL SRT:")
    with open("test_output_dual.srt", "r", encoding="utf-8") as f:
        print(f.read())
else:
    print("Transcription failed!")