import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.translator import translate_base, translate_segments, translate_to_german

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

# 1. DeepL base translation on its own, no level adaptation
print("Testing DeepL base translation...\n")
base = translate_base(test_segments[0]["text"])
if base:
    print(f"English: {test_segments[0]['text']}")
    print(f"German (DeepL, unadapted): {base}\n")
else:
    print("DeepL base translation failed!\n")

# 2. Same sentence at both ends of the CEFR scale, to show the adaptation step working
print("Testing level adaptation (A1 vs C2) on one sentence...\n")
for level in ["A1", "C2"]:
    result = translate_to_german(test_segments[0]["text"], level=level)
    print(f"[{level}] {result}\n")

# 3. Full segment batch at B1, same shape the rest of the pipeline expects
print("Testing full segment translation at B1 level...\n")
result = translate_segments(test_segments, level="B1")

if result:
    print("\nRESULT:")
    for segment in result:
        print(f"[{segment['start']}s -> {segment['end']}s]")
        print(f"  English: {segment['original']}")
        print(f"  German:  {segment['translated']}")
        print()
else:
    print("Something went wrong!")
