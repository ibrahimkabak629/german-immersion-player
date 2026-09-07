import { motion } from 'framer-motion';
import clsx from 'clsx';
import { GERMAN_LEVELS, type GermanLevel } from '../../types/segment';

const LEVEL_HINTS: Record<GermanLevel, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper-Int.',
  C1: 'Advanced',
  C2: 'Mastery',
};

interface LevelSelectorProps {
  level: GermanLevel;
  onChange: (level: GermanLevel) => void;
}

export function LevelSelector({ level, onChange }: LevelSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="German level"
      title={LEVEL_HINTS[level]}
      className="flex items-center gap-0.5 rounded-full border border-border bg-bg-elevated-2 p-0.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
    >
      {GERMAN_LEVELS.map((l) => {
        const active = l === level;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            title={LEVEL_HINTS[l]}
            onClick={() => onChange(l)}
            className={clsx(
              'relative h-[22px] w-[22px] rounded-full text-[10px] font-medium transition-colors duration-150 sm:h-7 sm:w-9 sm:text-[12px]',
              active ? 'text-[oklch(16%_0.012_265)]' : 'text-fg-secondary hover:text-fg',
            )}
          >
            {active && (
              <motion.span
                layoutId="level-pill-active"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                className="absolute inset-0 rounded-full bg-accent shadow-[0_1px_4px_oklch(78%_0.16_75_/_0.5)]"
              />
            )}
            <span className="relative">{l}</span>
          </button>
        );
      })}
    </div>
  );
}
