import subprocess
import os
import math
import time
import groq
from dotenv import load_dotenv

load_dotenv()

CONFIDENCE_THRESHOLD = 0.6
GROQ_TRANSCRIPTION_MODEL = "whisper-large-v3"

_groq_client: groq.Groq | None = None


def _get_groq_client() -> groq.Groq:
    global _groq_client
    if _groq_client is None:
        _groq_client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _groq_client


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


def transcribe_audio(audio_path: str, language: str | None = None, max_retries: int = 3) -> dict | None:
    """
    Transcribes audio via Groq's hosted whisper-large-v3 API instead of
    running the model locally - same accuracy, but runs on Groq's GPUs
    instead of tying up the local CPU. language=None lets it auto-detect
    the spoken language instead of assuming English.
    """
    for attempt in range(1, max_retries + 1):
        try:
            print("Transcribing audio via Groq...")
            with open(audio_path, "rb") as f:
                kwargs = {
                    "model": GROQ_TRANSCRIPTION_MODEL,
                    "file": (os.path.basename(audio_path), f.read()),
                    "response_format": "verbose_json",
                    "timestamp_granularities": ["segment"],
                }
                if language:
                    kwargs["language"] = language

                result = _get_groq_client().audio.transcriptions.create(**kwargs)

            segments = []
            for segment in result.segments:
                confidence = _segment_confidence(segment)
                uncertain = confidence < CONFIDENCE_THRESHOLD
                if uncertain:
                    print(f"Low-confidence segment ({confidence:.2f}): {segment['text'].strip()!r}")
                segments.append({**segment, "confidence": confidence, "uncertain": uncertain})

            print("Transcription complete!")
            return {
                "text": result.text,
                "language": result.language,
                "segments": segments,
            }

        except (groq.InternalServerError, groq.APIConnectionError, groq.RateLimitError) as e:
            if attempt == max_retries:
                print(f"Error transcribing audio (giving up after {attempt} attempts): {e}")
                return None
            wait = 2 ** attempt
            print(f"Groq temporarily unavailable (attempt {attempt}/{max_retries}), retrying in {wait}s...")
            time.sleep(wait)
        except Exception as e:
            print(f"Error transcribing audio: {e}")
            return None


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
