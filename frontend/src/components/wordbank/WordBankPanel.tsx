import { useMemo, useState } from 'react';
import { BookMarked, Check, Download, Loader2, Star } from 'lucide-react';
import clsx from 'clsx';
import { Drawer } from '../ui/Drawer';
import { useLearningData } from '../../context/LearningDataContext';
import { quickTranslateWord } from '../../lib/api';
import { downloadTextFile, wordBankToAnkiCsv, wordBankToCsv } from '../../lib/exporters';
import type { WordBankEntry } from '../../types/learning';

interface WordBankPanelProps {
  open: boolean;
  onClose: () => void;
}

type Filter = 'all' | 'starred' | 'learned';

export function WordBankPanel({ open, onClose }: WordBankPanelProps) {
  const { wordBank, toggleLearned, toggleStarred, setTranslation } = useLearningData();
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(() => {
    const sorted = [...wordBank].sort((a, b) => b.addedAt - a.addedAt);
    if (filter === 'starred') return sorted.filter((e) => e.starred);
    if (filter === 'learned') return sorted.filter((e) => e.learned);
    return sorted;
  }, [wordBank, filter]);

  return (
    <Drawer open={open} onClose={onClose} title="Word Bank" icon={<BookMarked size={15} strokeWidth={1.75} className="text-fg-muted" />}>
      <div className="flex shrink-0 gap-1 border-b border-border px-4 py-2.5">
        {(['all', 'starred', 'learned'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={clsx(
              'rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors',
              filter === f ? 'bg-accent text-[oklch(16%_0.012_265)]' : 'text-fg-secondary hover:bg-bg-elevated-2',
            )}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-fg-muted">{wordBank.length} words</span>
      </div>

      {wordBank.length > 0 && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-2.5">
          <Download size={13} strokeWidth={1.75} className="shrink-0 text-fg-muted" />
          <button
            type="button"
            onClick={() => downloadTextFile(wordBankToAnkiCsv(visible), 'word-bank-anki.csv', 'text/csv')}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-fg-secondary transition-colors hover:border-border-strong hover:text-fg"
          >
            Anki CSV
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile(wordBankToCsv(visible), 'word-bank.csv', 'text/csv')}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-fg-secondary transition-colors hover:border-border-strong hover:text-fg"
          >
            Plain CSV
          </button>
          <span className="ml-auto text-[11px] text-fg-muted">{visible.length} in view</span>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <BookMarked size={22} strokeWidth={1.5} className="text-fg-muted" />
          <p className="text-sm text-fg-muted">
            {wordBank.length === 0
              ? 'Words from the videos you watch will show up here automatically.'
              : `No ${filter} words yet.`}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((entry) => (
            <WordRow
              key={entry.key}
              entry={entry}
              onToggleLearned={() => toggleLearned(entry.key)}
              onToggleStarred={() => toggleStarred(entry.key)}
              onTranslated={(t) => setTranslation(entry.key, t)}
            />
          ))}
        </ul>
      )}
    </Drawer>
  );
}

function WordRow({
  entry,
  onToggleLearned,
  onToggleStarred,
  onTranslated,
}: {
  entry: WordBankEntry;
  onToggleLearned: () => void;
  onToggleStarred: () => void;
  onTranslated: (translation: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function lookUp() {
    setLoading(true);
    try {
      const translation = await quickTranslateWord(entry.word, entry.exampleGerman);
      onTranslated(translation);
    } catch {
      onTranslated('(lookup failed — tap to retry)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onToggleLearned}
        aria-label={entry.learned ? 'Mark as not learned' : 'Mark as learned'}
        className={clsx(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          entry.learned ? 'border-success bg-success/15 text-success' : 'border-border text-transparent hover:border-border-strong',
        )}
      >
        <Check size={12} strokeWidth={2.5} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={clsx('font-[family-name:var(--font-display)] text-[15px]', entry.learned ? 'text-fg-muted line-through' : 'text-fg')}>
            {entry.word}
          </span>
          <span className="rounded-full border border-border px-1.5 py-0 text-[10px] font-medium text-fg-muted">{entry.level}</span>
        </div>
        {entry.translation ? (
          <p className="mt-0.5 text-sm text-fg-secondary">{entry.translation}</p>
        ) : (
          <button
            type="button"
            onClick={lookUp}
            disabled={loading}
            className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-strong disabled:opacity-60"
          >
            {loading ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : null}
            {loading ? 'Looking up…' : 'Tap to look up'}
          </button>
        )}
        <p className="mt-1 truncate text-xs text-fg-muted">from “{entry.videoTitle}”</p>
      </div>

      <button
        type="button"
        onClick={onToggleStarred}
        aria-label={entry.starred ? 'Unstar word' : 'Star word'}
        className={clsx('mt-0.5 shrink-0 transition-colors', entry.starred ? 'text-accent' : 'text-fg-muted hover:text-fg-secondary')}
      >
        <Star size={16} strokeWidth={1.75} fill={entry.starred ? 'currentColor' : 'none'} />
      </button>
    </li>
  );
}
