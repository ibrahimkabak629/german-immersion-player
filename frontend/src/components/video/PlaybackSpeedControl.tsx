import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { SPEED_OPTIONS, formatSpeed } from '../../lib/playbackSpeed';

interface PlaybackSpeedControlProps {
  rate: number;
  onChange: (rate: number) => void;
}

export function PlaybackSpeedControl({ rate, onChange }: PlaybackSpeedControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        title="Playback speed (< / >)"
        aria-label="Playback speed"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'inline-flex h-9 min-w-9 items-center justify-center rounded-[var(--radius-sm)] px-1.5 font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums transition-colors',
          rate !== 1 ? 'text-accent' : 'text-white',
          open ? 'bg-white/15' : 'hover:bg-white/10',
        )}
      >
        {formatSpeed(rate)}
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
              className="absolute bottom-full right-0 z-50 mb-1.5 min-w-[4.5rem] overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-bg-elevated py-1 shadow-[var(--shadow-float)]"
            >
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={clsx(
                    'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm transition-colors',
                    option === rate ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-elevated-2 hover:text-fg',
                  )}
                >
                  {formatSpeed(option)}
                  {option === 1 && <span className="text-xs text-fg-muted">normal</span>}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
