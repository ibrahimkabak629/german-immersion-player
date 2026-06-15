import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.translator import translate_segments

# Using the first 3 segments from our transcriber test
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

# Test at A1 level first
print("Testing translation at A1 level...\n")
result = translate_segments(test_segments, level="A1")

if result:
    print("\nRESULT:")
    for segment in result:
        print(f"[{segment['start']}s -> {segment['end']}s]")
        print(f"  English: {segment['original']}")
        print(f"  German:  {segment['translated']}")
        print()
else:
    print("Something went wrong!")