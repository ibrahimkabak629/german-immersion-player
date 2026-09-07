import { useEffect, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from '../ui/Modal';
import { MiniMarkdown } from '../ui/MiniMarkdown';
import { explainWord } from '../../lib/api';
import { useLearningData } from '../../context/LearningDataContext';
import { useSettings } from '../../context/SettingsContext';
import type { GermanLevel } from '../../types/segment';

export interface GrammarTarget {
  word: string;
  german: string;
  english: string;
}

interface GrammarPopoverProps {
  target: GrammarTarget | null;
  onClose: () => void;
  level: GermanLevel;
  videoTitle: string;
}

export function GrammarPopover({ target, onClose, level, videoTitle }: GrammarPopoverProps) {
  const { settings } = useSettings();
  const { wordBank, upsertWord, toggleStarred } = useLearningData();
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!target) return;
    setAnswer(null);
    setError(null);
    setLoading(true);

    if (settings.wordBank) {
      upsertWord(target.word, { german: target.german, english: target.english }, level, videoTitle);
    }

    explainWord(target.word, target.german, level)
      .then(setAnswer)
      .catch(() => setError("Couldn't reach the tutor just now. Try again in a moment."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.word, target?.german]);

  const entry = target ? wordBank.find((e) => e.key === target.word.toLowerCase()) : undefined;

  return (
    <Modal open={!!target} onClose={onClose} title={target?.word ?? ''} maxWidth="max-w-lg">
      {target && (
        <div className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="text-sm italic text-fg-secondary">“{target.german}”</p>
            {settings.wordBank && entry && (
              <button
                type="button"
                onClick={() => toggleStarred(entry.key)}
                aria-label={entry.starred ? 'Unstar word' : 'Star word'}
                className={clsx('shrink-0 transition-colors', entry.starred ? 'text-accent' : 'text-fg-muted hover:text-fg-secondary')}
              >
                <Star size={17} strokeWidth={1.75} fill={entry.starred ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-6 text-sm text-fg-muted">
              <Loader2 size={15} strokeWidth={2} className="animate-spin" />
              Asking the tutor…
            </div>
          )}
          {error && <p className="py-4 text-sm text-de-red">{error}</p>}
          {answer && <MiniMarkdown text={answer} className="space-y-2 text-sm leading-relaxed text-fg-secondary" />}
        </div>
      )}
    </Modal>
  );
}
