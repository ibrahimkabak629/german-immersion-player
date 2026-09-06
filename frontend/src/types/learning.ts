import type { GermanLevel, Segment } from './segment';

export interface AppSettings {
  dailyChallenge: boolean;
  postVideoPopup: boolean;
  wordBank: boolean;
  grammarExplainer: boolean;
  fillInBlank: boolean;
  pronunciationScoring: boolean;
  streakTracking: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  dailyChallenge: true,
  postVideoPopup: true,
  wordBank: true,
  grammarExplainer: true,
  fillInBlank: false,
  pronunciationScoring: false,
  streakTracking: false,
};

export interface SettingDescriptor {
  key: keyof AppSettings;
  label: string;
  description: string;
}

export const SETTINGS_CATALOG: SettingDescriptor[] = [
  { key: 'dailyChallenge', label: 'Daily challenge', description: 'A 5-question mix of vocab, grammar, and comprehension, available from the main screen.' },
  { key: 'postVideoPopup', label: 'Post-video popup', description: 'A small prompt to practice after a video finishes playing.' },
  { key: 'wordBank', label: 'Word bank', description: 'Automatically saves German words from videos you watch.' },
  { key: 'grammarExplainer', label: 'Grammar explainer', description: 'Tap any German word in the subtitles or transcript for a breakdown.' },
  { key: 'fillInBlank', label: 'Fill in the blank mode', description: 'Practice by completing German sentences from what you watched.' },
  { key: 'pronunciationScoring', label: 'Pronunciation scoring', description: 'Record yourself and compare against the dubbed line.' },
  { key: 'streakTracking', label: 'Streak tracking', description: 'Track consecutive days you complete the daily challenge.' },
];

export interface WordBankEntry {
  /** Lowercased word, used as the storage key */
  key: string;
  /** Original-cased word as first seen */
  word: string;
  translation: string | null;
  level: GermanLevel;
  videoTitle: string;
  exampleGerman: string;
  exampleEnglish: string;
  addedAt: number;
  learned: boolean;
  starred: boolean;
}

export interface WatchHistoryEntry {
  id: string;
  title: string;
  level: GermanLevel;
  completedAt: number;
  segments: Segment[];
  /** Best known duration — last segment's end until real metadata arrives. */
  durationSeconds: number;
  /** Where the user left off, for resuming. */
  lastPositionSeconds: number;
  /** Furthest point ever reached — drives the % watched display. */
  furthestSeconds: number;
}

export interface StreakState {
  count: number;
  lastCompletedDate: string | null;
}

export type ChallengeQuestionType = 'vocab' | 'fill-blank' | 'comprehension';

export interface ChallengeQuestion {
  id: string;
  type: ChallengeQuestionType;
  prompt: string;
  options: string[];
  correctIndex: number;
  hint?: string;
}
