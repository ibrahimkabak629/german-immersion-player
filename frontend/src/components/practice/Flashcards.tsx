import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, PartyPopper, RotateCw } from 'lucide-react';
import { quickTranslateWord } from '../../lib/api';
import { useLearningData } from '../../context/LearningDataContext';
import type { WordBankEntry } from '../../types/learning';

interface FlashcardsProps {
  entries: WordBankEntry[];
}

export function Flashcards({ entries }: FlashcardsProps) {
  const { setTranslation, toggleLearned } = useLearningData();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);

  if (entries.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-fg-muted">
        No words to review yet — watch a video first and words will show up here.
      </p>
    );
  }

  if (index >= entries.length) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <PartyPopper size={28} strokeWidth={1.5} className="text-accent" />
        <p className="font-[family-name:var(--font-display)] text-lg text-fg">All caught up!</p>
        <p className="text-sm text-fg-muted">You reviewed every word in this set.</p>
      </div>
    );
  }

  const entry = entries[index];

  async function lookUp() {
    setLoading(true);
    try {
      const translation = await quickTranslateWord(entry.word, entry.exampleGerman);
      setTranslation(entry.key, translation);
    } catch {
      setTranslation(entry.key, '(lookup failed — flip again to retry)');
    } finally {
      setLoading(false);
    }
  }

  function advance(knewIt: boolean) {
    if (knewIt) toggleLearned(entry.key);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  return (
    <div className="flex flex-col items-center p-4">
      <span className="mb-3 text-xs text-fg-muted">
        {index + 1} / {entries.length}
      </span>

      <div className="h-48 w-full max-w-xs" style={{ perspective: 1000 }}>
        <motion.div
          className="relative h-full w-full cursor-pointer"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.35 }}
          onClick={() => {
            if (!flipped && !entry.translation && !loading) void lookUp();
            setFlipped((f) => !f);
          }}
        >
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-border bg-bg-elevated-2 p-4 text-center shadow-[var(--shadow-card)]"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-fg-muted">{entry.level}</span>
            <p className="font-[family-name:var(--font-display)] text-2xl text-fg">{entry.word}</p>
            <p className="flex items-center gap-1.5 text-xs text-fg-muted">
              <RotateCw size={11} strokeWidth={2} /> Tap to flip
            </p>
          </div>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-border bg-bg-elevated-2 p-4 text-center shadow-[var(--shadow-card)]"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {loading ? (
              <Loader2 size={18} strokeWidth={2} className="animate-spin text-fg-muted" />
            ) : (
              <p className="text-lg font-medium text-fg">{entry.translation ?? '—'}</p>
            )}
            <p className="text-sm italic text-fg-muted">“{entry.exampleGerman}”</p>
            <p className="text-xs text-fg-muted">{entry.exampleEnglish}</p>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex w-full max-w-xs gap-2"
          >
            <button
              type="button"
              onClick={() => advance(false)}
              className="flex-1 rounded-[var(--radius-sm)] border border-border bg-bg-elevated-2 py-2 text-sm font-medium text-fg-secondary transition-colors hover:border-border-strong"
            >
              Still learning
            </button>
            <button
              type="button"
              onClick={() => advance(true)}
              className="flex-1 rounded-[var(--radius-sm)] bg-accent py-2 text-sm font-medium text-[oklch(16%_0.012_265)] transition-colors hover:bg-accent-strong"
            >
              Got it
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
