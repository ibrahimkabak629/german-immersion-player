import { forwardRef } from 'react';
import clsx from 'clsx';
import type { Segment } from '../../types/segment';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface TranscriptEntryProps {
  segment: Segment;
  isActive: boolean;
  onClick: () => void;
}

export const TranscriptEntry = forwardRef<HTMLButtonElement, TranscriptEntryProps>(function TranscriptEntry(
  { segment, isActive, onClick },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={clsx(
        'flex w-full gap-3 rounded-[var(--radius-md)] border-l-[3px] px-3 py-2.5 text-left transition-colors duration-150',
        isActive ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-bg-elevated-2',
      )}
    >
      <span className="mt-0.5 shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-fg-muted">
        {formatTime(segment.start)}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            'line-clamp-3 break-words text-[15px] leading-snug',
            isActive ? 'text-fg' : 'text-fg-secondary',
          )}
        >
          {segment.translated}
        </p>
        <p className="mt-0.5 line-clamp-2 break-words text-xs leading-snug text-fg-muted">{segment.original}</p>
      </div>
    </button>
  );
});
