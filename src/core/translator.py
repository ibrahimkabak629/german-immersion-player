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


GLOSSARY_MAX_TRANSCRIPT_CHARS = 20000


def translate_base(text: str) -> str | None:
    """Accurate English -> German translation via DeepL."""
    try:
        result = _get_deepl_client().translate_text(text, source_lang="EN", target_lang="DE")
        return result.text
    except Exception as e:
        print(f"Error translating with DeepL: {e}")
        return None


def translate_base_batch(texts: list[str]) -> list[str] | None:
    """
    Translates every segment's text in a single DeepL call instead of one
    call per segment. DeepL's list-translate endpoint sees the whole batch
    as one job, which renders recurring names/terms far more consistently
    across segments than isolated per-sentence calls would - the same name
    translated in segment 1 is much less likely to drift by segment 20.
    """
    if not texts:
        return []
    try:
        results = _get_deepl_client().translate_text(texts, source_lang="EN", target_lang="DE")
        return [r.text for r in results]
    except Exception as e:
        print(f"Error batch-translating with DeepL: {e}")
        return None


def build_terminology_glossary(texts: list[str], max_retries: int = 2) -> str:
    """
    One-shot pass over the full English transcript that surfaces recurring
    proper nouns, specific terms, and phrases so their German rendering can
    be pinned down and reused by every segment's refinement/adaptation pass
    below - the cheap way to get full-video consistency without resending
    the entire transcript on every one of a video's N segment calls.

    Returns a compact "English -> German" glossary as plain text, or "" if
    there's nothing worth pinning down or the pass fails - callers should
    proceed without it in either case rather than block translation on this.
    """
    full_text = " ".join(t.strip() for t in texts if t.strip())
    if not full_text:
        return ""
    if len(full_text) > GLOSSARY_MAX_TRANSCRIPT_CHARS:
        full_text = full_text[:GLOSSARY_MAX_TRANSCRIPT_CHARS]

    prompt = f"""You are preparing a terminology glossary to keep an English-to-German
translation consistent across an entire video's subtitles, which will be translated
segment by segment rather than all at once.

Read the full English transcript below and identify recurring proper nouns (people's
names, place names, brand/product names), specific technical or domain terms, and
repeated phrases that MUST be rendered the same way every single time they appear -
not recurring common words, and not anything that only appears once.

For each one, give the single German rendering to use consistently throughout (many
names should simply stay unchanged - only list a German form when one is actually
needed).

Full transcript:
\"\"\"
{full_text}
\"\"\"

Return ONLY a compact list, one per line, formatted exactly as:
English term -> German rendering

If there is nothing worth pinning down, return nothing at all. Do not include ordinary
words, and do not include anything that appears only once in the transcript."""

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
                print(f"Error building terminology glossary (continuing without it): {e}")
                return ""
            wait = 2 ** attempt
            print(f"Model temporarily unavailable (attempt {attempt}/{max_retries}), retrying in {wait}s...")
            time.sleep(wait)
        except Exception as e:
            print(f"Error building terminology glossary (continuing without it): {e}")
            return ""

    return ""


def refine_translation_context(english_text: str, german_text: str, glossary: str = "", max_retries: int = 2) -> str:
    """
    DeepL sometimes translates slang, idioms, or context-dependent words too
    literally or in an uncommon sense. This reviews the pair and, when the
    English contains that kind of word, rewrites the German to the most
    common MODERN everyday usage instead. This is a best-effort quality pass,
    not a hard requirement - any failure just falls back to DeepL's own
    output rather than aborting the translation.

    glossary, when non-empty (see build_terminology_glossary), pins down how
    recurring names/terms from elsewhere in the video should be rendered, so
    this pass doesn't second-guess a term into a different-but-also-valid
    German rendering than the one used in the video's other segments.
    """
    glossary_block = (
        f"\n\nKeep these terms consistent with their established German rendering used "
        f"elsewhere in this video, if any of them appear here:\n{glossary}"
        if glossary else ""
    )

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

Return ONLY the German text - no explanations, no notes, no quotation marks.{glossary_block}"""

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


def adapt_to_level(german_text: str, level: str, glossary: str = "", max_retries: int = 4) -> str | None:
    """
    Rewrites an already-correct German translation to match a target CEFR level.
    C2 needs no rewrite - DeepL's own output is already native-quality.

    glossary (see build_terminology_glossary) pins recurring names/terms to a
    single German rendering so a level rewrite doesn't drift a term into a
    different, also-valid phrasing than the one used in the video's other segments.
    """
    if level == "C2":
        return german_text

    level_desc = LEVEL_DESCRIPTIONS.get(level, LEVEL_DESCRIPTIONS["B1"])
    glossary_block = (
        f"\n7. Keep these terms consistent with their established German rendering used "
        f"elsewhere in this video, if any of them appear here:\n{glossary}"
        if glossary else ""
    )

    prompt = f"""You are adapting German text to a specific CEFR difficulty level. Follow these rules strictly:

1. NEVER change the meaning of the text.
2. NEVER add information, examples, or ideas that are not in the original.
3. NEVER remove or omit any information that is in the original.
4. ONLY adjust vocabulary complexity and sentence structure to match the target level.
5. Keep the same facts, names, numbers, and order of ideas as the original.
6. The result must express exactly the same content as the input - just written at a
   different difficulty level, not a different or expanded version of it.{glossary_block}

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


def translate_to_german(text: str, level: str = "B1", video_source: str | None = None, glossary: str = "") -> str | None:
    print(f"Translating to German at level {level}...")

    base = translate_base(text)
    if base is None:
        return None

    refined_base = refine_translation_context(text, base, glossary)

    adapted = adapt_to_level(refined_base, level, glossary)
    if adapted is None:
        return None

    record_translation(text, base, level, adapted, video_source)

    print("Translation complete!")
    return adapted


def translate_segments(segments: list, level: str = "B1", video_source: str | None = None) -> list | None:
    """
    Translates every segment to German, using the full video's transcript as
    context so recurring names/terms/phrases stay consistent from the first
    segment to the last instead of each segment being translated in
    isolation. Two things make this context-aware without paying for the
    full transcript on every one of a video's N segment calls:
      - DeepL sees every segment in a single batched call (translate_base_batch)
        rather than one call per segment, so its engine has the whole
        document in view when choosing how to render a name or term.
      - One extra Groq pass (build_terminology_glossary) reads the full
        transcript once up front and pins down recurring terms; that compact
        glossary - not the whole transcript - is then reused in every
        segment's refinement/adaptation call below.
    """
    try:
        non_empty = [(i, s) for i, s in enumerate(segments) if s["text"].strip()]
        skipped = len(segments) - len(non_empty)
        if skipped:
            print(f"{skipped} segment(s) have no text (empty Whisper segment), skipping")
        if not non_empty:
            print("No non-empty segments to translate")
            return []

        print("Building cross-video terminology glossary for consistency...")
        glossary = build_terminology_glossary([s["text"] for _, s in non_empty])
        if glossary:
            print(f"Glossary:\n{glossary}\n")

        print(f"Translating {len(non_empty)} segment(s) via DeepL (batched for consistency)...")
        base_translations = translate_base_batch([s["text"] for _, s in non_empty])
        if base_translations is None:
            return None

        translated_segments = []
        for (i, segment), base in zip(non_empty, base_translations):
            print(f"Refining segment {i + 1}/{len(segments)}...")

            refined_base = refine_translation_context(segment["text"], base, glossary)
            adapted = adapt_to_level(refined_base, level, glossary)
            if adapted is None:
                return None
            record_translation(segment["text"], base, level, adapted, video_source)

            translated_segment = {
                "start": segment["start"],
                "end": segment["end"],
                "original": segment["text"],
                "translated": adapted,
            }
            # Word timings belong to the English source audio, so they drive
            # highlighting of the original line (the German is a rewrite and
            # has no per-word timing of its own).
            if segment.get("words"):
                translated_segment["words"] = segment["words"]
            if "speaker" in segment:
                translated_segment["speaker"] = segment["speaker"]
            translated_segments.append(translated_segment)

        print("All segments translated!")
        return translated_segments

    except Exception as e:
        print(f"Error translating segments: {e}")
        return None
