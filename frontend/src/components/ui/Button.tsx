import { type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-accent text-[oklch(16%_0.012_265)] hover:bg-accent-strong shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset]',
  secondary: 'bg-bg-elevated-2 text-fg border border-border hover:border-border-strong',
  ghost: 'bg-transparent text-fg-secondary hover:text-fg hover:bg-bg-elevated-2',
};

export function Button({ variant = 'secondary', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3.5 py-2 text-sm font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 disabled:opacity-40',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
