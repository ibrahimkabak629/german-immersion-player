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
    <div className="absolute inset-x-4 top-4 z-20 flex items-start gap-3 rounded-[var(--radius-md)] border border-de-red/40 border-l-[3px] bg-black/55 p-3.5 shadow-[var(--shadow-float)] backdrop-blur-md">
      <span className="mt-0.5 text-de-red">
        <AlertTriangle size={18} strokeWidth={1.75} />
      </span>
      <div className="flex-1">
        <p className="text-sm text-white">{message}</p>
        <Button variant="secondary" className="mt-2.5" onClick={onTryUpload}>
          <Upload size={14} strokeWidth={1.75} />
          Try uploading instead
        </Button>
      </div>
      <IconButton label="Dismiss" onClick={onDismiss} className="text-white/70 hover:bg-white/10 hover:text-white">
        <X size={15} strokeWidth={1.75} />
      </IconButton>
    </div>
  );
}
