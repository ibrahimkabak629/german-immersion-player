import { type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function IconButton({ label, className, children, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-fg-secondary transition-colors duration-150 hover:text-fg hover:bg-bg-elevated-2 disabled:opacity-40 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
