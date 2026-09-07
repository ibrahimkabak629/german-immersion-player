import { Check, Loader2 } from 'lucide-react';
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
}

export function ProcessingOverlay({ step }: ProcessingOverlayProps) {
  const activeIndex = step ? STEPS.findIndex((s) => s.key === step) : -1;
  const progress = activeIndex === -1 ? 0.04 : (activeIndex + 1) / STEPS.length;

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-10 shadow-[var(--shadow-card)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-canvas-grid opacity-50" />

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
    </div>
  );
}
