import type { Segment } from '../types/segment';
import type { ChallengeQuestion, WordBankEntry } from '../types/learning';
import { extractVocabWords } from './germanWords';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickDistractors<T>(pool: T[], exclude: T, count: number): T[] {
  const candidates = shuffle(pool.filter((item) => item !== exclude));
  return candidates.slice(0, count);
}

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Sentence comprehension: given a German line, pick its correct English meaning. Always available — no API calls. */
export function generateComprehensionQuestions(segments: Segment[], count: number): ChallengeQuestion[] {
  const candidates = segments.filter((s) => s.translated.trim() && s.original.trim());
  if (candidates.length < 2) return [];

  const chosen = shuffle(candidates).slice(0, count);
  return chosen.map((segment) => {
    const distractors = pickDistractors(
      candidates.map((s) => s.original),
      segment.original,
      3,
    );
    const options = shuffle([segment.original, ...distractors]);
    return {
      id: nextId('comp'),
      type: 'comprehension',
      prompt: `What does this mean? "${segment.translated}"`,
      options,
      correctIndex: options.indexOf(segment.original),
    };
  });
}

/** Fill-in-the-blank: blanks one vocab word out of a German sentence, options are candidate words from the same batch. */
export function generateFillBlankQuestions(segments: Segment[], count: number): ChallengeQuestion[] {
  const withWords = segments
    .map((segment) => ({ segment, words: extractVocabWords(segment.translated) }))
    .filter((s) => s.words.length > 0);
  if (withWords.length < 2) return [];

  const wordPool = Array.from(new Set(withWords.flatMap((s) => s.words)));
  const chosen = shuffle(withWords).slice(0, count);

  return chosen
    .map(({ segment, words }) => {
      const target = words[Math.floor(Math.random() * words.length)];
      const blanked = segment.translated.replace(new RegExp(`\\b${target}\\b`), '____');
      if (blanked === segment.translated) return null;

      const distractors = pickDistractors(wordPool, target, 3);
      if (distractors.length < 3) return null;
      const options = shuffle([target, ...distractors]);
      const question: ChallengeQuestion = {
        id: nextId('blank'),
        type: 'fill-blank',
        prompt: blanked,
        hint: segment.original,
        options,
        correctIndex: options.indexOf(target),
      };
      return question;
    })
    .filter((q): q is ChallengeQuestion => q !== null);
}

/** Vocabulary meaning: only for word-bank entries that already have a looked-up translation. */
export function generateVocabQuestions(entries: WordBankEntry[], count: number): ChallengeQuestion[] {
  const withTranslation = entries.filter((e): e is WordBankEntry & { translation: string } => !!e.translation);
  if (withTranslation.length < 4) return [];

  const chosen = shuffle(withTranslation).slice(0, count);
  return chosen.map((entry) => {
    const distractors = pickDistractors(
      withTranslation.map((e) => e.translation),
      entry.translation,
      3,
    );
    const options = shuffle([entry.translation, ...distractors]);
    return {
      id: nextId('vocab'),
      type: 'vocab',
      prompt: `What does "${entry.word}" mean?`,
      options,
      correctIndex: options.indexOf(entry.translation),
    };
  });
}

/** Mixes whatever question types are available, filling up to `count` with comprehension as the reliable fallback. */
export function generateMixedQuestions(segments: Segment[], wordBank: WordBankEntry[], count: number): ChallengeQuestion[] {
  const vocab = generateVocabQuestions(wordBank, Math.ceil(count / 3));
  const fillBlank = generateFillBlankQuestions(segments, Math.ceil(count / 3));
  const comprehension = generateComprehensionQuestions(segments, count);

  const mixed = shuffle([...vocab, ...fillBlank]).concat(comprehension);
  return mixed.slice(0, count);
}
