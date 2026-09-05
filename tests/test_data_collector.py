import sys
import os
import tempfile

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.data_collector import record_translation, load_records, _anonymize_source

with tempfile.TemporaryDirectory() as temp_dir:
    dataset_path = os.path.join(temp_dir, "test_dataset.jsonl")

    print("Recording a few translation examples...\n")
    record_translation(
        original_text="Hi and welcome or welcome back.",
        base_translation="Hallo und herzlich willkommen oder willkommen zurück.",
        level="B1",
        adapted_text="Hallo und willkommen zurück.",
        video_source="test_clip.mp4",
        dataset_path=dataset_path,
    )
    record_translation(
        original_text="My name is Millie.",
        base_translation="Mein Name ist Millie.",
        level="A1",
        adapted_text="Ich heiße Millie.",
        video_source="test_clip.mp4",
        dataset_path=dataset_path,
    )
    record_translation(
        original_text="No video source this time.",
        base_translation="Diesmal keine Videoquelle.",
        level="C2",
        adapted_text="Diesmal keine Videoquelle.",
        dataset_path=dataset_path,
    )

    print("Reading records back...\n")
    records = load_records(dataset_path=dataset_path)

    assert len(records) == 3, f"Expected 3 records, got {len(records)}"

    first = records[0]
    for field in ("original_text", "base_translation", "level", "adapted_text", "timestamp", "video_source"):
        assert field in first, f"Missing field: {field}"

    assert first["original_text"] == "Hi and welcome or welcome back."
    assert first["level"] == "B1"
    assert first["video_source"] == _anonymize_source("test_clip.mp4"), "Video source should be anonymized (hashed)"
    assert first["video_source"] != "test_clip.mp4", "Raw filename must not be stored"

    assert records[2]["video_source"] is None, "Missing video source should stay None"

    print("RESULT:")
    for r in records:
        print(r)

    print("\nAll data_collector checks passed!")
