import type { ReactNode } from 'react';

interface AppShellProps {
  topBar: ReactNode;
  videoArea: ReactNode;
  transcriptPanel: ReactNode;
  tutorPanel: ReactNode;
}

export function AppShell({ topBar, videoArea, transcriptPanel, tutorPanel }: AppShellProps) {
  return (
    <div className="flex h-screen flex-col bg-bg">
      {topBar}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_400px]">
        <main className="min-h-0 min-w-0 p-4 lg:p-5">{videoArea}</main>
        <aside className="flex min-h-0 flex-col border-t border-border lg:border-t-0 lg:border-l">
          <div className="min-h-0 flex-1 overflow-hidden">{transcriptPanel}</div>
          <div className="h-[360px] shrink-0 border-t border-border">{tutorPanel}</div>
        </aside>
      </div>
    </div>
  );
}
