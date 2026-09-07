import os

import torch
from dotenv import load_dotenv

load_dotenv()

HUGGINGFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN")
DIARIZATION_MODEL = "pyannote/speaker-diarization-3.1"

# A diarized speaker needs at least this much total speaking time across the
# video to be treated as a real recurring speaker worth cloning a voice for.
# pyannote's voice activity detection occasionally clusters a brief
# non-speech sound (a meme sound effect, a stray background voice) into its
# own "speaker" - anything that stays under this bar is left undubbed
# (original audio passthrough) rather than getting a voice clone of noise.
MIN_CONFIRMED_SPEAKER_DURATION = 2.0

_diarization_pipeline = None


def _get_diarization_pipeline():
    """Lazily loads the pyannote diarization pipeline (and downloads the
    gated models on first use) so importing this module doesn't require
    pyannote.audio or a HuggingFace token unless diarization is actually used."""
    global _diarization_pipeline
    if _diarization_pipeline is None:
        from pyannote.audio import Pipeline
        from pyannote.audio.pipelines import speaker_diarization as _sd

        # pyannote.audio 4.x's SpeakerDiarization pipeline unconditionally
        # eager-loads a PLDA scoring model in __init__, even though it's only
        # ever used by its VBxClustering option - the publicly released
        # speaker-diarization-3.1 checkpoint (loaded here) sets
        # clustering=AgglomerativeClustering, which never touches it. Its
        # default PLDA source is pyannote/speaker-diarization-community-1, a
        # separate gated repo unrelated to the speaker-diarization-3.1 /
        # segmentation-3.0 access this app actually needs, so a 403 there
        # would otherwise block loading a pipeline that doesn't need it.
        # Falling back to None when it's unavailable is safe for
        # AgglomerativeClustering; a config that does need VBxClustering
        # would then surface its own clear error at clustering time instead.
        _original_get_plda = _sd.get_plda

        def _get_plda_or_skip(plda, token=None, cache_dir=None):
            try:
                return _original_get_plda(plda, token=token, cache_dir=cache_dir)
            except Exception as e:
                print(f"PLDA scoring model unavailable, continuing without it (only needed by VBxClustering): {e}")
                return None

        _sd.get_plda = _get_plda_or_skip
        try:
            print(f"Loading speaker diarization model ({DIARIZATION_MODEL})...")
            _diarization_pipeline = Pipeline.from_pretrained(DIARIZATION_MODEL, token=HUGGINGFACE_TOKEN)
        finally:
            _sd.get_plda = _original_get_plda

        if torch.cuda.is_available():
            _diarization_pipeline.to(torch.device("cuda"))
    return _diarization_pipeline


def diarize_audio(audio_path: str) -> list[dict] | None:
    """
    Runs speaker diarization on an audio file (ideally the isolated vocals
    track, so background music doesn't confuse speaker embeddings) and
    returns who was talking and when as a list of
    {"speaker": str, "start": float, "end": float} turns.

    Returns None if pyannote.audio isn't installed, HUGGINGFACE_TOKEN is
    missing, the gated models haven't been accepted, or diarization fails
    for any other reason - callers should fall back to the existing
    single-voice dubbing behavior in that case rather than blocking on this.
    """
    if not HUGGINGFACE_TOKEN:
        print("HUGGINGFACE_TOKEN not set, skipping speaker diarization")
        return None

    try:
        import soundfile as sf

        pipeline = _get_diarization_pipeline()
        print("Running speaker diarization...")

        # pyannote.audio 4.x reads file paths via torchcodec, which needs
        # FFmpeg's shared libraries discoverable on the system - not a given
        # even where the ffmpeg CLI itself works fine (e.g. a static build,
        # as used elsewhere in this project). Loading the waveform directly
        # with soundfile and passing it as pyannote's documented
        # {"waveform", "sample_rate"} dict sidesteps torchcodec entirely.
        data, sample_rate = sf.read(audio_path, dtype="float32", always_2d=True)
        waveform = torch.from_numpy(data.T)  # (channel, time)

        output = pipeline({"waveform": waveform, "sample_rate": sample_rate})
        # pyannote.audio 4.x wraps the result in a DiarizeOutput dataclass
        # (the actual pyannote.core.Annotation lives on .speaker_diarization);
        # older versions returned the Annotation directly.
        annotation = getattr(output, "speaker_diarization", output)

        turns = [
            {"speaker": speaker, "start": turn.start, "end": turn.end}
            for turn, _, speaker in annotation.itertracks(yield_label=True)
        ]
        speakers = sorted({t["speaker"] for t in turns})
        print(f"Diarization found {len(speakers)} speaker(s): {', '.join(speakers) or 'none'}")
        return turns

    except Exception as e:
        print(f"Speaker diarization unavailable, falling back to single-voice dubbing: {e}")
        return None


def _overlap(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    return max(0.0, min(a_end, b_end) - max(a_start, b_start))


def assign_speakers_to_segments(segments: list, turns: list) -> list:
    """
    Labels each transcribed segment with whichever diarized speaker covers
    the most of its time span. If no turn overlaps a segment at all (Whisper
    and pyannote compute their timings independently, so boundaries can jitter
    by a few tens of milliseconds), the nearest turn in time is used instead -
    otherwise ordinary dialogue would fall through to the "unconfirmed
    speaker" passthrough path purely because of a rounding difference.
    """
    labeled = []
    for segment in segments:
        start, end = segment["start"], segment["end"]
        best_speaker, best_overlap = None, 0.0
        for turn in turns:
            overlap = _overlap(start, end, turn["start"], turn["end"])
            if overlap > best_overlap:
                best_speaker, best_overlap = turn["speaker"], overlap

        if best_speaker is None and turns:
            best_speaker = min(
                turns,
                key=lambda t: min(abs(t["start"] - end), abs(start - t["end"])),
            )["speaker"]

        labeled.append({**segment, "speaker": best_speaker})
    return labeled


def confirmed_speakers(turns: list, min_duration: float = MIN_CONFIRMED_SPEAKER_DURATION) -> set:
    """
    Returns the set of speaker labels that accumulate enough total speaking
    time to be treated as real recurring speakers, as opposed to a brief
    diarization cluster more likely to be a sound effect or background voice.
    """
    totals: dict[str, float] = {}
    for turn in turns:
        totals[turn["speaker"]] = totals.get(turn["speaker"], 0.0) + (turn["end"] - turn["start"])
    return {speaker for speaker, total in totals.items() if total >= min_duration}
