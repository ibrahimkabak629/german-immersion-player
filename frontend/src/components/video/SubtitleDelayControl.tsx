import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, Timer } from 'lucide-react';
import clsx from 'clsx';

const STEP = 0.25;
const MIN_OFFSET = -3;
const MAX_OFFSET = 3;

function formatOffset(offset: number): string {
  const sign = offset > 0 ? '+' : '';
  return `${sign}${offset.toFixed(2).replace(/\.?0+$/, '')}s`;
}

interface SubtitleDelayControlProps {
  offset: number;
  onChange: (offset: number | ((prev: number) => number)) => void;
}

/** Shifts when subtitles appear relative to the video — display timing only. */
export function SubtitleDelayControl({ offset, onChange }: SubtitleDelayControlProps) {
  const [open, setOpen] = useState(false);

  function step(direction: 1 | -1) {
    // Functional update so rapid clicks each build on the latest value.
    onChange((prev) => {
      const next = Math.round((prev + direction * STEP) * 100) / 100;
      return Math.min(MAX_OFFSET, Math.max(MIN_OFFSET, next));
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        title="Subtitle delay"
        aria-label="Subtitle delay"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] transition-colors',
          offset !== 0 ? 'text-accent' : 'text-white',
          open ? 'bg-white/15' : 'hover:bg-white/10',
        )}
      >
        <Timer size={15} strokeWidth={1.75} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              aria-hidden="true"
              tabIndex={-1}
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-full right-0 z-50 mb-1.5 w-48 rounded-[var(--radius-md)] border border-border-strong bg-bg-elevated p-3 shadow-[var(--shadow-float)]"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Subtitle delay</p>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label="Subtitles 0.25s earlier"
                  onClick={() => step(-1)}
                  disabled={offset <= MIN_OFFSET}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-border text-fg-secondary transition-colors hover:border-border-strong hover:text-fg disabled:opacity-30"
                >
                  <Minus size={14} strokeWidth={2} />
                </button>
                <span
                  className={clsx(
                    'font-[family-name:var(--font-mono)] text-sm tabular-nums',
                    offset !== 0 ? 'text-accent' : 'text-fg',
                  )}
                >
                  {formatOffset(offset)}
                </span>
                <button
                  type="button"
                  aria-label="Subtitles 0.25s later"
                  onClick={() => step(1)}
                  disabled={offset >= MAX_OFFSET}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-border text-fg-secondary transition-colors hover:border-border-strong hover:text-fg disabled:opacity-30"
                >
                  <Plus size={14} strokeWidth={2} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onChange(0)}
                disabled={offset === 0}
                className="mt-2.5 w-full rounded-[var(--radius-sm)] border border-border py-1.5 text-xs font-medium text-fg-secondary transition-colors hover:border-border-strong hover:text-fg disabled:opacity-30"
              >
                Reset to 0
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
