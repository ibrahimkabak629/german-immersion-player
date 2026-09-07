export type LearningMode = 'listening' | 'reading' | 'speaking';

/** Display and cycle order — Reading (index 1) is the default. */
export const LEARNING_MODES: { key: LearningMode; label: string; description: string }[] = [
  { key: 'listening', label: 'Listening', description: 'Subtitles hidden — test your ear' },
  { key: 'reading', label: 'Reading', description: 'Subtitles visible as you watch' },
  { key: 'speaking', label: 'Speaking', description: 'Pause each line and record yourself' },
];

export function nextLearningMode(current: LearningMode): LearningMode {
  const index = LEARNING_MODES.findIndex((m) => m.key === current);
  return LEARNING_MODES[(index + 1) % LEARNING_MODES.length].key;
}
