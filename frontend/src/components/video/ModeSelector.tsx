import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronDown, Headphones, Mic } from 'lucide-react';
import clsx from 'clsx';
import { LEARNING_MODES, type LearningMode } from '../../types/learningMode';

const ICONS = { listening: Headphones, reading: BookOpen, speaking: Mic } as const;

interface ModeSelectorProps {
  mode: LearningMode;
  onChange: (mode: LearningMode) => void;
}

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const current = LEARNING_MODES.find((m) => m.key === mode) ?? LEARNING_MODES[1];
  const CurrentIcon = ICONS[mode];

  return (
    <div className="absolute left-3 top-3 z-10">
      <button
        type="button"
        title="Learning mode (M to cycle)"
        aria-label="Learning mode"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 py-1.5 pl-2.5 pr-2 text-xs font-medium text-white backdrop-blur-md transition-colors',
          open ? 'bg-black/60' : 'hover:bg-black/60',
        )}
      >
        <CurrentIcon size={13} strokeWidth={1.75} />
        {current.label}
        <ChevronDown size={12} strokeWidth={2} className={clsx('text-white/60 transition-transform', open && 'rotate-180')} />
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
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-bg-elevated py-1 shadow-[var(--shadow-float)]"
            >
              {LEARNING_MODES.map((option) => {
                const Icon = ICONS[option.key];
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      onChange(option.key);
                      setOpen(false);
                    }}
                    className={clsx(
                      'flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors',
                      option.key === mode ? 'bg-accent-soft' : 'hover:bg-bg-elevated-2',
                    )}
                  >
                    <Icon size={15} strokeWidth={1.75} className={clsx('mt-0.5 shrink-0', option.key === mode ? 'text-accent' : 'text-fg-muted')} />
                    <span className="min-w-0">
                      <span className={clsx('block text-sm font-medium', option.key === mode ? 'text-accent' : 'text-fg')}>
                        {option.label}
                      </span>
                      <span className="block text-xs text-fg-muted">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
