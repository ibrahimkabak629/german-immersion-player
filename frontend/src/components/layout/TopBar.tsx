import type { GermanLevel } from '../../types/segment';
import { LevelSelector } from '../controls/LevelSelector';
import { ThemeToggle } from '../controls/ThemeToggle';
import { Logo } from '../ui/Logo';
import { NavMenu } from './NavMenu';

interface TopBarProps {
  level: GermanLevel;
  onLevelChange: (level: GermanLevel) => void;
  onWordBank: () => void;
  onDailyChallenge: () => void;
  onSettings: () => void;
}

export function TopBar({ level, onLevelChange, onWordBank, onDailyChallenge, onSettings }: TopBarProps) {
  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg px-4 sm:px-5">
      <div className="flex items-center gap-2.5">
        <Logo size={26} className="shrink-0 drop-shadow-[0_2px_8px_oklch(78%_0.16_75_/_0.35)]" />
        <h1 className="font-[family-name:var(--font-display)] text-[17px] tracking-tight text-fg">
          Immersion<span className="text-accent">.</span>
        </h1>
        <span className="hidden select-none rounded-full border border-border px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-fg-muted sm:inline">
          DE
        </span>
      </div>

      <div className="flex items-center gap-1 sm:gap-2.5">
        <LevelSelector level={level} onChange={onLevelChange} />
        <div className="hidden h-5 w-px bg-border sm:mx-1 sm:block" />
        <div className="lg:hidden">
          <NavMenu variant="menu" onWordBank={onWordBank} onDailyChallenge={onDailyChallenge} onSettings={onSettings} />
        </div>
        <ThemeToggle />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px opacity-70"
        style={{ background: 'linear-gradient(90deg, transparent, var(--accent-soft) 20%, var(--de-red-soft) 55%, transparent 85%)' }}
      />
    </header>
  );
}
