from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

LEVEL_DESCRIPTIONS = {
    "A1": "very simple German, short sentences, only the most basic everyday words, like speaking to a complete beginner",
    "A2": "simple German, basic vocabulary, short clear sentences, beginner level",
    "B1": "intermediate German, everyday vocabulary, natural but not too complex sentences",
    "B2": "upper intermediate German, wider vocabulary, more natural flowing sentences",
    "C1": "advanced German, rich vocabulary, complex sentences, very natural sounding",
    "C2": "mastery level German, full natural native-like speech, no simplification"
}

def translate_to_german(text: str, level: str = "B1") -> str | None:
    try:
        level_desc = LEVEL_DESCRIPTIONS.get(level, LEVEL_DESCRIPTIONS["B1"])
        
        print(f"Translating to German at level {level}...")
        
        prompt = f"""Translate the following English text to German at {level} level.

{level_desc}.

Only return the translated German text, nothing else. No explanations, no notes.

English text:
{text}"""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        
        translated = response.text.strip()
        print("Translation complete!")
        return translated
        
    except Exception as e:
        print(f"Error translating: {e}")
        return None


def translate_segments(segments: list, level: str = "B1") -> list | None:
    try:
        translated_segments = []
        
        for i, segment in enumerate(segments):
            print(f"Translating segment {i+1}/{len(segments)}...")
            
            translated_text = translate_to_german(segment["text"], level)
            if not translated_text:
                return None
                
            translated_segments.append({
                "start": segment["start"],
                "end": segment["end"],
                "original": segment["text"],
                "translated": translated_text
            })
        
        print("All segments translated!")
        return translated_segments
        
    except Exception as e:
        print(f"Error translating segments: {e}")
        return None