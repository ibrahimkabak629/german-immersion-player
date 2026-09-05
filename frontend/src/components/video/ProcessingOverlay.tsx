import { Check, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { ProcessingStep } from '../../hooks/useVideoProcessing';

const STEPS: { key: ProcessingStep; label: string }[] = [
  { key: 'extracting_audio', label: 'Extracting audio' },
  { key: 'transcribing', label: 'Transcribing speech' },
  { key: 'translating', label: 'Translating to German' },
  { key: 'dubbing', label: 'Generating dubbed voice' },
  { key: 'syncing_subtitles', label: 'Syncing subtitles' },
];

interface ProcessingOverlayProps {
  step: ProcessingStep | null;
}

export function ProcessingOverlay({ step }: ProcessingOverlayProps) {
  const activeIndex = step ? STEPS.findIndex((s) => s.key === step) : -1;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-10">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Loader2 size={26} strokeWidth={1.75} className="animate-spin" />
      </div>

      <div className="w-full max-w-xs space-y-2.5">
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
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
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

      <p className="text-xs text-fg-muted">{activeIndex === -1 ? 'Starting…' : 'This can take a minute or two.'}</p>
    </div>
  );
}
