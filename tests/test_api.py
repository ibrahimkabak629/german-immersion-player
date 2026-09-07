import sys
import os
import subprocess
import tempfile
import time
import zipfile

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)

print("Testing GET /health...\n")
response = client.get("/health")
assert response.status_code == 200
assert response.json() == {"status": "ok"}
print("Health check passed!\n")

print("Testing POST /ask-tutor...\n")
response = client.post(
    "/ask-tutor",
    json={
        "german_text": "Hallo und herzlich willkommen zurück.",
        "question": "What does 'herzlich willkommen' mean?",
    },
)
assert response.status_code == 200, response.text
answer = response.json()["answer"]
assert len(answer) > 0
print(f"Tutor answer: {answer}\n")

print("Testing invalid /process-video requests are rejected...\n")
response = client.post("/process-video", data={"level": "B1"})
assert response.status_code == 400, "Should reject a request with neither file nor url"

response = client.post("/process-video", data={"level": "Z9"}, files={"file": ("x.mp4", b"fake", "video/mp4")})
assert response.status_code == 400, "Should reject an invalid CEFR level"
print("Validation checks passed!\n")

print("Testing /process-video rejects SSRF-style urls...\n")
for bad_url in [
    "http://169.254.169.254/latest/meta-data/",  # cloud metadata endpoint
    "http://127.0.0.1:8000/health",  # loopback
    "http://localhost/",  # loopback via hostname
    "http://10.0.0.5/video.mp4",  # private range
    "ftp://example.com/video.mp4",  # disallowed scheme
]:
    response = client.post("/process-video", data={"level": "B1", "url": bad_url})
    assert response.status_code == 400, f"Should reject SSRF-style url {bad_url!r}, got {response.status_code}"
print("SSRF checks passed!\n")

print("Testing GET /jobs/<unknown> returns 404...\n")
response = client.get("/jobs/does-not-exist")
assert response.status_code == 404
response = client.get("/jobs/does-not-exist/download")
assert response.status_code == 404
print("Unknown-job checks passed!\n")


def wait_for_job(job_id: str, timeout: float = 180) -> dict:
    deadline = time.time() + timeout
    last_status = None
    while time.time() < deadline:
        last_status = client.get(f"/jobs/{job_id}").json()
        if last_status["status"] in ("done", "error"):
            return last_status
        time.sleep(0.3)
    raise TimeoutError(f"Job {job_id} did not finish within {timeout}s (last status: {last_status})")


project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
source_clip = os.path.join(project_root, "test_clip.mp4")


def trim_clip(temp_dir: str, name: str, duration: float) -> str:
    out_path = os.path.join(temp_dir, name)
    subprocess.run(
        ["ffmpeg", "-y", "-i", source_clip, "-t", str(duration), "-c", "copy", out_path],
        check=True, capture_output=True,
    )
    return out_path


def clip_duration(path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
        check=True, capture_output=True, text=True,
    )
    return float(result.stdout.strip())


print("Testing POST /process-video end-to-end (trimmed clip) via the job queue...\n")
with tempfile.TemporaryDirectory() as temp_dir:
    trimmed_clip = trim_clip(temp_dir, "trimmed.mp4", 15)

    with open(trimmed_clip, "rb") as f:
        response = client.post(
            "/process-video",
            data={"level": "C2"},  # C2 skips the Groq adaptation call to keep this test fast
            files={"file": ("trimmed.mp4", f, "video/mp4")},
        )
    assert response.status_code == 200, response.text
    job_id = response.json()["job_id"]
    print(f"Submitted job {job_id}\n")

    # A job that isn't finished yet shouldn't be downloadable.
    early_download = client.get(f"/jobs/{job_id}/download")
    assert early_download.status_code == 409, f"Expected 409 for an in-progress job, got {early_download.status_code}"

    status = wait_for_job(job_id)
    assert status["status"] == "done", f"Job failed: {status.get('error')}"
    print(f"Job finished with status: {status}\n")

    response = client.get(f"/jobs/{job_id}/download")
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/zip"

    zip_path = os.path.join(temp_dir, "result.zip")
    with open(zip_path, "wb") as f:
        f.write(response.content)

    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        assert "dubbed_video.mp4" in names
        assert "subtitles_dual.srt" in names
        assert "segments.json" in names
        print(f"Zip contents: {names}\n")

    # The job is cleaned up (and forgotten) once its result has been downloaded.
    assert client.get(f"/jobs/{job_id}").status_code == 404, "Job should be forgotten after its result is downloaded"

print("process-video job queue test passed!\n")

print("Testing concurrent job submissions don't crash or mix data between jobs...\n")
with tempfile.TemporaryDirectory() as temp_dir:
    clip_a = trim_clip(temp_dir, "clip_a.mp4", 6)
    clip_b = trim_clip(temp_dir, "clip_b.mp4", 12)

    # Submission just persists the input and enqueues it - it doesn't wait
    # for the pipeline - so two back-to-back submissions already land both
    # jobs in the queue together, with job_a's actual processing still
    # running in its background worker thread when job_b is submitted.
    # That's the real property under test: multiple jobs in flight at once,
    # each with its own isolated temp dir, no cross-job interference.
    with open(clip_a, "rb") as f:
        resp_a = client.post("/process-video", data={"level": "C2"}, files={"file": ("clip_a.mp4", f, "video/mp4")})
    with open(clip_b, "rb") as f:
        resp_b = client.post("/process-video", data={"level": "C2"}, files={"file": ("clip_b.mp4", f, "video/mp4")})

    assert resp_a.status_code == 200, resp_a.text
    assert resp_b.status_code == 200, resp_b.text
    job_a, job_b = resp_a.json()["job_id"], resp_b.json()["job_id"]
    assert job_a != job_b, "Concurrent submissions must get distinct job ids"
    print(f"Submitted concurrently: job_a={job_a} (6s clip), job_b={job_b} (12s clip)\n")

    # With MAX_CONCURRENT_JOBS=1 (GPU safety), one of the two should still be
    # queued behind the other right after both are submitted - confirms the
    # queue is actually queuing rather than both jobs racing on shared state.
    statuses_immediately_after = {
        job_a: client.get(f"/jobs/{job_a}").json(),
        job_b: client.get(f"/jobs/{job_b}").json(),
    }
    print(f"Statuses right after submission: {statuses_immediately_after}\n")
    assert any(s["status"] == "queued" for s in statuses_immediately_after.values()), (
        "Expected at least one job to still be queued immediately after both were submitted"
    )

    status_a = wait_for_job(job_a)
    status_b = wait_for_job(job_b)
    assert status_a["status"] == "done", f"job_a failed: {status_a.get('error')}"
    assert status_b["status"] == "done", f"job_b failed: {status_b.get('error')}"

    dl_a = client.get(f"/jobs/{job_a}/download")
    dl_b = client.get(f"/jobs/{job_b}/download")
    assert dl_a.status_code == 200 and dl_b.status_code == 200

    zip_a_path = os.path.join(temp_dir, "result_a.zip")
    zip_b_path = os.path.join(temp_dir, "result_b.zip")
    with open(zip_a_path, "wb") as f:
        f.write(dl_a.content)
    with open(zip_b_path, "wb") as f:
        f.write(dl_b.content)

    with zipfile.ZipFile(zip_a_path) as zf:
        zf.extract("dubbed_video.mp4", os.path.join(temp_dir, "a"))
    with zipfile.ZipFile(zip_b_path) as zf:
        zf.extract("dubbed_video.mp4", os.path.join(temp_dir, "b"))

    duration_a = clip_duration(os.path.join(temp_dir, "a", "dubbed_video.mp4"))
    duration_b = clip_duration(os.path.join(temp_dir, "b", "dubbed_video.mp4"))
    print(f"job_a result duration: {duration_a:.1f}s (expected ~6s), job_b result duration: {duration_b:.1f}s (expected ~12s)\n")

    # Each job's downloaded result must match ITS OWN input, not the other
    # job's - this is the actual "no data mixing between jobs" check.
    assert abs(duration_a - 6) < 2, f"job_a's result duration {duration_a:.1f}s doesn't match its own 6s input - possible data mixing"
    assert abs(duration_b - 12) < 2, f"job_b's result duration {duration_b:.1f}s doesn't match its own 12s input - possible data mixing"

print("Concurrent job queue test passed - no crashes, no data mixing!\n")

print("All API tests passed!")
