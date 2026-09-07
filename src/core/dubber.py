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

# Demucs source separation (background music/ambiance preservation).
DEMUCS_MODEL = "htdemucs"
# How much to attenuate the separated background track when mixing it back in
# under the new dubbed voice, so speech stays clearly in front. ~-10dB.
BACKGROUND_MIX_VOLUME = 0.32
_demucs_separator = None


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


def _extract_audio_range(audio_path: str, output_path: str, start: float, end: float) -> str | None:
    """Pulls a [start, end] slice out of an audio file, unmodified."""
    try:
        command = [
            "ffmpeg", "-y",
            "-ss", str(start),
            "-i", audio_path,
            "-t", str(max(end - start, 0.01)),
            output_path,
        ]
        subprocess.run(command, check=True, capture_output=True)
        return output_path
    except Exception as e:
        print(f"Error extracting audio range [{start}, {end}]: {e}")
        return None


def extract_speaker_sample(audio_path: str, turns: list, speaker: str, output_path: str, temp_dir: str, target_duration: float = VOICE_CLONE_SAMPLE_DURATION) -> str | None:
    """
    Builds a voice-cloning reference sample for one diarized speaker by
    concatenating their speaking turns - longest first - from the source
    audio until target_duration is covered or the speaker's turns run out.
    """
    try:
        speaker_turns = sorted(
            (t for t in turns if t["speaker"] == speaker),
            key=lambda t: t["end"] - t["start"],
            reverse=True,
        )
        if not speaker_turns:
            return None

        clip_paths = []
        covered = 0.0
        for i, turn in enumerate(speaker_turns):
            if covered >= target_duration:
                break
            clip_duration = min(turn["end"] - turn["start"], target_duration - covered)
            clip_path = os.path.join(temp_dir, f"speaker_{speaker}_clip_{i}.wav")
            if not _extract_audio_range(audio_path, clip_path, turn["start"], turn["start"] + clip_duration):
                continue
            clip_paths.append(clip_path)
            covered += clip_duration

        if not clip_paths:
            return None
        if len(clip_paths) == 1:
            os.replace(clip_paths[0], output_path)
            return output_path

        concat_list_path = os.path.join(temp_dir, f"speaker_{speaker}_concat.txt")
        with open(concat_list_path, "w", encoding="utf-8") as f:
            for clip_path in clip_paths:
                f.write(f"file '{os.path.abspath(clip_path)}'\n")

        command = [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0", "-i", concat_list_path,
            "-ac", "1", "-ar", "44100",
            output_path,
        ]
        subprocess.run(command, check=True, capture_output=True)
        return output_path

    except Exception as e:
        print(f"Error extracting voice sample for speaker {speaker}: {e}")
        return None


def clone_voices_for_speakers(audio_path: str, turns: list, speakers: set, temp_dir: str) -> tuple[dict[str, str | None], dict[str, str]]:
    """
    Clones one Fish Audio voice per confirmed speaker, keyed by diarization
    label. A speaker whose sample fails to extract or clone falls back to
    DEFAULT_REFERENCE_ID individually rather than failing the whole video.

    Returns (voice_ids, cloned_ids): voice_ids maps every speaker to the
    reference_id to dub them with (a real clone or the default fallback);
    cloned_ids maps only the speakers whose clone actually succeeded, for
    callers to clean up afterward.
    """
    voice_ids: dict[str, str | None] = {}
    cloned_ids: dict[str, str] = {}

    for speaker in sorted(speakers):
        sample_path = os.path.join(temp_dir, f"speaker_{speaker}_sample.wav")
        if not extract_speaker_sample(audio_path, turns, speaker, sample_path, temp_dir):
            print(f"Could not build a voice sample for speaker {speaker}, falling back to default voice")
            voice_ids[speaker] = DEFAULT_REFERENCE_ID
            continue

        model_id = create_voice_clone(sample_path, title=f"german-immersion-temp-voice-{speaker}")
        if model_id and wait_for_voice_clone_ready(model_id):
            voice_ids[speaker] = model_id
            cloned_ids[speaker] = model_id
        else:
            if model_id:
                delete_voice_clone(model_id)
            print(f"Voice cloning failed for speaker {speaker}, falling back to default voice")
            voice_ids[speaker] = DEFAULT_REFERENCE_ID

    return voice_ids, cloned_ids


def generate_dubbed_segments(
    segments: list,
    temp_dir: str,
    reference_id: str | None = DEFAULT_REFERENCE_ID,
    speaker_voice_ids: dict[str, str | None] | None = None,
    confirmed_speakers: set | None = None,
    original_vocals_path: str | None = None,
) -> list | None:
    """
    Generates German TTS audio for each translated segment and time-fits it
    to its segment's [start, end] window. Returns segments with an added
    'audio_path' pointing at the fitted clip.

    Multi-speaker mode (speaker_voice_ids given): each segment is voiced with
    its diarized speaker's own cloned voice instead of a single shared voice.
    A segment whose speaker isn't in confirmed_speakers - a diarization
    cluster too brief to be a real recurring speaker, more likely a sound
    effect or background voice - is left as a passthrough of the ORIGINAL
    vocal audio at that time range instead of being dubbed at all.
    """
    try:
        dubbed_segments = []
        multi_speaker_mode = speaker_voice_ids is not None

        for i, segment in enumerate(segments):
            print(f"Generating speech for segment {i + 1}/{len(segments)}...")

            speaker = segment.get("speaker")
            if multi_speaker_mode and confirmed_speakers is not None and speaker not in confirmed_speakers:
                if not original_vocals_path:
                    print(f"Segment {i + 1}: speaker {speaker!r} not confirmed and no original audio to pass through, skipping")
                    continue
                passthrough_path = os.path.join(temp_dir, f"segment_{i}_passthrough.wav")
                if not _extract_audio_range(original_vocals_path, passthrough_path, segment["start"], segment["end"]):
                    continue
                print(f"Segment {i + 1}: speaker {speaker!r} not confirmed, passing through original audio")
                dubbed_segments.append({**segment, "audio_path": passthrough_path})
                continue

            text = segment.get("translated") or segment.get("text")
            if not text:
                print(f"Segment {i + 1} has no text to synthesize, skipping")
                continue

            segment_reference_id = speaker_voice_ids.get(speaker, DEFAULT_REFERENCE_ID) if multi_speaker_mode else reference_id

            raw_path = os.path.join(temp_dir, f"segment_{i}_raw.mp3")
            if not generate_speech(text, raw_path, reference_id=segment_reference_id):
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

    Segments can come from different sources with different formats (Fish
    Audio TTS mp3s in multi-speaker mode, plus raw passthrough clips pulled
    straight from the original vocals track for unconfirmed speakers) - each
    is normalized to a common sample rate/channel layout before adelay/amix,
    which require matching formats across all inputs.
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
            filter_parts.append(f"[{i}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay={delay_ms}|{delay_ms}[a{i}]")
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


def _extract_audio_for_separation(video_path: str, output_path: str) -> str | None:
    """
    Pulls stereo 44.1kHz audio from the video for Demucs to work on.

    Deliberately separate from transcriber.extract_audio's 16kHz mono output:
    that's tuned for Whisper, which doesn't care about stereo or high
    frequencies, but Demucs is trained on full-bandwidth stereo music and
    would be starved of exactly the information (high frequencies, stereo
    imaging) it needs to cleanly separate music from voice if fed the
    downsampled mono file instead.
    """
    try:
        command = ["ffmpeg", "-y", "-i", video_path, "-vn", "-ac", "2", "-ar", "44100", output_path]
        subprocess.run(command, check=True, capture_output=True)
        return output_path
    except Exception as e:
        print(f"Error extracting audio for source separation: {e}")
        return None


def _get_demucs_separator():
    """Lazily loads the Demucs model (and downloads it on first use) so importing
    this module doesn't require torch/demucs or pull the model unless this
    feature is actually used."""
    global _demucs_separator
    if _demucs_separator is None:
        import torch
        from demucs.api import Separator

        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading Demucs source separation model ({DEMUCS_MODEL}) on {device}...")
        _demucs_separator = Separator(model=DEMUCS_MODEL, device=device)
    return _demucs_separator


def separate_vocals_and_background(video_path: str, temp_dir: str) -> tuple[str, str] | None:
    """
    Splits a video's audio into a vocals track and a background (music/
    ambiance) track using Demucs, so the background can be preserved and
    remixed under the new dubbed voice later, while only the vocals get
    transcribed and translated.

    Works best on instrumental background music/ambiance - a background
    track with its own lyrics, or dialogue-like sound effects, will bleed
    into one side or the other since Demucs only knows "voice vs. not
    voice", not "the specific voice we want".

    Returns (vocals_path, background_path), or None if Demucs isn't
    installed, the model can't be loaded/downloaded, or separation fails for
    any other reason - callers should fall back to the original full-audio
    pipeline in that case rather than blocking dubbing on this.
    """
    try:
        from demucs.api import save_audio

        full_audio_path = os.path.join(temp_dir, "separation_source.wav")
        if not _extract_audio_for_separation(video_path, full_audio_path):
            return None

        separator = _get_demucs_separator()

        print("Separating vocals from background music...")
        _, stems = separator.separate_audio_file(full_audio_path)

        if "vocals" not in stems:
            print(f"Demucs model didn't return a 'vocals' stem (got: {list(stems)})")
            return None

        background = None
        for name, wave in stems.items():
            if name == "vocals":
                continue
            background = wave if background is None else background + wave

        if background is None:
            print("Demucs model only produced a vocals stem, nothing to use as background")
            return None

        vocals_path = os.path.join(temp_dir, "vocals.wav")
        background_path = os.path.join(temp_dir, "background.wav")
        save_audio(stems["vocals"], vocals_path, separator.samplerate)
        save_audio(background, background_path, separator.samplerate)

        print("Vocal/background separation complete")
        return vocals_path, background_path

    except Exception as e:
        print(f"Source separation unavailable, falling back to full audio: {e}")
        return None


def mix_voice_with_background(voice_path: str, background_path: str, output_path: str) -> str | None:
    """
    Mixes the dubbed voice track over the preserved background track, ducking
    the background so the new speech stays clearly audible over it.

    The voice track (built from dubbed segments) is normally shorter than the
    background (which spans the whole original clip). ffmpeg's amix has a
    "duration=longest" option that's supposed to zero-pad shorter inputs, but
    it doesn't actually do that reliably - the shorter stream's last buffered
    audio keeps getting held open/looped for the rest of the mix instead of
    going silent (confirmed by testing: a short test tone bled through for the
    entire remaining duration). Explicitly padding the voice track to the
    background's exact length with apad first sidesteps amix's padding
    entirely, so there's nothing left for it to get wrong.
    """
    try:
        background_duration = get_audio_duration(background_path)
        if background_duration is None:
            return None

        command = [
            "ffmpeg", "-y",
            "-i", voice_path,
            "-i", background_path,
            "-filter_complex",
            f"[0:a]apad=whole_dur={background_duration:.3f}[voice];"
            f"[1:a]volume={BACKGROUND_MIX_VOLUME}[bg];"
            f"[voice][bg]amix=inputs=2:duration=first:normalize=0[out]",
            "-map", "[out]",
            output_path,
        ]
        subprocess.run(command, check=True, capture_output=True)
        print(f"Mixed dubbed voice with background track: {output_path}")
        return output_path

    except Exception as e:
        print(f"Error mixing voice with background: {e}")
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
            # "0:v:0" (not the bare "0:v") pins this to the video's first video
            # stream specifically. Plain "0:v" matches *every* video stream,
            # and many real-world MP4s carry a small embedded thumbnail as a
            # second "video" stream (disposition=attached_pic) - some players
            # then display that low-res cover art instead of the real footage,
            # which looks exactly like the video having been downscaled even
            # though the actual footage stream was never touched.
            "-map", "0:v:0",
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


def dub_video(
    video_path: str,
    segments: list,
    output_path: str,
    reference_id: str | None = None,
    clone_voice: bool = True,
    background_audio_path: str | None = None,
    speaker_turns: list | None = None,
    confirmed_speaker_labels: set | None = None,
    vocals_audio_path: str | None = None,
) -> str | None:
    """
    Full pipeline: translated segments -> German TTS -> synced audio track -> dubbed video.

    By default, clones the source video's own voice via Fish Audio and dubs with
    it, so any video comes out sounding like its original speaker. Pass an explicit
    reference_id to use a fixed voice instead (skips cloning), or clone_voice=False
    to force Fish Audio's default voice. If cloning fails or isn't available on the
    current plan, dubbing falls back to DEFAULT_REFERENCE_ID automatically.

    background_audio_path, when given (from separate_vocals_and_background,
    called earlier in the pipeline before transcription), is the original
    video's preserved background music/ambiance track. It gets mixed in under
    the new dubbed voice instead of the voice replacing the entire original
    audio. Leave it None to keep the original behavior of the dubbed voice
    being the only audio.

    speaker_turns/confirmed_speaker_labels (from diarizer.diarize_audio and
    diarizer.confirmed_speakers) switch on multi-speaker mode when more than
    one confirmed speaker is present: a separate voice is cloned per speaker
    and each segment is dubbed with its own speaker's voice, instead of one
    voice cloned from the whole video. vocals_audio_path (the isolated vocal
    track diarization ran on) supplies both the per-speaker cloning samples
    and the original-audio passthrough for segments whose speaker isn't
    confirmed. With 0 or 1 confirmed speakers, or reference_id/clone_voice
    already fixing the voice, this falls back to the original single-voice
    behavior untouched.
    """
    print(f"Dubbing video: {video_path}")

    with tempfile.TemporaryDirectory() as temp_dir:
        cloned_voice_ids: dict[str, str] = {}
        active_reference_id = reference_id
        speaker_voice_ids = None

        multi_speaker = bool(
            active_reference_id is None
            and clone_voice
            and speaker_turns
            and confirmed_speaker_labels
            and len(confirmed_speaker_labels) > 1
        )

        if multi_speaker:
            sample_source = vocals_audio_path or video_path
            speaker_voice_ids, cloned_voice_ids = clone_voices_for_speakers(
                sample_source, speaker_turns, confirmed_speaker_labels, temp_dir
            )
            print(f"Cloned {len(cloned_voice_ids)}/{len(confirmed_speaker_labels)} speaker voice(s): {sorted(cloned_voice_ids) or 'none'}")
        elif active_reference_id is None and clone_voice:
            cloned_voice_id = clone_voice_from_video(video_path, temp_dir)
            active_reference_id = cloned_voice_id or DEFAULT_REFERENCE_ID
            if cloned_voice_id:
                cloned_voice_ids["_single"] = cloned_voice_id
                print(f"Using cloned voice for dubbing: {cloned_voice_id}")
            else:
                print("Voice cloning unavailable, falling back to default voice")

        try:
            dubbed_segments = generate_dubbed_segments(
                segments,
                temp_dir,
                reference_id=active_reference_id,
                speaker_voice_ids=speaker_voice_ids,
                confirmed_speakers=confirmed_speaker_labels if multi_speaker else None,
                original_vocals_path=vocals_audio_path,
            )
            if not dubbed_segments:
                return None

            audio_track_path = os.path.join(temp_dir, "dubbed_audio.mp3")
            if not build_dubbed_audio_track(dubbed_segments, audio_track_path):
                return None

            final_audio_path = audio_track_path
            if background_audio_path:
                mixed_path = os.path.join(temp_dir, "dubbed_audio_with_background.mp3")
                mixed = mix_voice_with_background(audio_track_path, background_audio_path, mixed_path)
                if mixed:
                    final_audio_path = mixed
                else:
                    print("Background mix failed, using dubbed voice alone")

            if not mux_audio_with_video(video_path, final_audio_path, output_path):
                return None
        finally:
            for voice_id in cloned_voice_ids.values():
                delete_voice_clone(voice_id)

    return output_path
