import os

def format_timestamp(seconds: float) -> str:
    """
    Converts seconds to SRT timestamp format (HH:MM:SS,mmm)
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    milliseconds = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"


def generate_srt(segments: list, output_path: str) -> str | None:
    """
    Takes timestamped segments and generates a .srt subtitle file
    """
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            for i, segment in enumerate(segments, start=1):
                start = format_timestamp(segment["start"])
                end = format_timestamp(segment["end"])

                # Check if segment has translation or just original
                if "translated" in segment:
                    text = f"{segment['translated']}\n{segment['original']}"
                else:
                    text = segment["original"] if "original" in segment else segment["text"]

                f.write(f"{i}\n")
                f.write(f"{start} --> {end}\n")
                f.write(f"{text}\n\n")

        print(f"Subtitle file created: {output_path}")
        return output_path

    except Exception as e:
        print(f"Error generating subtitles: {e}")
        return None


def generate_dual_srt(segments: list, output_path: str) -> str | None:
    """
    Generates a dual language SRT with German on top, English below
    """
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            for i, segment in enumerate(segments, start=1):
                start = format_timestamp(segment["start"])
                end = format_timestamp(segment["end"])
                german = segment.get("translated", "")
                english = segment.get("original", segment.get("text", ""))

                f.write(f"{i}\n")
                f.write(f"{start} --> {end}\n")
                f.write(f"{german}\n")
                f.write(f"{english}\n\n")

        print(f"Dual subtitle file created: {output_path}")
        return output_path

    except Exception as e:
        print(f"Error generating dual subtitles: {e}")
        return None