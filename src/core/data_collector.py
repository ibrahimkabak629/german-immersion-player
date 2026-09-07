import json
import os
import hashlib
from datetime import datetime, timezone

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
DATASET_PATH = os.path.join(DATA_DIR, "cefr_training_data.jsonl")


def _anonymize_source(video_source: str | None) -> str | None:
    """Hashes a video source (e.g. filename/path) so raw identifiers never land in the dataset."""
    if not video_source:
        return None
    return hashlib.sha256(video_source.encode("utf-8")).hexdigest()[:16]


def record_translation(
    original_text: str,
    base_translation: str,
    level: str,
    adapted_text: str,
    video_source: str | None = None,
    dataset_path: str = DATASET_PATH,
) -> None:
    """
    Appends one English -> German translation + CEFR adaptation example to the
    local training dataset (JSONL, one record per line so it's append-only and
    safe to keep growing indefinitely). Never raises - a logging failure here
    should never break the translation pipeline that calls it.
    """
    try:
        os.makedirs(os.path.dirname(dataset_path), exist_ok=True)

        record = {
            "original_text": original_text,
            "base_translation": base_translation,
            "level": level,
            "adapted_text": adapted_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "video_source": _anonymize_source(video_source),
        }

        with open(dataset_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    except Exception as e:
        print(f"Error recording translation data: {e}")


def load_records(dataset_path: str = DATASET_PATH) -> list:
    """Reads back every recorded example, for inspection or dataset export."""
    if not os.path.exists(dataset_path):
        return []

    with open(dataset_path, "r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]
