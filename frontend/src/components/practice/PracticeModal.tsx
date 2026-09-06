import { BookOpen, HelpCircle, PenLine, Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Flashcards } from './Flashcards';
import { QuizRunner } from './QuizRunner';
import { generateFillBlankQuestions, generateMixedQuestions } from '../../lib/practiceGenerators';
import type { PracticeOption } from '../popup/PostVideoPopup';
import type { Segment } from '../../types/segment';
import type { WordBankEntry } from '../../types/learning';

interface PracticeModalProps {
  mode: PracticeOption | null;
  onClose: () => void;
  segments: Segment[];
  wordBank: WordBankEntry[];
}

const META: Record<PracticeOption, { title: string; icon: typeof BookOpen }> = {
  flashcards: { title: 'Flashcards', icon: BookOpen },
  'fill-blank': { title: 'Fill in the Blanks', icon: PenLine },
  quiz: { title: 'Quick Quiz', icon: Sparkles },
  grammar: { title: 'Grammar Help', icon: HelpCircle },
};

export function PracticeModal({ mode, onClose, segments, wordBank }: PracticeModalProps) {
  const meta = mode ? META[mode] : null;
  const Icon = meta?.icon;

  return (
    <Modal open={!!mode} onClose={onClose} title={meta?.title ?? ''} icon={Icon && <Icon size={15} strokeWidth={1.75} className="text-fg-muted" />}>
      {mode === 'flashcards' && <Flashcards entries={wordBank} />}
      {mode === 'fill-blank' && (
        <QuizRunner
          questions={generateFillBlankQuestions(segments, 5)}
          emptyMessage="Not enough vocabulary in this video yet to build blanks — try a longer one."
        />
      )}
      {mode === 'quiz' && (
        <QuizRunner
          questions={generateMixedQuestions(segments, wordBank, 5)}
          emptyMessage="Watch a video first — quiz questions are built from what you've seen."
        />
      )}
      {mode === 'grammar' && (
        <div className="px-4 py-10 text-center text-sm text-fg-muted">
          Tap any German word in the subtitles or transcript for a full grammar breakdown — meaning, gender or
          conjugation, and why it's used that way here.
        </div>
      )}
    </Modal>
  );
}
