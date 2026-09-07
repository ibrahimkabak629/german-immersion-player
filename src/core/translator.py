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


def refine_translation_context(english_text: str, german_text: str, max_retries: int = 2) -> str:
    """
    DeepL sometimes translates slang, idioms, or context-dependent words too
    literally or in an uncommon sense. This reviews the pair and, when the
    English contains that kind of word, rewrites the German to the most
    common MODERN everyday usage instead. This is a best-effort quality pass,
    not a hard requirement - any failure just falls back to DeepL's own
    output rather than aborting the translation.
    """
    prompt = f"""You are reviewing a machine translation from English to German, checking
specifically for slang, idioms, or words with multiple possible meanings that
machine translation often gets wrong (too literal, or an uncommon/outdated sense).

English original: "{english_text}"
DeepL's German translation: "{german_text}"

If the English contains slang, an idiom, or a context-dependent word, and the German
translation uses an uncommon, overly literal, or outdated sense of it, rewrite just
that part using the most common MODERN everyday German usage a native speaker would
actually use in this context. Keep the rest of the sentence unchanged.

If the translation is already natural and correct, return it exactly as given.

Return ONLY the German text - no explanations, no notes, no quotation marks."""

    for attempt in range(1, max_retries + 1):
        try:
            response = get_groq_client().chat.completions.create(
                model=GROQ_ADAPTATION_MODEL,
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content.strip()

        except (groq.InternalServerError, groq.APIConnectionError, groq.RateLimitError) as e:
            if attempt == max_retries:
                print(f"Error refining translation context (keeping DeepL's output): {e}")
                return german_text
            wait = 2 ** attempt
            print(f"Model temporarily unavailable (attempt {attempt}/{max_retries}), retrying in {wait}s...")
            time.sleep(wait)
        except Exception as e:
            print(f"Error refining translation context (keeping DeepL's output): {e}")
            return german_text

    return german_text


def adapt_to_level(german_text: str, level: str, max_retries: int = 4) -> str | None:
    """
    Rewrites an already-correct German translation to match a target CEFR level.
    C2 needs no rewrite - DeepL's own output is already native-quality.
    """
    if level == "C2":
        return german_text

    level_desc = LEVEL_DESCRIPTIONS.get(level, LEVEL_DESCRIPTIONS["B1"])

    prompt = f"""You are adapting German text to a specific CEFR difficulty level. Follow these rules strictly:

1. NEVER change the meaning of the text.
2. NEVER add information, examples, or ideas that are not in the original.
3. NEVER remove or omit any information that is in the original.
4. ONLY adjust vocabulary complexity and sentence structure to match the target level.
5. Keep the same facts, names, numbers, and order of ideas as the original.
6. The result must express exactly the same content as the input - just written at a
   different difficulty level, not a different or expanded version of it.

Target level: {level} - {level_desc}.

Return ONLY the rewritten German text. No explanations, no notes, no quotation marks.

Original German text:
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

    refined_base = refine_translation_context(text, base)

    adapted = adapt_to_level(refined_base, level)
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

            translated_segment = {
                "start": segment["start"],
                "end": segment["end"],
                "original": segment["text"],
                "translated": translated_text
            }
            # Word timings belong to the English source audio, so they drive
            # highlighting of the original line (the German is a rewrite and
            # has no per-word timing of its own).
            if segment.get("words"):
                translated_segment["words"] = segment["words"]
            translated_segments.append(translated_segment)

        print("All segments translated!")
        return translated_segments

    except Exception as e:
        print(f"Error translating segments: {e}")
        return None
