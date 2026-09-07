import { useLocalStorage } from './useLocalStorage';
import { GERMAN_LEVELS, type GermanLevel } from '../types/segment';
import { DEFAULT_LEVEL_PROGRESS, type LevelProgressState, type QuizResult } from '../types/learning';

const MAX_RESULTS = 30;
const STREAK_REQUIRED = 3;
const PASS_RATIO = 0.8;

export function nextLevelUp(level: GermanLevel): GermanLevel | null {
  const index = GERMAN_LEVELS.indexOf(level);
  return index >= 0 && index < GERMAN_LEVELS.length - 1 ? GERMAN_LEVELS[index + 1] : null;
}

/**
 * Tracks quiz/challenge scores per CEFR level and works out when someone has
 * comfortably outgrown their current level: 3 consecutive results at 80%+ at
 * that level, with no dismissal on record.
 */
export function useLevelProgress() {
  const [stored, setProgress] = useLocalStorage<LevelProgressState>('gip-level-progress', DEFAULT_LEVEL_PROGRESS);
  const progress: LevelProgressState = { ...DEFAULT_LEVEL_PROGRESS, ...stored };

  function recordResult(level: GermanLevel, score: number, total: number) {
    if (total <= 0) return;
    const result: QuizResult = { level, score, total, at: Date.now() };
    setProgress((prev) => {
      const base = { ...DEFAULT_LEVEL_PROGRESS, ...prev };
      return { ...base, results: [result, ...base.results].slice(0, MAX_RESULTS) };
    });
  }

  function suggestionFor(level: GermanLevel): GermanLevel | null {
    if (progress.neverSuggest || progress.dismissedLevels.includes(level)) return null;
    const target = nextLevelUp(level);
    if (!target) return null;

    const atLevel = progress.results.filter((r) => r.level === level);
    if (atLevel.length < STREAK_REQUIRED) return null;
    const streak = atLevel.slice(0, STREAK_REQUIRED);
    return streak.every((r) => r.score / r.total >= PASS_RATIO) ? target : null;
  }

  /** Clears the streak so an accepted/declined suggestion doesn't immediately return. */
  function clearResultsFor(level: GermanLevel) {
    setProgress((prev) => {
      const base = { ...DEFAULT_LEVEL_PROGRESS, ...prev };
      return { ...base, results: base.results.filter((r) => r.level !== level) };
    });
  }

  function dismissLevel(level: GermanLevel) {
    setProgress((prev) => {
      const base = { ...DEFAULT_LEVEL_PROGRESS, ...prev };
      return {
        ...base,
        dismissedLevels: base.dismissedLevels.includes(level) ? base.dismissedLevels : [...base.dismissedLevels, level],
      };
    });
  }

  function neverSuggestAgain() {
    setProgress((prev) => ({ ...DEFAULT_LEVEL_PROGRESS, ...prev, neverSuggest: true }));
  }

  return { progress, recordResult, suggestionFor, clearResultsFor, dismissLevel, neverSuggestAgain };
}
