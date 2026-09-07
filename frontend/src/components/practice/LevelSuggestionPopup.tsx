import { AnimatePresence, motion } from 'framer-motion';
import { TrendingUp, X } from 'lucide-react';
import type { GermanLevel } from '../../types/segment';

interface LevelSuggestionPopupProps {
  currentLevel: GermanLevel;
  suggestedLevel: GermanLevel | null;
  onAccept: () => void;
  onStay: () => void;
  onNeverAsk: () => void;
}

/** Gentle, always-dismissable nudge after a run of strong scores. */
export function LevelSuggestionPopup({
  currentLevel,
  suggestedLevel,
  onAccept,
  onStay,
  onNeverAsk,
}: LevelSuggestionPopupProps) {
  return (
    <AnimatePresence>
      {suggestedLevel && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="gradient-border fixed bottom-4 left-4 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-[var(--radius-lg)] bg-bg-elevated p-3.5 shadow-[var(--shadow-float)]"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <TrendingUp size={15} strokeWidth={1.75} />
            </span>
            <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-fg">
              You seem comfortable at {currentLevel}, want to try {suggestedLevel}?
            </p>
            <button
              type="button"
              onClick={onStay}
              aria-label="Dismiss"
              className="-mr-1 -mt-1 shrink-0 rounded p-1 text-fg-muted transition-colors hover:bg-bg-elevated-2 hover:text-fg"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>

          <div className="mt-3 flex gap-1.5">
            <button
              type="button"
              onClick={onAccept}
              className="flex-1 rounded-[var(--radius-sm)] bg-accent py-1.5 text-xs font-medium text-[oklch(16%_0.012_265)] transition-colors hover:bg-accent-strong"
            >
              Try {suggestedLevel}
            </button>
            <button
              type="button"
              onClick={onStay}
              className="flex-1 rounded-[var(--radius-sm)] border border-border py-1.5 text-xs font-medium text-fg-secondary transition-colors hover:border-border-strong hover:text-fg"
            >
              Stay at {currentLevel}
            </button>
          </div>

          <button
            type="button"
            onClick={onNeverAsk}
            className="mt-2 w-full text-center text-xs text-fg-muted transition-colors hover:text-fg-secondary"
          >
            Don't suggest again
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
