import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useClickOutside } from '../../hooks/useClickOutside';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  triggerLabel?: string;
  className?: string;
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  triggerLabel,
  className,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useClickOutside(rootRef, () => setOpen(false));

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={clsx(
          'flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-bg-elevated-2 px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:border-border-strong',
        )}
      >
        {triggerLabel && <span className="text-fg-muted font-normal">{triggerLabel}</span>}
        <span>{current?.label ?? value}</span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={clsx('text-fg-muted transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 z-20 mt-1.5 min-w-[9rem] overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-bg-elevated py-1 shadow-[var(--shadow-float)]"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={clsx(
                  'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm transition-colors',
                  option.value === value
                    ? 'text-accent bg-accent-soft'
                    : 'text-fg-secondary hover:text-fg hover:bg-bg-elevated-2',
                )}
              >
                <span>{option.label}</span>
                {option.hint && <span className="text-xs text-fg-muted">{option.hint}</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
