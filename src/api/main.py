import json
import os
import shutil
import tempfile
import zipfile

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from src.core import dubber, subtitle_sync, transcriber, translator

app = FastAPI(title="German Immersion Player API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_LEVELS = set(translator.LEVEL_DESCRIPTIONS.keys())


class ProgressManager:
    """Broadcasts pipeline progress to every connected /progress client.

    Scoped for this app's actual usage (one person dubbing one video at a
    time) - a single shared channel, no per-job routing.
    """

    def __init__(self):
        self.connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.discard(websocket)

    async def broadcast(self, step: str, status: str) -> None:
        dead = set()
        for websocket in self.connections:
            try:
                await websocket.send_json({"step": step, "status": status})
            except Exception:
                dead.add(websocket)
        self.connections -= dead


progress_manager = ProgressManager()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/progress")
async def progress_socket(websocket: WebSocket):
    await progress_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        progress_manager.disconnect(websocket)


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


def _download_video(url: str, destination: str) -> None:
    response = requests.get(url, stream=True, timeout=30)
    response.raise_for_status()
    with open(destination, "wb") as f:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            f.write(chunk)


@app.post("/process-video")
async def process_video(
    file: UploadFile | None = File(None),
    url: str | None = Form(None),
    level: str = Form("B1"),
    preserve_background: bool = Form(True),
):
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

        await progress_manager.broadcast("extracting_audio", "in_progress")
        audio_path = await run_in_threadpool(
            transcriber.extract_audio, video_path, os.path.join(temp_dir, "audio.wav")
        )
        if not audio_path:
            raise HTTPException(status_code=500, detail="Audio extraction failed")

        # Vocals/background separation happens before transcription so only the
        # spoken voice gets transcribed and translated; the background track is
        # carried through untouched and remixed under the dubbed voice later.
        # Disabled, or on any failure (Demucs missing, model download failed,
        # separation error), this just falls back to the original single-track
        # pipeline - transcribing the full mixed audio, no background to mix back.
        transcription_audio_path = audio_path
        background_audio_path = None
        if preserve_background:
            separation = await run_in_threadpool(
                dubber.separate_vocals_and_background, video_path, temp_dir
            )
            if separation:
                transcription_audio_path, background_audio_path = separation

        await progress_manager.broadcast("transcribing", "in_progress")
        transcription = await run_in_threadpool(transcriber.transcribe_audio, transcription_audio_path)
        if not transcription:
            raise HTTPException(status_code=500, detail="Transcription failed")

        await progress_manager.broadcast("translating", "in_progress")
        translated_segments = await run_in_threadpool(
            translator.translate_segments, transcription["segments"], level, video_source
        )
        if not translated_segments:
            raise HTTPException(status_code=500, detail="Translation failed")

        await progress_manager.broadcast("dubbing", "in_progress")
        dubbed_video_path = os.path.join(temp_dir, "dubbed_video.mp4")
        dub_result = await run_in_threadpool(
            dubber.dub_video,
            video_path,
            translated_segments,
            dubbed_video_path,
            background_audio_path=background_audio_path,
        )
        if not dub_result:
            raise HTTPException(status_code=500, detail="Dubbing failed")

        await progress_manager.broadcast("syncing_subtitles", "in_progress")
        srt_path = os.path.join(temp_dir, "subtitles_dual.srt")
        srt_result = await run_in_threadpool(subtitle_sync.generate_dual_srt, translated_segments, srt_path)
        if not srt_result:
            raise HTTPException(status_code=500, detail="Subtitle generation failed")

        await progress_manager.broadcast("done", "complete")

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

        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename="dubbed_output.zip",
            background=BackgroundTask(shutil.rmtree, temp_dir, ignore_errors=True),
        )

    except HTTPException:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))
