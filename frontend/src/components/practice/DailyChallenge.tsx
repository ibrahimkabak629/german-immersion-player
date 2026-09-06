import { useMemo } from 'react';
import { Flame, Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { QuizRunner } from './QuizRunner';
import { generateMixedQuestions } from '../../lib/practiceGenerators';
import { useLearningData } from '../../context/LearningDataContext';
import { useSettings } from '../../context/SettingsContext';
import { useStreak } from '../../hooks/useStreak';
import type { GermanLevel } from '../../types/segment';

interface DailyChallengeProps {
  open: boolean;
  onClose: () => void;
  onFinish?: (score: number, total: number) => void;
}

function mostUsedLevel(levels: GermanLevel[]): GermanLevel | null {
  if (levels.length === 0) return null;
  const counts = new Map<GermanLevel, number>();
  for (const level of levels) counts.set(level, (counts.get(level) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function DailyChallenge({ open, onClose, onFinish }: DailyChallengeProps) {
  const { history, wordBank } = useLearningData();
  const { settings } = useSettings();
  const { streak, completeToday } = useStreak();

  const level = useMemo(() => mostUsedLevel(history.map((h) => h.level)), [history]);
  const questions = useMemo(() => {
    const segments = history.flatMap((h) => h.segments);
    return generateMixedQuestions(segments, wordBank, 5);
  }, [history, wordBank]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Daily Challenge"
      icon={<Sparkles size={15} strokeWidth={1.75} className="text-fg-muted" />}
    >
      {settings.streakTracking && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm text-fg-secondary">
          <Flame size={15} strokeWidth={2} className={streak > 0 ? 'text-accent' : 'text-fg-muted'} />
          {streak > 0 ? `${streak}-day streak` : 'Start your streak today'}
          {level && <span className="ml-auto text-xs text-fg-muted">Tuned to your {level} watching</span>}
        </div>
      )}
      <QuizRunner
        questions={questions}
        onFinish={(score, total) => {
          completeToday();
          onFinish?.(score, total);
        }}
        emptyMessage="Watch a couple of videos first — your daily challenge is built from what you've watched."
      />
    </Modal>
  );
}
