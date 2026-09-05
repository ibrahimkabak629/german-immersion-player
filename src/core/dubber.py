import os
import subprocess
import tempfile
import time
import requests
from dotenv import load_dotenv

load_dotenv()

FISH_AUDIO_API_KEY = os.getenv("FISH_AUDIO_API_KEY")
FISH_AUDIO_BASE_URL = "https://api.fish.audio"
FISH_AUDIO_TTS_URL = f"{FISH_AUDIO_BASE_URL}/v1/tts"
FISH_AUDIO_MODEL_URL = f"{FISH_AUDIO_BASE_URL}/model"

# None uses Fish Audio's default voice; pass a reference_id to use a specific voice
DEFAULT_REFERENCE_ID = None
DEFAULT_MODEL = "s2.1-pro"

# s2.1-pro supports free-form [bracket] style/emotion tags placed at the start
# of the text. This matches the calm, quiet commentary style of the source video.
EMOTION_STYLE_TAG = "[calm][soft tone]"

VOICE_CLONE_SAMPLE_DURATION = 30.0
VOICE_CLONE_TRAIN_TIMEOUT = 60
VOICE_CLONE_POLL_INTERVAL = 3


def generate_speech(text: str, output_path: str, reference_id: str | None = DEFAULT_REFERENCE_ID, emotion_tag: str | None = EMOTION_STYLE_TAG) -> str | None:
    try:
        headers = {
            "Authorization": f"Bearer {FISH_AUDIO_API_KEY}",
            "Content-Type": "application/json",
            "model": DEFAULT_MODEL,
        }

        prompt_text = f"{emotion_tag} {text}" if emotion_tag else text
        payload = {
            "text": prompt_text,
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


MAX_TEMPO_ADJUSTMENT = 0.20  # cap atempo changes to +/-20% before speech starts sounding unnatural


def fit_audio_to_duration(input_path: str, output_path: str, target_duration: float) -> str | None:
    """
    Time-stretches (or compresses) an audio clip toward target_duration, so
    dubbed speech lines up with its subtitle segment.

    atempo alone was being pushed far outside a natural pace on segments with
    a big duration mismatch, making speech sound obviously sped up or slowed
    down. The tempo change is now capped at MAX_TEMPO_ADJUSTMENT; anything
    beyond that cap is absorbed as trailing silence (a natural pause) when the
    clip is still short of the target, or left to overrun slightly when it's
    still long - either is less jarring than an aggressive tempo change.

    atempo also shifts perceived loudness (speeding up raises it, slowing
    down drops it), so every segment is run through loudnorm afterward -
    applied to every segment, not just stretched ones, so unstretched
    segments end up at the same target loudness rather than standing out.
    """
    try:
        actual_duration = get_audio_duration(input_path)
        if actual_duration is None or actual_duration <= 0:
            return None

        raw_speed = actual_duration / target_duration
        speed = min(max(raw_speed, 1 - MAX_TEMPO_ADJUSTMENT), 1 + MAX_TEMPO_ADJUSTMENT)

        filters = []
        # Skip stretching when it's already close enough to avoid audible artifacts
        if abs(speed - 1.0) >= 0.03:
            filters.append(_atempo_chain(speed))
        filters.append("loudnorm=I=-16:TP=-1.5:LRA=11")
        # No-op if the clip (after the capped tempo change) already meets or
        # exceeds target_duration - only pads when capping left it short.
        filters.append(f"apad=whole_dur={target_duration:.3f}")

        command = [
            "ffmpeg", "-y", "-i", input_path,
            "-filter:a", ",".join(filters),
            output_path,
        ]

        subprocess.run(command, check=True, capture_output=True)
        return output_path

    except Exception as e:
        print(f"Error fitting audio to duration: {e}")
        return None


def extract_voice_sample(video_path: str, output_path: str, duration: float = VOICE_CLONE_SAMPLE_DURATION, start: float = 0.0) -> str | None:
    """Pulls a short mono audio clip from the source video to use as a voice-cloning reference."""
    try:
        command = [
            "ffmpeg", "-y",
            "-ss", str(start),
            "-i", video_path,
            "-t", str(duration),
            "-vn", "-ac", "1", "-ar", "44100",
            output_path,
        ]
        subprocess.run(command, check=True, capture_output=True)
        return output_path
    except Exception as e:
        print(f"Error extracting voice sample: {e}")
        return None


def create_voice_clone(sample_path: str, title: str = "german-immersion-temp-voice") -> str | None:
    """Uploads a voice sample to Fish Audio and returns the new model id, or None on failure."""
    try:
        with open(sample_path, "rb") as f:
            response = requests.post(
                FISH_AUDIO_MODEL_URL,
                headers={"Authorization": f"Bearer {FISH_AUDIO_API_KEY}"},
                data={"type": "tts", "title": title, "train_mode": "fast"},
                files={"voices": (os.path.basename(sample_path), f, "audio/wav")},
            )
        response.raise_for_status()

        model_id = response.json().get("_id")
        if not model_id:
            print("Voice clone response missing model id")
            return None

        print(f"Voice clone created: {model_id}, waiting for training...")
        return model_id

    except Exception as e:
        print(f"Error creating voice clone: {e}")
        return None


def wait_for_voice_clone_ready(model_id: str, timeout: int = VOICE_CLONE_TRAIN_TIMEOUT, poll_interval: int = VOICE_CLONE_POLL_INTERVAL) -> bool:
    """Polls a Fish Audio model until it reaches the 'trained' state, or gives up after timeout."""
    try:
        elapsed = 0
        while elapsed <= timeout:
            response = requests.get(
                f"{FISH_AUDIO_MODEL_URL}/{model_id}",
                headers={"Authorization": f"Bearer {FISH_AUDIO_API_KEY}"},
            )
            response.raise_for_status()
            state = response.json().get("state")

            if state == "trained":
                print("Voice clone training complete!")
                return True
            if state == "failed":
                print("Voice clone training failed")
                return False

            time.sleep(poll_interval)
            elapsed += poll_interval

        print(f"Voice clone did not finish training within {timeout}s")
        return False

    except Exception as e:
        print(f"Error polling voice clone status: {e}")
        return False


def delete_voice_clone(model_id: str) -> bool:
    """Removes a temporary cloned voice from Fish Audio after dubbing is done."""
    try:
        response = requests.delete(
            f"{FISH_AUDIO_MODEL_URL}/{model_id}",
            headers={"Authorization": f"Bearer {FISH_AUDIO_API_KEY}"},
        )
        response.raise_for_status()
        print(f"Voice clone deleted: {model_id}")
        return True
    except Exception as e:
        print(f"Error deleting voice clone {model_id}: {e}")
        return False


def clone_voice_from_video(video_path: str, temp_dir: str) -> str | None:
    """
    Extracts a voice sample from the video and clones it on Fish Audio.
    Returns the ready-to-use model id, or None if cloning isn't available
    (e.g. no credit, not supported on the current plan, or training failed) -
    callers should fall back to DEFAULT_REFERENCE_ID in that case.
    """
    sample_path = os.path.join(temp_dir, "voice_sample.wav")
    if not extract_voice_sample(video_path, sample_path):
        return None

    model_id = create_voice_clone(sample_path)
    if not model_id:
        return None

    if not wait_for_voice_clone_ready(model_id):
        delete_voice_clone(model_id)
        return None

    return model_id


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


def dub_video(video_path: str, segments: list, output_path: str, reference_id: str | None = None, clone_voice: bool = True) -> str | None:
    """
    Full pipeline: translated segments -> German TTS -> synced audio track -> dubbed video.

    By default, clones the source video's own voice via Fish Audio and dubs with
    it, so any video comes out sounding like its original speaker. Pass an explicit
    reference_id to use a fixed voice instead (skips cloning), or clone_voice=False
    to force Fish Audio's default voice. If cloning fails or isn't available on the
    current plan, dubbing falls back to DEFAULT_REFERENCE_ID automatically.
    """
    print(f"Dubbing video: {video_path}")

    with tempfile.TemporaryDirectory() as temp_dir:
        cloned_voice_id = None
        active_reference_id = reference_id

        if active_reference_id is None and clone_voice:
            cloned_voice_id = clone_voice_from_video(video_path, temp_dir)
            active_reference_id = cloned_voice_id or DEFAULT_REFERENCE_ID
            if cloned_voice_id:
                print(f"Using cloned voice for dubbing: {cloned_voice_id}")
            else:
                print("Voice cloning unavailable, falling back to default voice")

        try:
            dubbed_segments = generate_dubbed_segments(segments, temp_dir, reference_id=active_reference_id)
            if not dubbed_segments:
                return None

            audio_track_path = os.path.join(temp_dir, "dubbed_audio.mp3")
            if not build_dubbed_audio_track(dubbed_segments, audio_track_path):
                return None

            if not mux_audio_with_video(video_path, audio_track_path, output_path):
                return None
        finally:
            if cloned_voice_id:
                delete_voice_clone(cloned_voice_id)

    return output_path
