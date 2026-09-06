import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookMarked, History, Menu, SlidersHorizontal, Sparkles } from 'lucide-react';
import clsx from 'clsx';

interface NavMenuProps {
  variant: 'rail' | 'menu';
  onWordBank: () => void;
  onHistory: () => void;
  onDailyChallenge: () => void;
  onSettings: () => void;
}

const ITEMS = [
  { key: 'wordBank', label: 'Word Bank', icon: BookMarked },
  { key: 'history', label: 'Watch History', icon: History },
  { key: 'dailyChallenge', label: 'Daily Challenge', icon: Sparkles },
  { key: 'settings', label: 'Settings', icon: SlidersHorizontal },
] as const;

export function NavMenu({ variant, onWordBank, onHistory, onDailyChallenge, onSettings }: NavMenuProps) {
  const [open, setOpen] = useState(false);

  const actions: Record<(typeof ITEMS)[number]['key'], () => void> = {
    wordBank: onWordBank,
    history: onHistory,
    dailyChallenge: onDailyChallenge,
    settings: onSettings,
  };

  if (variant === 'rail') {
    return (
      <nav className="flex w-14 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-bg py-4">
        {ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={label}
            onClick={actions[key]}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-fg-secondary transition-colors hover:bg-bg-elevated-2 hover:text-fg"
          >
            <Icon size={18} strokeWidth={1.75} />
          </button>
        ))}
      </nav>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] transition-colors sm:h-9 sm:w-9',
          open ? 'bg-bg-elevated-2 text-fg' : 'text-fg-secondary hover:bg-bg-elevated-2 hover:text-fg',
        )}
      >
        <Menu size={16} strokeWidth={1.75} className="sm:hidden" />
        <Menu size={18} strokeWidth={1.75} className="hidden sm:block" />
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
              className="absolute right-0 z-50 mt-1.5 min-w-[10rem] overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-bg-elevated py-1 shadow-[var(--shadow-float)]"
            >
              {ITEMS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    actions[key]();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-fg-secondary transition-colors hover:bg-bg-elevated-2 hover:text-fg"
                >
                  <Icon size={15} strokeWidth={1.75} className="text-fg-muted" />
                  {label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
