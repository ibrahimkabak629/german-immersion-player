import whisper
import subprocess
import os

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


def transcribe_audio(audio_path: str, language: str = "en") -> dict | None:
    try:
        print("Loading Whisper model...")
        model = whisper.load_model("base")
        
        print("Transcribing audio...")
        result = model.transcribe(audio_path, language=language)
        
        print("Transcription complete!")
        return {
            "text": result["text"],
            "segments": result["segments"]
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
