import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';

interface ProcessingErrorPanelProps {
  message: string;
  onRetry: () => void;
}

export function ProcessingErrorPanel({ message, onRetry }: ProcessingErrorPanelProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-10 text-center shadow-[var(--shadow-card)]">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-de-red-soft text-de-red">
        <AlertTriangle size={26} strokeWidth={1.5} />
      </span>
      <p className="max-w-sm text-sm text-fg-secondary">{message}</p>
      <Button variant="primary" onClick={onRetry}>
        Try another video
      </Button>
    </div>
  );
}
