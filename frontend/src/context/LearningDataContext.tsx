import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { extractVocabWords } from '../lib/germanWords';
import type { GermanLevel, Segment } from '../types/segment';
import type { WatchHistoryEntry, WordBankEntry } from '../types/learning';

const MAX_HISTORY_ENTRIES = 12;
const MAX_SEGMENTS_PER_ENTRY = 80;

interface LearningDataContextValue {
  wordBank: WordBankEntry[];
  history: WatchHistoryEntry[];
  recordWatchedVideo: (title: string, level: GermanLevel, segments: Segment[]) => void;
  upsertWord: (word: string, sentence: { german: string; english: string }, level: GermanLevel, videoTitle: string) => void;
  toggleLearned: (key: string) => void;
  toggleStarred: (key: string) => void;
  setTranslation: (key: string, translation: string) => void;
}

const LearningDataContext = createContext<LearningDataContextValue | null>(null);

export function LearningDataProvider({ children }: { children: ReactNode }) {
  const [wordBank, setWordBank] = useLocalStorage<WordBankEntry[]>('gip-word-bank', []);
  const [history, setHistory] = useLocalStorage<WatchHistoryEntry[]>('gip-watch-history', []);

  const recordWatchedVideo = useCallback(
    (title: string, level: GermanLevel, segments: Segment[]) => {
      if (segments.length === 0) return;

      setHistory((prev) => {
        const entry: WatchHistoryEntry = {
          id: `${Date.now()}`,
          title,
          level,
          completedAt: Date.now(),
          segments: segments.slice(0, MAX_SEGMENTS_PER_ENTRY),
        };
        return [entry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
      });

      setWordBank((prev) => {
        const byKey = new Map(prev.map((entry) => [entry.key, entry]));
        for (const segment of segments) {
          for (const word of extractVocabWords(segment.translated)) {
            const key = word.toLowerCase();
            if (byKey.has(key)) continue;
            byKey.set(key, {
              key,
              word,
              translation: null,
              level,
              videoTitle: title,
              exampleGerman: segment.translated,
              exampleEnglish: segment.original,
              addedAt: Date.now(),
              learned: false,
              starred: false,
            });
          }
        }
        return Array.from(byKey.values());
      });
    },
    [setHistory, setWordBank],
  );

  const upsertWord = useCallback(
    (word: string, sentence: { german: string; english: string }, level: GermanLevel, videoTitle: string) => {
      const key = word.toLowerCase();
      setWordBank((prev) => {
        if (prev.some((entry) => entry.key === key)) return prev;
        return [
          {
            key,
            word,
            translation: null,
            level,
            videoTitle,
            exampleGerman: sentence.german,
            exampleEnglish: sentence.english,
            addedAt: Date.now(),
            learned: false,
            starred: false,
          },
          ...prev,
        ];
      });
    },
    [setWordBank],
  );

  const toggleLearned = useCallback(
    (key: string) => {
      setWordBank((prev) => prev.map((entry) => (entry.key === key ? { ...entry, learned: !entry.learned } : entry)));
    },
    [setWordBank],
  );

  const toggleStarred = useCallback(
    (key: string) => {
      setWordBank((prev) => prev.map((entry) => (entry.key === key ? { ...entry, starred: !entry.starred } : entry)));
    },
    [setWordBank],
  );

  const setTranslation = useCallback(
    (key: string, translation: string) => {
      setWordBank((prev) => prev.map((entry) => (entry.key === key ? { ...entry, translation } : entry)));
    },
    [setWordBank],
  );

  return (
    <LearningDataContext.Provider
      value={{ wordBank, history, recordWatchedVideo, upsertWord, toggleLearned, toggleStarred, setTranslation }}
    >
      {children}
    </LearningDataContext.Provider>
  );
}

export function useLearningData() {
  const ctx = useContext(LearningDataContext);
  if (!ctx) throw new Error('useLearningData must be used within a LearningDataProvider');
  return ctx;
}
