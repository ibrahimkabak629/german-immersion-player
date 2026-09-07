import sys
import os
import subprocess
import tempfile
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

print("Testing POST /process-video end-to-end (trimmed clip) with live /progress updates...\n")
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
source_clip = os.path.join(project_root, "test_clip.mp4")

with tempfile.TemporaryDirectory() as temp_dir:
    trimmed_clip = os.path.join(temp_dir, "trimmed.mp4")
    subprocess.run(
        ["ffmpeg", "-y", "-i", source_clip, "-t", "15", "-c", "copy", trimmed_clip],
        check=True, capture_output=True,
    )

    with client.websocket_connect("/progress") as websocket:
        with open(trimmed_clip, "rb") as f:
            response = client.post(
                "/process-video",
                data={"level": "C2"},  # C2 skips the Groq adaptation call to keep this test fast
                files={"file": ("trimmed.mp4", f, "video/mp4")},
            )

        assert response.status_code == 200, response.text
        assert response.headers["content-type"] == "application/zip"

        zip_path = os.path.join(temp_dir, "result.zip")
        with open(zip_path, "wb") as f:
            f.write(response.content)

        with zipfile.ZipFile(zip_path) as zf:
            names = zf.namelist()
            assert "dubbed_video.mp4" in names
            assert "subtitles_dual.srt" in names
            print(f"Zip contents: {names}\n")

        expected_steps = {"extracting_audio", "transcribing", "diarizing", "translating", "dubbing", "syncing_subtitles", "done"}
        received_steps = set()
        for _ in range(len(expected_steps)):
            message = websocket.receive_json()
            received_steps.add(message["step"])

        assert expected_steps == received_steps, f"Missing steps: {expected_steps - received_steps}"
        print(f"Received progress steps: {received_steps}\n")

print("process-video + progress websocket test passed!\n")
print("All API tests passed!")
