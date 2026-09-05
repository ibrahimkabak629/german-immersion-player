import deepl
from google import genai
from google.genai.errors import ServerError
import os
import time
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

_deepl_client: deepl.Translator | None = None


def _get_deepl_client() -> deepl.Translator:
    global _deepl_client
    if _deepl_client is None:
        _deepl_client = deepl.Translator(os.getenv("DEEPL_API_KEY"))
    return _deepl_client


LEVEL_DESCRIPTIONS = {
    "A1": "very simple German, short sentences, only the most basic everyday words, like speaking to a complete beginner",
    "A2": "simple German, basic vocabulary, short clear sentences, beginner level",
    "B1": "intermediate German, everyday vocabulary, natural but not too complex sentences",
    "B2": "upper intermediate German, wider vocabulary, more natural flowing sentences",
    "C1": "advanced German, rich vocabulary, complex sentences, very natural sounding",
    "C2": "mastery level German, full natural native-like speech, no simplification"
}


def translate_base(text: str) -> str | None:
    """Accurate English -> German translation via DeepL."""
    try:
        result = _get_deepl_client().translate_text(text, source_lang="EN", target_lang="DE")
        return result.text
    except Exception as e:
        print(f"Error translating with DeepL: {e}")
        return None


def adapt_to_level(german_text: str, level: str, max_retries: int = 4) -> str | None:
    """
    Rewrites an already-correct German translation to match a target CEFR level.
    C2 needs no rewrite - DeepL's own output is already native-quality.
    """
    if level == "C2":
        return german_text

    level_desc = LEVEL_DESCRIPTIONS.get(level, LEVEL_DESCRIPTIONS["B1"])

    prompt = f"""Rewrite the following German text so it matches {level} level.

{level_desc}.

Keep the same meaning. Only return the rewritten German text, nothing else. No explanations, no notes.

German text:
{german_text}"""

    for attempt in range(1, max_retries + 1):
        try:
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt
            )
            return response.text.strip()

        except ServerError as e:
            if attempt == max_retries:
                print(f"Error adapting level (giving up after {attempt} attempts): {e}")
                return None
            wait = 2 ** attempt
            print(f"Model temporarily unavailable (attempt {attempt}/{max_retries}), retrying in {wait}s...")
            time.sleep(wait)
        except Exception as e:
            print(f"Error adapting level: {e}")
            return None


def translate_to_german(text: str, level: str = "B1") -> str | None:
    print(f"Translating to German at level {level}...")

    base = translate_base(text)
    if base is None:
        return None

    adapted = adapt_to_level(base, level)
    if adapted is None:
        return None

    print("Translation complete!")
    return adapted


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
