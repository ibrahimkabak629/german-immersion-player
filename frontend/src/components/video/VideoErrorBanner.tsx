import { AlertTriangle, Upload, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';

interface VideoErrorBannerProps {
  message: string;
  onDismiss: () => void;
  onTryUpload: () => void;
}

export function VideoErrorBanner({ message, onDismiss, onTryUpload }: VideoErrorBannerProps) {
  return (
    <div className="absolute inset-x-4 top-4 z-20 flex items-start gap-3 rounded-[var(--radius-md)] border border-[oklch(48%_0.19_25_/_0.4)] bg-[oklch(20%_0.03_25)] p-3.5 shadow-[var(--shadow-float)]">
      <span className="mt-0.5 text-de-red">
        <AlertTriangle size={18} strokeWidth={1.75} />
      </span>
      <div className="flex-1">
        <p className="text-sm text-fg">{message}</p>
        <Button variant="secondary" className="mt-2.5" onClick={onTryUpload}>
          <Upload size={14} strokeWidth={1.75} />
          Try uploading instead
        </Button>
      </div>
      <IconButton label="Dismiss" onClick={onDismiss}>
        <X size={15} strokeWidth={1.75} />
      </IconButton>
    </div>
  );
}
