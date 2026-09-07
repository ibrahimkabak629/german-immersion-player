import subprocess
import os
import math
import time
import groq
import torch
import whisper
from dotenv import load_dotenv

load_dotenv()

CONFIDENCE_THRESHOLD = 0.6
GROQ_TRANSCRIPTION_MODEL = "whisper-large-v3"
LOCAL_WHISPER_MODEL = "large-v3"

_groq_client: groq.Groq | None = None
_local_whisper_model = None


def _get_groq_client() -> groq.Groq:
    global _groq_client
    if _groq_client is None:
        _groq_client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _groq_client


def _get_local_whisper_model():
    global _local_whisper_model
    if _local_whisper_model is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading local Whisper model ({LOCAL_WHISPER_MODEL}) on {device}...")
        _local_whisper_model = whisper.load_model(LOCAL_WHISPER_MODEL, device=device)
    return _local_whisper_model


def extract_audio(video_path: str, output_path: str = "temp_audio.wav") -> str | None:
    try:
        command = [
            "ffmpeg",
            "-i", video_path,
            "-ac", "1",
            "-ar", "16000",
            "-y",
            output_path
        ]
        subprocess.run(command, check=True, capture_output=True)
        print("Audio extracted successfully")
        return output_path
    except Exception as e:
        print(f"Error extracting audio: {e}")
        return None


def _segment_confidence(segment: dict) -> float:
    """
    Whisper doesn't expose a calibrated confidence score, so this approximates
    one as exp(avg_logprob) - the geometric mean of the segment's per-token
    probabilities, squashed into a rough 0-1 range.
    """
    return math.exp(segment.get("avg_logprob", 0.0))


def _normalize_words(raw_words) -> list | None:
    """
    Whisper's word timings come back as {word, start, end}. Returns a cleaned
    list, or None when the model didn't provide any - callers fall back to
    segment-level timing in that case.
    """
    if not raw_words:
        return None

    words = []
    for word in raw_words:
        if isinstance(word, dict):
            text, start, end = word.get("word"), word.get("start"), word.get("end")
        else:
            text, start, end = getattr(word, "word", None), getattr(word, "start", None), getattr(word, "end", None)

        if text is None or start is None or end is None:
            continue
        words.append({"word": str(text).strip(), "start": float(start), "end": float(end)})

    return words or None


def _attach_words_to_segments(segments: list, all_words: list | None) -> None:
    """
    Groq returns word timings for the whole audio rather than per segment, so
    each word is assigned to the segment whose time range contains its start.
    """
    if not all_words:
        return

    for segment in segments:
        start, end = segment.get("start"), segment.get("end")
        if start is None or end is None:
            continue
        segment["words"] = [w for w in all_words if start <= w["start"] < end]


def _build_segments(raw_segments, all_words: list | None = None) -> list:
    segments = []
    for segment in raw_segments:
        data = segment if isinstance(segment, dict) else dict(segment)
        confidence = _segment_confidence(data)
        uncertain = confidence < CONFIDENCE_THRESHOLD
        if uncertain:
            print(f"Low-confidence segment ({confidence:.2f}): {data['text'].strip()!r}")

        words = _normalize_words(data.get("words"))
        entry = {**data, "confidence": confidence, "uncertain": uncertain}
        if words:
            entry["words"] = words
        segments.append(entry)

    # Groq puts word timings at the top level; map them onto segments if the
    # segments themselves didn't already carry their own.
    if all_words and not any(s.get("words") for s in segments):
        _attach_words_to_segments(segments, _normalize_words(all_words))

    return segments


def _transcribe_via_groq(audio_path: str, language: str | None, max_retries: int) -> dict | None:
    """Transcribes via Groq's hosted whisper-large-v3 API - fast, no local GPU needed."""
    for attempt in range(1, max_retries + 1):
        try:
            print("Transcribing audio via Groq...")
            with open(audio_path, "rb") as f:
                kwargs = {
                    "model": GROQ_TRANSCRIPTION_MODEL,
                    "file": (os.path.basename(audio_path), f.read()),
                    "response_format": "verbose_json",
                    # Word timings drive per-word subtitle highlighting; segment
                    # granularity stays requested so segments are always present.
                    "timestamp_granularities": ["segment", "word"],
                }
                if language:
                    kwargs["language"] = language

                result = _get_groq_client().audio.transcriptions.create(**kwargs)

            print("Transcription complete!")
            all_words = getattr(result, "words", None)
            segments = _build_segments(result.segments, all_words)
            if any(s.get("words") for s in segments):
                print("Word-level timestamps available")
            else:
                print("No word-level timestamps returned - subtitles will use segment timing")

            return {
                "text": result.text,
                "language": result.language,
                "segments": segments,
            }

        except (groq.InternalServerError, groq.APIConnectionError, groq.RateLimitError) as e:
            if attempt == max_retries:
                print(f"Groq transcription failed after {attempt} attempts: {e}")
                return None
            wait = 2 ** attempt
            print(f"Groq temporarily unavailable (attempt {attempt}/{max_retries}), retrying in {wait}s...")
            time.sleep(wait)
        except Exception as e:
            print(f"Groq transcription failed: {e}")
            return None


def _transcribe_via_local_whisper(audio_path: str, language: str | None) -> dict | None:
    """
    Fallback used when Groq's API is unreachable or exhausted. Runs
    whisper-large-v3 on-device - the GPU when CUDA is available, otherwise
    CPU (much slower, but keeps transcription working without the API).
    """
    try:
        model = _get_local_whisper_model()
        print("Transcribing audio locally...")
        result = model.transcribe(audio_path, language=language, word_timestamps=True)

        print("Local transcription complete!")
        return {
            "text": result["text"],
            "language": result.get("language"),
            "segments": _build_segments(result["segments"]),
        }
    except Exception as e:
        print(f"Local transcription failed: {e}")
        return None


def transcribe_audio(audio_path: str, language: str | None = None, max_retries: int = 3) -> dict | None:
    """
    Transcribes audio via Groq's hosted whisper-large-v3 API, falling back
    to a local whisper-large-v3 model (GPU-accelerated when available) if
    Groq is unreachable or rate-limited. language=None lets it auto-detect
    the spoken language instead of assuming English.
    """
    result = _transcribe_via_groq(audio_path, language, max_retries)
    if result is not None:
        return result

    print("Falling back to local Whisper...")
    return _transcribe_via_local_whisper(audio_path, language)


def process_video(video_path: str) -> dict | None:
    print(f"Processing video: {video_path}")

    audio_path = extract_audio(video_path)
    if not audio_path:
        return None

    transcription = transcribe_audio(audio_path)
    if not transcription:
        return None

    if os.path.exists(audio_path):
        os.remove(audio_path)
        print("Temp audio file cleaned up")

    return transcription
