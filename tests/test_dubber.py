import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.translator import translate_segments
from src.core.dubber import dub_video

# Same 3 segments used in test_translator.py, trimmed to the first 20s of test_clip.mp4
test_segments = [
    {
        "start": 0.0,
        "end": 7.7,
        "text": "Hi and welcome or welcome back. My name is Millie and my channel is all about finding"
    },
    {
        "start": 7.7,
        "end": 13.6,
        "text": "comfort in video games. In this series we work on a Minecraft forever world. I have to"
    },
    {
        "start": 13.6,
        "end": 20.0,
        "text": "say it's very slow paced and I usually find myself chatting about whatever is on my mind."
    }
]

video_path = r"C:\Users\ibrah\OneDrive\Documents\Projects\test_clip.mp4"
output_path = r"C:\Users\ibrah\OneDrive\Documents\Projects\test_dubbed_output.mp4"

print("Translating segments to German...\n")
translated = translate_segments(test_segments, level="B1")

if not translated:
    print("Translation failed, aborting dubber test!")
    sys.exit(1)

for segment in translated:
    print(f"[{segment['start']}s -> {segment['end']}s] {segment['translated']}")

print("\nDubbing video...\n")
result = dub_video(video_path, translated, output_path)

if result:
    print(f"\nSuccess! Dubbed video written to: {result}")
else:
    print("\nSomething went wrong!")
