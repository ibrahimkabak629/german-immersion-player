import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, icon, children, maxWidth = 'max-w-md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
          />
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className={`gradient-border relative flex max-h-[85vh] w-full ${maxWidth} flex-col rounded-t-[var(--radius-xl)] bg-bg-elevated shadow-[var(--shadow-float)] sm:rounded-[var(--radius-xl)]`}
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5">
                <div className="flex items-center gap-2">
                  {icon}
                  <h2 className="font-[family-name:var(--font-display)] text-[15px] text-fg">{title}</h2>
                </div>
                <IconButton label="Close" onClick={onClose}>
                  <X size={16} strokeWidth={1.75} />
                </IconButton>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
