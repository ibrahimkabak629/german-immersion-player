import ipaddress
import json
import os
import shutil
import socket
import tempfile
import zipfile
from urllib.parse import urlparse

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from src.api.jobs import Job, JobStatus, job_manager
from src.core import diarizer, dubber, subtitle_sync, transcriber, translator

app = FastAPI(title="German Immersion Player API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_LEVELS = set(translator.LEVEL_DESCRIPTIONS.keys())


@app.get("/health")
async def health():
    return {"status": "ok"}


class AskTutorRequest(BaseModel):
    german_text: str
    question: str


class AskTutorResponse(BaseModel):
    answer: str


@app.post("/ask-tutor", response_model=AskTutorResponse)
async def ask_tutor(payload: AskTutorRequest):
    prompt = f"""You are a friendly, patient German tutor helping a beginner-to-intermediate
language learner who is watching a German-dubbed video with English subtitles.

The German subtitle line currently on screen is:
"{payload.german_text}"

The student asked:
"{payload.question}"

Answer in simple, clear English that a language learner can easily follow:
- If they're asking about a word or phrase, give its meaning, break it down piece by
  piece if that helps, and show how it's used in this specific line.
- If they're asking about grammar, name the grammar point in plain terms (e.g. "this
  is the accusative case") and briefly explain why it's used here - if you use a
  linguistic term, define it in one short phrase rather than assuming they know it.
- If they're asking about context or overall meaning, explain what the line is
  saying and why, in everyday language.
- Keep sentences short and concrete. Avoid dense jargon, long tangents, or covering
  more than what was asked.
- Keep the whole answer to a few short sentences - focused and easy to digest, not
  a lecture."""

    try:
        response = await run_in_threadpool(
            lambda: translator.get_groq_client().chat.completions.create(
                model=translator.GROQ_ADAPTATION_MODEL,
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
        )
        answer = response.choices[0].message.content.strip()
        return AskTutorResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tutor request failed: {e}")


def _save_upload(file: UploadFile, destination: str) -> None:
    with open(destination, "wb") as f:
        shutil.copyfileobj(file.file, f)


def _is_public_address(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def _assert_safe_url(url: str) -> None:
    """
    Blocks server-side request forgery: the video `url` a caller supplies is
    fetched by this server, so an unvalidated URL would let a caller reach
    cloud metadata endpoints, internal-only services, or other hosts this
    server can reach but the caller can't. Restricts to http(s), resolves
    the hostname, and rejects any resolved address that isn't publicly
    routable.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="url must use http or https")
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="url is missing a host")

    try:
        resolved = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="url host could not be resolved")

    addresses = {info[4][0] for info in resolved}
    if not addresses or not all(_is_public_address(ip) for ip in addresses):
        raise HTTPException(status_code=400, detail="url must point to a public address")


def _download_video(url: str, destination: str) -> None:
    _assert_safe_url(url)
    # Redirects are not followed: re-validating every hop (including
    # DNS-rebinding between check and connect) is more machinery than this
    # app's threat model needs, so a URL that redirects is simply rejected
    # rather than silently followed to an unvalidated destination.
    response = requests.get(url, stream=True, timeout=30, allow_redirects=False)
    if 300 <= response.status_code < 400:
        raise HTTPException(status_code=400, detail="url must not redirect")
    response.raise_for_status()
    with open(destination, "wb") as f:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            f.write(chunk)


def _run_pipeline(job: Job, video_path: str, video_source: str, level: str, preserve_background: bool, temp_dir: str) -> None:
    """
    The actual dubbing pipeline, run synchronously on a JobManager worker
    thread (not the event loop) - so plain blocking calls throughout, no
    run_in_threadpool/await needed. Raises on failure; JobManager catches it,
    marks the job errored, and cleans up temp_dir. Progress is reported by
    updating job.step rather than a broadcast, since each job now runs
    independently of any others in flight.
    """
    job_manager.update_step(job.id, "extracting_audio")
    audio_path = transcriber.extract_audio(video_path, os.path.join(temp_dir, "audio.wav"))
    if not audio_path:
        raise RuntimeError("Audio extraction failed")

    # Vocals/background separation happens before transcription so only the
    # spoken voice gets transcribed and translated; the background track is
    # carried through untouched and remixed under the dubbed voice later.
    # Disabled, or on any failure (Demucs missing, model download failed,
    # separation error), this just falls back to the original single-track
    # pipeline - transcribing the full mixed audio, no background to mix back.
    transcription_audio_path = audio_path
    background_audio_path = None
    if preserve_background:
        separation = dubber.separate_vocals_and_background(video_path, temp_dir)
        if separation:
            transcription_audio_path, background_audio_path = separation

    job_manager.update_step(job.id, "transcribing")
    transcription = transcriber.transcribe_audio(transcription_audio_path)
    if not transcription:
        raise RuntimeError("Transcription failed")

    # Speaker diarization runs on the same audio that was just transcribed
    # (the isolated vocals track when background separation succeeded,
    # otherwise the full extracted audio). On any failure (pyannote missing,
    # no/invalid HF token, gated models not accepted) this just falls back
    # to the existing single-voice dubbing below.
    job_manager.update_step(job.id, "diarizing")
    diarization_turns = diarizer.diarize_audio(transcription_audio_path)
    segments_with_speakers = transcription["segments"]
    confirmed_speaker_labels = None
    if diarization_turns:
        segments_with_speakers = diarizer.assign_speakers_to_segments(transcription["segments"], diarization_turns)
        confirmed_speaker_labels = diarizer.confirmed_speakers(diarization_turns)

    job_manager.update_step(job.id, "translating")
    translated_segments = translator.translate_segments(segments_with_speakers, level, video_source)
    if not translated_segments:
        raise RuntimeError("Translation failed")

    job_manager.update_step(job.id, "dubbing")
    dubbed_video_path = os.path.join(temp_dir, "dubbed_video.mp4")
    dub_result = dubber.dub_video(
        video_path,
        translated_segments,
        dubbed_video_path,
        background_audio_path=background_audio_path,
        speaker_turns=diarization_turns,
        confirmed_speaker_labels=confirmed_speaker_labels,
        vocals_audio_path=transcription_audio_path,
    )
    if not dub_result:
        raise RuntimeError("Dubbing failed")

    job_manager.update_step(job.id, "syncing_subtitles")
    srt_path = os.path.join(temp_dir, "subtitles_dual.srt")
    srt_result = subtitle_sync.generate_dual_srt(translated_segments, srt_path)
    if not srt_result:
        raise RuntimeError("Subtitle generation failed")

    # segments.json carries what SRT can't: per-word timings for word-level
    # subtitle highlighting. The SRT stays in the zip for download/portability.
    segments_path = os.path.join(temp_dir, "segments.json")
    with open(segments_path, "w", encoding="utf-8") as f:
        json.dump(translated_segments, f, ensure_ascii=False)

    zip_path = os.path.join(temp_dir, "dubbed_output.zip")
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.write(dubbed_video_path, "dubbed_video.mp4")
        zf.write(srt_path, "subtitles_dual.srt")
        zf.write(segments_path, "segments.json")

    job.result_path = zip_path
    job_manager.update_step(job.id, "done")


@app.post("/process-video")
async def process_video(
    file: UploadFile | None = File(None),
    url: str | None = Form(None),
    level: str = Form("B1"),
    preserve_background: bool = Form(True),
):
    """
    Persists the input video, then hands the rest of the pipeline to the job
    queue and returns immediately with a job_id - the caller polls
    GET /jobs/{job_id} for status/queue position and downloads the result
    from GET /jobs/{job_id}/download once done. This lets multiple people
    submit videos without one request blocking another or the server
    processing more jobs at once than the GPU can safely handle.
    """
    if not file and not url:
        raise HTTPException(status_code=400, detail="Provide either a file upload or a url")
    if file and url:
        raise HTTPException(status_code=400, detail="Provide only one of file or url, not both")
    if level not in VALID_LEVELS:
        raise HTTPException(status_code=400, detail=f"level must be one of {sorted(VALID_LEVELS)}")

    temp_dir = tempfile.mkdtemp(prefix="dub_job_")
    try:
        video_path = os.path.join(temp_dir, "input.mp4")
        if file:
            await run_in_threadpool(_save_upload, file, video_path)
            video_source = file.filename or "uploaded_video"
        else:
            await run_in_threadpool(_download_video, url, video_path)
            video_source = url
    except HTTPException:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))

    def run(job: Job) -> None:
        job.temp_dir = temp_dir
        _run_pipeline(job, video_path, video_source, level, preserve_background, temp_dir)

    job = job_manager.submit(run)
    return {"job_id": job.id}


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    step: str | None = None
    queue_position: int | None = None
    error: str | None = None


@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    job = job_manager.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        step=job.step,
        queue_position=job_manager.queue_position(job.id),
        error=job.error,
    )


def _cleanup_job(job_id: str) -> None:
    job = job_manager.get(job_id)
    if job and job.temp_dir:
        shutil.rmtree(job.temp_dir, ignore_errors=True)
    job_manager.forget(job_id)


@app.get("/jobs/{job_id}/download")
async def download_job_result(job_id: str):
    job = job_manager.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status == JobStatus.ERROR:
        raise HTTPException(status_code=500, detail=job.error or "Processing failed")
    if job.status != JobStatus.DONE or not job.result_path:
        raise HTTPException(status_code=409, detail="Job is not finished yet")

    return FileResponse(
        job.result_path,
        media_type="application/zip",
        filename="dubbed_output.zip",
        background=BackgroundTask(_cleanup_job, job_id),
    )
