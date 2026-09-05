import { FileText, Video } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatFileSize } from '../../lib/format';
import { downloadBlob } from '../../lib/download';

interface DownloadBarProps {
  videoFile: File;
  srtBlob: Blob;
}

export function DownloadBar({ videoFile, srtBlob }: DownloadBarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-bg-elevated px-3.5 py-2.5">
      <Button variant="primary" onClick={() => downloadBlob(videoFile, 'dubbed_video.mp4')}>
        <Video size={14} strokeWidth={1.75} />
        Download video
        <span className="text-xs font-normal opacity-70">{formatFileSize(videoFile.size)}</span>
      </Button>
      <Button variant="secondary" onClick={() => downloadBlob(srtBlob, 'subtitles_dual.srt')}>
        <FileText size={14} strokeWidth={1.75} />
        Download subtitles
        <span className="text-xs font-normal text-fg-muted">{formatFileSize(srtBlob.size)}</span>
      </Button>
    </div>
  );
}
