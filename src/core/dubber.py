import os
import subprocess
import tempfile
import requests
from dotenv import load_dotenv

load_dotenv()

FISH_AUDIO_API_KEY = os.getenv("FISH_AUDIO_API_KEY")
FISH_AUDIO_TTS_URL = "https://api.fish.audio/v1/tts"

# None uses Fish Audio's default voice; pass a reference_id to use a specific voice
DEFAULT_REFERENCE_ID = None
DEFAULT_MODEL = "s2.1-pro"


def generate_speech(text: str, output_path: str, reference_id: str | None = DEFAULT_REFERENCE_ID) -> str | None:
    try:
        headers = {
            "Authorization": f"Bearer {FISH_AUDIO_API_KEY}",
            "Content-Type": "application/json",
            "model": DEFAULT_MODEL,
        }

        payload = {
            "text": text,
            "format": "mp3",
            "mp3_bitrate": 128,
        }
        if reference_id:
            payload["reference_id"] = reference_id

        response = requests.post(FISH_AUDIO_TTS_URL, headers=headers, json=payload)
        response.raise_for_status()

        with open(output_path, "wb") as f:
            f.write(response.content)

        return output_path

    except Exception as e:
        print(f"Error generating speech: {e}")
        return None


def get_audio_duration(audio_path: str) -> float | None:
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                audio_path,
            ],
            capture_output=True, text=True, check=True,
        )
        return float(result.stdout.strip())
    except Exception as e:
        print(f"Error reading audio duration: {e}")
        return None


def _atempo_chain(speed: float) -> str:
    """
    ffmpeg's atempo filter only accepts factors between 0.5 and 2.0,
    so factors outside that range need to be chained across multiple atempo calls.
    """
    filters = []
    remaining = speed
    while remaining > 2.0:
        filters.append("atempo=2.0")
        remaining /= 2.0
    while remaining < 0.5:
        filters.append("atempo=0.5")
        remaining /= 0.5
    filters.append(f"atempo={remaining:.4f}")
    return ",".join(filters)


def fit_audio_to_duration(input_path: str, output_path: str, target_duration: float) -> str | None:
    """
    Time-stretches (or compresses) an audio clip so its duration matches
    target_duration, so dubbed speech lines up with its subtitle segment.
    """
    try:
        actual_duration = get_audio_duration(input_path)
        if actual_duration is None or actual_duration <= 0:
            return None

        speed = actual_duration / target_duration
        # Skip stretching when it's already close enough to avoid audible artifacts
        if abs(speed - 1.0) < 0.03:
            command = ["ffmpeg", "-y", "-i", input_path, "-c", "copy", output_path]
        else:
            command = [
                "ffmpeg", "-y", "-i", input_path,
                "-filter:a", _atempo_chain(speed),
                output_path,
            ]

        subprocess.run(command, check=True, capture_output=True)
        return output_path

    except Exception as e:
        print(f"Error fitting audio to duration: {e}")
        return None


def generate_dubbed_segments(segments: list, temp_dir: str, reference_id: str | None = DEFAULT_REFERENCE_ID) -> list | None:
    """
    Generates German TTS audio for each translated segment and time-fits it
    to its segment's [start, end] window. Returns segments with an added
    'audio_path' pointing at the fitted clip.
    """
    try:
        dubbed_segments = []

        for i, segment in enumerate(segments):
            print(f"Generating speech for segment {i + 1}/{len(segments)}...")

            text = segment.get("translated") or segment.get("text")
            if not text:
                print(f"Segment {i + 1} has no text to synthesize, skipping")
                continue

            raw_path = os.path.join(temp_dir, f"segment_{i}_raw.mp3")
            if not generate_speech(text, raw_path, reference_id=reference_id):
                return None

            target_duration = segment["end"] - segment["start"]
            fitted_path = os.path.join(temp_dir, f"segment_{i}_fitted.mp3")
            if not fit_audio_to_duration(raw_path, fitted_path, target_duration):
                return None

            dubbed_segments.append({**segment, "audio_path": fitted_path})

        print("All segments dubbed!")
        return dubbed_segments

    except Exception as e:
        print(f"Error generating dubbed segments: {e}")
        return None


def build_dubbed_audio_track(dubbed_segments: list, output_path: str) -> str | None:
    """
    Places each fitted segment clip at its start timestamp on a single
    audio track, using ffmpeg's adelay + amix filters.
    """
    try:
        if not dubbed_segments:
            print("No dubbed segments to mix")
            return None

        command = ["ffmpeg", "-y"]
        for segment in dubbed_segments:
            command += ["-i", segment["audio_path"]]

        filter_parts = []
        mix_inputs = []
        for i, segment in enumerate(dubbed_segments):
            delay_ms = int(segment["start"] * 1000)
            filter_parts.append(f"[{i}:a]adelay={delay_ms}|{delay_ms}[a{i}]")
            mix_inputs.append(f"[a{i}]")

        filter_complex = ";".join(filter_parts)
        filter_complex += f";{''.join(mix_inputs)}amix=inputs={len(dubbed_segments)}:duration=longest:normalize=0[out]"

        command += [
            "-filter_complex", filter_complex,
            "-map", "[out]",
            output_path,
        ]

        subprocess.run(command, check=True, capture_output=True)
        print(f"Dubbed audio track created: {output_path}")
        return output_path

    except Exception as e:
        print(f"Error building dubbed audio track: {e}")
        return None


def mux_audio_with_video(video_path: str, audio_path: str, output_path: str) -> str | None:
    try:
        # "-shortest" alone doesn't cut a copied video stream precisely — it only
        # stops at the next keyframe, which can overrun the audio by seconds.
        # Passing an explicit "-t" trims to an exact duration instead.
        video_duration = get_audio_duration(video_path)
        audio_duration = get_audio_duration(audio_path)
        if video_duration is None or audio_duration is None:
            return None
        target_duration = min(video_duration, audio_duration)

        command = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-i", audio_path,
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "copy",
            "-t", f"{target_duration:.3f}",
            output_path,
        ]
        subprocess.run(command, check=True, capture_output=True)
        print(f"Dubbed video created: {output_path}")
        return output_path

    except Exception as e:
        print(f"Error muxing audio with video: {e}")
        return None


def dub_video(video_path: str, segments: list, output_path: str, reference_id: str | None = DEFAULT_REFERENCE_ID) -> str | None:
    """
    Full pipeline: translated segments -> German TTS -> synced audio track -> dubbed video.
    """
    print(f"Dubbing video: {video_path}")

    with tempfile.TemporaryDirectory() as temp_dir:
        dubbed_segments = generate_dubbed_segments(segments, temp_dir, reference_id=reference_id)
        if not dubbed_segments:
            return None

        audio_track_path = os.path.join(temp_dir, "dubbed_audio.mp3")
        if not build_dubbed_audio_track(dubbed_segments, audio_track_path):
            return None

        if not mux_audio_with_video(video_path, audio_track_path, output_path):
            return None

    return output_path
