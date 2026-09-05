import whisper
import subprocess
import os
import math

CONFIDENCE_THRESHOLD = 0.6

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


def transcribe_audio(audio_path: str, language: str | None = None) -> dict | None:
    try:
        print("Loading Whisper model...")
        model = whisper.load_model("large-v3")

        print("Transcribing audio...")
        # language=None lets Whisper auto-detect the spoken language instead
        # of assuming English.
        result = model.transcribe(audio_path, language=language)

        segments = []
        for segment in result["segments"]:
            confidence = _segment_confidence(segment)
            uncertain = confidence < CONFIDENCE_THRESHOLD
            if uncertain:
                print(f"Low-confidence segment ({confidence:.2f}): {segment['text'].strip()!r}")
            segments.append({**segment, "confidence": confidence, "uncertain": uncertain})

        print("Transcription complete!")
        return {
            "text": result["text"],
            "language": result.get("language"),
            "segments": segments,
        }
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
