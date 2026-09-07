import { Check, Clock, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { ProcessingStep } from '../../hooks/useVideoProcessing';
import { Logo } from '../ui/Logo';

const STEPS: { key: ProcessingStep; label: string }[] = [
  { key: 'extracting_audio', label: 'Extracting audio' },
  { key: 'transcribing', label: 'Transcribing speech' },
  { key: 'diarizing', label: 'Detecting speakers' },
  { key: 'translating', label: 'Translating to German' },
  { key: 'dubbing', label: 'Generating dubbed voice' },
  { key: 'syncing_subtitles', label: 'Syncing subtitles' },
];

interface ProcessingOverlayProps {
  step: ProcessingStep | null;
  /** Position in the processing queue (1 = next up). Renders a "queued" view instead of the step checklist while set. */
  queuePosition?: number | null;
}

function OverlayShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-10 shadow-[var(--shadow-card)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-canvas-grid opacity-50" />
      {children}
    </div>
  );
}

export function ProcessingOverlay({ step, queuePosition }: ProcessingOverlayProps) {
  if (queuePosition != null) {
    return (
      <OverlayShell>
        <div className="relative animate-pulse rounded-2xl bg-bg-elevated-2 p-3">
          <Logo size={32} />
        </div>
        <div className="relative flex flex-col items-center gap-2 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-accent bg-accent-soft text-accent">
            <Clock size={18} strokeWidth={2} />
          </span>
          <p className="text-sm font-medium text-fg">
            {queuePosition <= 1 ? 'Up next' : `Queued — position ${queuePosition}`}
          </p>
          <p className="text-xs text-fg-muted">
            {queuePosition <= 1
              ? 'Your video will start processing shortly.'
              : `${queuePosition - 1} video${queuePosition - 1 === 1 ? '' : 's'} ahead of you.`}
          </p>
        </div>
      </OverlayShell>
    );
  }

  const activeIndex = step ? STEPS.findIndex((s) => s.key === step) : -1;
  const progress = activeIndex === -1 ? 0.04 : (activeIndex + 1) / STEPS.length;

  return (
    <OverlayShell>
      <div className="relative animate-pulse rounded-2xl bg-bg-elevated-2 p-3">
        <Logo size={32} />
      </div>

      <div className="relative w-full max-w-xs space-y-2.5">
        {STEPS.map((s, i) => {
          const isDone = activeIndex > i || step === 'done';
          const isActive = activeIndex === i;
          return (
            <div
              key={s.key}
              className={clsx(
                'flex items-center gap-2.5 text-sm transition-colors',
                isDone || isActive ? 'text-fg' : 'text-fg-muted',
              )}
            >
              <span
                className={clsx(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isDone ? 'border-accent bg-accent-soft text-accent' : isActive ? 'border-accent text-accent' : 'border-border',
                )}
              >
                {isDone ? <Check size={12} strokeWidth={2} /> : isActive ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : null}
              </span>
              {s.label}
            </div>
          );
        })}
      </div>

      <div className="relative h-1 w-full max-w-xs overflow-hidden rounded-full bg-bg-elevated-2">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <p className="relative text-xs text-fg-muted">{activeIndex === -1 ? 'Starting…' : 'This can take a minute or two.'}</p>
    </OverlayShell>
  );
}
