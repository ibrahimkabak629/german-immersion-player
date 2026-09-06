import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import type { Segment } from '../../types/segment';
import { ClickableGermanText } from '../grammar/ClickableGermanText';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface TranscriptEntryProps {
  segment: Segment;
  isActive: boolean;
  onClick: () => void;
  onWordClick?: (word: string) => void;
  onReplay: () => void;
}

export const TranscriptEntry = forwardRef<HTMLButtonElement, TranscriptEntryProps>(function TranscriptEntry(
  { segment, isActive, onClick, onWordClick, onReplay },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={clsx(
        'group relative flex w-full gap-3 rounded-[var(--radius-md)] py-2.5 pl-4 pr-8 text-left transition-colors duration-150',
        isActive ? 'bg-accent-soft' : 'hover:bg-bg-elevated-2',
      )}
    >
      {/* timeline rail */}
      <span className="absolute bottom-0.5 left-1.5 top-0.5 w-px bg-border" aria-hidden="true" />
      <span
        className={clsx(
          'absolute left-0 top-3.5 h-[7px] w-[7px] rounded-full border-2 transition-colors',
          isActive ? 'border-accent bg-accent' : 'border-border bg-bg group-hover:border-border-strong',
        )}
        aria-hidden="true"
      >
        {isActive && (
          <motion.span
            layoutId="transcript-active-ring"
            className="absolute -inset-1.5 rounded-full border border-accent/50"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
      </span>

      <span className="mt-0.5 shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-fg-muted">
        {formatTime(segment.start)}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            'line-clamp-3 break-words font-[family-name:var(--font-display)] text-[15.5px] leading-snug',
            isActive ? 'text-fg' : 'text-fg-secondary group-hover:text-fg',
          )}
        >
          <ClickableGermanText
            text={segment.translated}
            onWordClick={(word) => onWordClick?.(word)}
            wordClassName="rounded-sm transition-colors hover:bg-accent-soft hover:text-accent"
          />
        </p>
        <p className="mt-0.5 line-clamp-2 break-words text-[12.5px] leading-snug text-fg-muted">{segment.original}</p>
      </div>

      <motion.button
        type="button"
        title="Replay this line (R)"
        aria-label="Replay this line"
        onClick={(e) => {
          e.stopPropagation();
          onReplay();
        }}
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.88 }}
        className={clsx(
          'absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full transition-colors',
          isActive
            ? 'replay-hint-active text-accent hover:bg-accent-soft'
            : 'replay-hint text-fg-muted hover:bg-bg-elevated-2 hover:text-fg-secondary',
        )}
      >
        <RotateCcw size={13} strokeWidth={2} />
      </motion.button>
    </button>
  );
});
