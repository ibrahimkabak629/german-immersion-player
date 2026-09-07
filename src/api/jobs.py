import queue
import shutil
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Callable

# GPU-bound pipeline steps (Demucs separation, pyannote diarization, the
# local-Whisper fallback) all share one CUDA device, so running more than one
# job's GPU work at a time risks VRAM contention/OOM rather than any real
# speedup - one worker keeps jobs strictly sequential and safe. Bump this
# only on hardware with GPU headroom to spare for real concurrent work.
MAX_CONCURRENT_JOBS = 1

# How long a finished (done/error) job's status stays queryable after its
# result has been downloaded (or after failing) before being forgotten, so
# job records don't grow unbounded on a long-running server.
JOB_RETENTION_SECONDS = 3600


class JobStatus:
    QUEUED = "queued"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"


@dataclass
class Job:
    id: str
    status: str = JobStatus.QUEUED
    step: str | None = None
    error: str | None = None
    result_path: str | None = None
    temp_dir: str | None = None
    created_at: float = field(default_factory=time.time)
    finished_at: float | None = None


class JobManager:
    """
    A minimal FIFO job queue with a fixed pool of background worker threads -
    enough to let multiple people submit videos without one request blocking
    another or the server crashing under concurrent load, without pulling in
    external infrastructure (Celery/Redis) this app's scale doesn't need.

    Each job's own dict entry is only ever mutated by its own worker thread
    (or by download/cleanup code after it's finished), so the lock here
    guards the shared `_jobs` dict itself, not per-job field access.
    """

    def __init__(self, max_workers: int = MAX_CONCURRENT_JOBS):
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._queue: "queue.Queue[tuple[str, Callable[[Job], None]]]" = queue.Queue()
        for _ in range(max_workers):
            threading.Thread(target=self._worker_loop, daemon=True).start()

    def submit(self, run: Callable[[Job], None]) -> Job:
        """
        Enqueues `run` to be called with the new Job once a worker picks it
        up. `run` is responsible for calling update_step as it progresses
        and setting job.result_path when done; JobManager handles queuing,
        status transitions, and error capture around it.
        """
        job = Job(id=str(uuid.uuid4()))
        with self._lock:
            self._jobs[job.id] = job
        self._queue.put((job.id, run))
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            self._evict_expired()
            return self._jobs.get(job_id)

    def forget(self, job_id: str) -> None:
        with self._lock:
            self._jobs.pop(job_id, None)

    def queue_position(self, job_id: str) -> int | None:
        """1-based position among jobs still waiting (including this one), or None once it's no longer queued."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or job.status != JobStatus.QUEUED:
                return None
            queued = sorted(
                (j for j in self._jobs.values() if j.status == JobStatus.QUEUED),
                key=lambda j: j.created_at,
            )
            return next((i + 1 for i, j in enumerate(queued) if j.id == job_id), None)

    def update_step(self, job_id: str, step: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.step = step

    def _evict_expired(self) -> None:
        """
        Caller already holds _lock. A DONE job that's never downloaded (so
        _cleanup_job in main.py never ran) would otherwise leak its temp_dir
        on disk forever once its dict entry - the only reference to that
        path - is evicted, so this removes it here too. Harmless no-op for
        an ERROR job, whose temp_dir the worker already removed.
        """
        now = time.time()
        expired = [
            job_id
            for job_id, job in self._jobs.items()
            if job.finished_at is not None and now - job.finished_at > JOB_RETENTION_SECONDS
        ]
        for job_id in expired:
            job = self._jobs.pop(job_id)
            if job.temp_dir:
                shutil.rmtree(job.temp_dir, ignore_errors=True)

    def _worker_loop(self) -> None:
        while True:
            job_id, run = self._queue.get()
            job = self.get(job_id)
            if job is None:
                continue
            with self._lock:
                job.status = JobStatus.PROCESSING
            try:
                run(job)
                with self._lock:
                    job.status = JobStatus.DONE
                    job.finished_at = time.time()
            except Exception as e:
                with self._lock:
                    job.status = JobStatus.ERROR
                    job.error = str(e)
                    job.finished_at = time.time()
                if job.temp_dir:
                    shutil.rmtree(job.temp_dir, ignore_errors=True)


job_manager = JobManager()
