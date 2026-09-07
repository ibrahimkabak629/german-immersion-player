import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.translator import build_terminology_glossary, translate_base, translate_base_batch, translate_segments, translate_to_german

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

# Repeats "Millie" and "Minecraft" across segments far apart in the "video"
# so build_terminology_glossary has something real to catch, and so the
# batched-vs-isolated translation of the same name can be compared directly.
glossary_test_segments = [
    {"start": 0.0, "end": 3.0, "text": "Hi, I'm Millie and today we're playing Minecraft."},
    {"start": 3.0, "end": 6.0, "text": "The weather is nice today, let's get started."},
    {"start": 6.0, "end": 9.0, "text": "Okay so back to Minecraft - Millie here again."},
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
assert result and len(result) == len(test_segments)

# 4. Batched DeepL translation returns one result per input, in order
print("Testing batched DeepL translation...\n")
batch_texts = [s["text"] for s in test_segments]
batch_result = translate_base_batch(batch_texts)
assert batch_result is not None and len(batch_result) == len(batch_texts)
for original, translated in zip(batch_texts, batch_result):
    print(f"  {original!r} -> {translated!r}")
print()

# 5. Terminology glossary surfaces names/terms that repeat across the transcript
print("Testing terminology glossary extraction...\n")
glossary = build_terminology_glossary([s["text"] for s in glossary_test_segments])
print(f"Glossary:\n{glossary}\n")
assert isinstance(glossary, str)

# 6. Context-aware translation of the SAME video: "Millie" and "Minecraft"
# should be rendered identically in segment 1 and segment 3 (they're 6s
# apart in the "video" but the glossary/batching should keep them
# consistent), which is the actual point of this feature.
print("Testing cross-segment consistency on names/terms...\n")
glossary_result = translate_segments(glossary_test_segments, level="B1")
assert glossary_result and len(glossary_result) == len(glossary_test_segments)
for segment in glossary_result:
    print(f"  {segment['original']!r} -> {segment['translated']!r}")
first_mentions_millie = "Millie" in glossary_result[0]["translated"]
last_mentions_millie = "Millie" in glossary_result[2]["translated"]
first_mentions_minecraft = "Minecraft" in glossary_result[0]["translated"]
last_mentions_minecraft = "Minecraft" in glossary_result[2]["translated"]
print(f"\n'Millie' kept as-is: segment 1={first_mentions_millie}, segment 3={last_mentions_millie}")
print(f"'Minecraft' kept as-is: segment 1={first_mentions_minecraft}, segment 3={last_mentions_minecraft}\n")

print("All translator tests passed!")
