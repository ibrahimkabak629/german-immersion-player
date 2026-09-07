import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, HelpCircle, PenLine, Sparkles, X } from 'lucide-react';
import { Logo } from '../ui/Logo';

export type PracticeOption = 'flashcards' | 'fill-blank' | 'quiz' | 'grammar';

interface PostVideoPopupProps {
  open: boolean;
  onSkip: () => void;
  onDontAskAgain: () => void;
  onSelect: (option: PracticeOption) => void;
}

const OPTIONS: { key: PracticeOption; label: string; icon: typeof BookOpen }[] = [
  { key: 'flashcards', label: 'Flashcards', icon: BookOpen },
  { key: 'fill-blank', label: 'Fill in the blanks', icon: PenLine },
  { key: 'quiz', label: 'Quick quiz', icon: Sparkles },
  { key: 'grammar', label: 'Grammar help', icon: HelpCircle },
];

export function PostVideoPopup({ open, onSkip, onDontAskAgain, onSelect }: PostVideoPopupProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="gradient-border fixed bottom-4 right-4 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-[var(--radius-lg)] bg-bg-elevated p-3.5 shadow-[var(--shadow-float)]"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-elevated-2">
              <Logo size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium leading-snug text-fg">Nice watch! Want to practice?</p>
            </div>
            <button
              type="button"
              onClick={onSkip}
              aria-label="Close"
              className="-mr-1 -mt-1 shrink-0 rounded p-1 text-fg-muted transition-colors hover:bg-bg-elevated-2 hover:text-fg"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {OPTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                className="flex flex-col items-start gap-1.5 rounded-[var(--radius-md)] border border-border bg-bg-elevated-2 px-2.5 py-2 text-left transition-colors hover:border-border-strong hover:bg-bg"
              >
                <Icon size={14} strokeWidth={1.75} className="text-accent" />
                <span className="text-[12px] font-medium leading-tight text-fg-secondary">{label}</span>
              </button>
            ))}
          </div>

          <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
            <button type="button" onClick={onDontAskAgain} className="text-xs text-fg-muted transition-colors hover:text-fg-secondary">
              Don't ask again
            </button>
            <button type="button" onClick={onSkip} className="text-xs font-medium text-fg-secondary transition-colors hover:text-fg">
              Skip
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
