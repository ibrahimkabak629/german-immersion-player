import { useState, type ReactNode } from 'react';
import { MessageCircleQuestion, ScrollText } from 'lucide-react';
import clsx from 'clsx';
import { NavMenu } from './NavMenu';

interface AppShellProps {
  topBar: ReactNode;
  videoArea: ReactNode;
  transcriptPanel: ReactNode;
  tutorPanel: ReactNode;
  onWordBank: () => void;
  onHistory: () => void;
  onDailyChallenge: () => void;
  onSettings: () => void;
}

type MobileTab = 'transcript' | 'tutor';

export function AppShell({ topBar, videoArea, transcriptPanel, tutorPanel, onWordBank, onHistory, onDailyChallenge, onSettings }: AppShellProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>('transcript');

  return (
    <div className="flex h-screen bg-bg">
      <div className="hidden lg:flex">
        <NavMenu variant="rail" onWordBank={onWordBank} onHistory={onHistory} onDailyChallenge={onDailyChallenge} onSettings={onSettings} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {topBar}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_400px]">
          <main className="relative min-h-0 min-w-0 overflow-hidden bg-canvas-grid p-3 sm:p-4 lg:p-5">{videoArea}</main>

          <aside className="flex min-h-0 flex-col border-t border-border lg:border-t-0 lg:border-l">
            {/* Mobile: tab switcher between Transcript and Tutor, each panel fills the remaining viewport */}
            <div className="flex shrink-0 border-b border-border lg:hidden">
              <TabButton
                icon={<ScrollText size={13} strokeWidth={1.75} />}
                label="Transcript"
                active={mobileTab === 'transcript'}
                onClick={() => setMobileTab('transcript')}
              />
              <TabButton
                icon={<MessageCircleQuestion size={13} strokeWidth={1.75} />}
                label="AI Tutor"
                active={mobileTab === 'tutor'}
                onClick={() => setMobileTab('tutor')}
              />
            </div>

            <div className={clsx('min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col', mobileTab !== 'transcript' && 'hidden')}>
              <div className="h-full min-h-0 lg:h-auto lg:flex-1">{transcriptPanel}</div>
            </div>
            <div className={clsx('min-h-0 flex-1 overflow-hidden border-border lg:h-[360px] lg:shrink-0 lg:flex-none lg:border-t', mobileTab !== 'tutor' && 'hidden lg:block')}>
              <div className="h-full min-h-0">{tutorPanel}</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium uppercase tracking-wide transition-colors',
        active ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary',
      )}
    >
      {icon}
      {label}
      {active && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-accent" />}
    </button>
  );
}
