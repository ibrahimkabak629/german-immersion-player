import { GraduationCap } from 'lucide-react';
import type { GermanLevel } from '../../types/segment';
import { LevelSelector } from '../controls/LevelSelector';
import { ThemeToggle } from '../controls/ThemeToggle';

interface TopBarProps {
  level: GermanLevel;
  onLevelChange: (level: GermanLevel) => void;
}

export function TopBar({ level, onLevelChange }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg px-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-accent-soft text-accent">
          <GraduationCap size={16} strokeWidth={1.75} />
        </span>
        <h1 className="font-[family-name:var(--font-display)] text-[17px] tracking-tight text-fg">
          Immersion<span className="text-accent">.</span>
        </h1>
      </div>

      <div className="flex items-center gap-2.5">
        <LevelSelector level={level} onChange={onLevelChange} />
        <div className="mx-1 h-5 w-px bg-border" />
        <ThemeToggle />
      </div>
    </header>
  );
}
