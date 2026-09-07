import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, PartyPopper, X } from 'lucide-react';
import clsx from 'clsx';
import type { ChallengeQuestion } from '../../types/learning';

interface QuizRunnerProps {
  questions: ChallengeQuestion[];
  onFinish?: (score: number, total: number) => void;
  emptyMessage: string;
}

export function QuizRunner({ questions, onFinish, emptyMessage }: QuizRunnerProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (questions.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-fg-muted">{emptyMessage}</p>;
  }

  const question = questions[index];
  const isLast = index === questions.length - 1;

  function choose(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
    if (optionIndex === question.correctIndex) setScore((s) => s + 1);
  }

  function next() {
    if (isLast) {
      setFinished(true);
      onFinish?.(score, questions.length);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <PartyPopper size={28} strokeWidth={1.5} className="text-accent" />
        <p className="font-[family-name:var(--font-display)] text-lg text-fg">
          {score} / {questions.length} correct
        </p>
        <p className="text-sm text-fg-muted">
          {score === questions.length ? 'Perfect run!' : score >= questions.length / 2 ? 'Nice work.' : 'Keep practicing — you’ll get there.'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-fg-muted">
          Question {index + 1} of {questions.length}
        </span>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <span key={i} className={clsx('h-1 w-4 rounded-full', i <= index ? 'bg-accent' : 'bg-bg-elevated-2')} />
          ))}
        </div>
      </div>

      <p className="mb-4 font-[family-name:var(--font-display)] text-[17px] leading-snug text-fg">{question.prompt}</p>
      {question.hint && <p className="-mt-3 mb-4 text-xs italic text-fg-muted">{question.hint}</p>}

      <div className="space-y-2">
        {question.options.map((option, i) => {
          const isCorrect = i === question.correctIndex;
          const isSelected = i === selected;
          const revealed = selected !== null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={revealed}
              className={clsx(
                'flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left text-sm transition-colors',
                !revealed && 'border-border bg-bg-elevated-2 hover:border-border-strong',
                revealed && isCorrect && 'border-success bg-success/10 text-success',
                revealed && isSelected && !isCorrect && 'border-de-red bg-de-red-soft text-de-red',
                revealed && !isCorrect && !isSelected && 'border-border text-fg-muted opacity-60',
              )}
            >
              <span>{option}</span>
              {revealed && isCorrect && <Check size={15} strokeWidth={2} />}
              {revealed && isSelected && !isCorrect && <X size={15} strokeWidth={2} />}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          type="button"
          onClick={next}
          className="mt-4 w-full rounded-[var(--radius-sm)] bg-accent py-2 text-sm font-medium text-[oklch(16%_0.012_265)] transition-colors hover:bg-accent-strong"
        >
          {isLast ? 'See results' : 'Next question'}
        </motion.button>
      )}
    </div>
  );
}
