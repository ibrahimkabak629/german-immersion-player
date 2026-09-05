import deepl
import groq
import os
import time
from dotenv import load_dotenv

from .data_collector import record_translation

load_dotenv()

_deepl_client: deepl.Translator | None = None
_groq_client: groq.Groq | None = None


def _get_deepl_client() -> deepl.Translator:
    global _deepl_client
    if _deepl_client is None:
        _deepl_client = deepl.Translator(os.getenv("DEEPL_API_KEY"))
    return _deepl_client


def get_groq_client() -> groq.Groq:
    global _groq_client
    if _groq_client is None:
        _groq_client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _groq_client


GROQ_ADAPTATION_MODEL = "openai/gpt-oss-120b"

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
            response = get_groq_client().chat.completions.create(
                model=GROQ_ADAPTATION_MODEL,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content.strip()

        except (groq.InternalServerError, groq.APIConnectionError, groq.RateLimitError) as e:
            if attempt == max_retries:
                print(f"Error adapting level (giving up after {attempt} attempts): {e}")
                return None
            wait = 2 ** attempt
            print(f"Model temporarily unavailable (attempt {attempt}/{max_retries}), retrying in {wait}s...")
            time.sleep(wait)
        except Exception as e:
            print(f"Error adapting level: {e}")
            return None


def translate_to_german(text: str, level: str = "B1", video_source: str | None = None) -> str | None:
    print(f"Translating to German at level {level}...")

    base = translate_base(text)
    if base is None:
        return None

    adapted = adapt_to_level(base, level)
    if adapted is None:
        return None

    record_translation(text, base, level, adapted, video_source)

    print("Translation complete!")
    return adapted


def translate_segments(segments: list, level: str = "B1", video_source: str | None = None) -> list | None:
    try:
        translated_segments = []

        for i, segment in enumerate(segments):
            print(f"Translating segment {i+1}/{len(segments)}...")

            translated_text = translate_to_german(segment["text"], level, video_source)
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
