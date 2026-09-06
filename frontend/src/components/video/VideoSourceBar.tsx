import { useRef, useState } from 'react';
import { Link2, Upload } from 'lucide-react';
import clsx from 'clsx';
import type { VideoSource } from '../../types/segment';
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';

const DIRECT_VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogg|ogv)(\?.*)?$/i;
const PAGE_LINK_HOSTS = /(youtube\.com|youtu\.be|vimeo\.com(?!.*\.mp4)|tiktok\.com|twitch\.tv)/i;

interface VideoSourceBarProps {
  onSourceChange: (source: VideoSource) => void;
  compact?: boolean;
}

export function VideoSourceBar({ onSourceChange, compact = false }: VideoSourceBarProps) {
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [urlDraft, setUrlDraft] = useState('');
  const [urlWarning, setUrlWarning] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChosen(file: File | undefined) {
    if (!file) return;
    onSourceChange({ kind: 'file', file });
  }

  function handleUrlSubmit() {
    const url = urlDraft.trim();
    if (!url) return;

    if (!DIRECT_VIDEO_EXTENSIONS.test(url) && PAGE_LINK_HOSTS.test(url)) {
      setUrlWarning(
        "This looks like a page link, not a direct video file — the player can't embed it. Try the direct .mp4 link, or download and upload the file instead.",
      );
      return;
    }

    setUrlWarning(null);
    onSourceChange({ kind: 'url', url });
  }

  return (
    <div
      onDragOver={(e) => {
        if (tab !== 'upload') return;
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (tab !== 'upload') return;
        e.preventDefault();
        setIsDragOver(false);
        handleFileChosen(e.dataTransfer.files?.[0]);
      }}
      className={clsx(
        'relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[var(--radius-xl)] border bg-bg-elevated transition-colors',
        isDragOver ? 'border-accent bg-accent-soft' : 'border-border',
        compact ? 'p-5' : 'h-full p-8 sm:p-10',
      )}
    >
      {!compact && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-canvas-grid opacity-60"
        />
      )}

      {!compact && (
        <div className="relative flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-bg-elevated-2 p-3 shadow-[var(--shadow-card)]">
            <Logo size={40} />
          </div>
          <div className="text-center">
            <h2 className="font-[family-name:var(--font-display)] text-xl text-fg">Drop a video to begin</h2>
            <p className="mt-1 text-sm text-fg-muted">We'll transcribe, translate, and dub it — automatically.</p>
          </div>
        </div>
      )}

      <div className="relative flex rounded-[var(--radius-sm)] border border-border bg-bg-elevated-2 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={clsx(
            'rounded-[calc(var(--radius-sm)-2px)] px-3 py-1.5 font-medium transition-colors',
            tab === 'upload' ? 'bg-accent text-[oklch(16%_0.012_265)]' : 'text-fg-secondary hover:text-fg',
          )}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => setTab('url')}
          className={clsx(
            'rounded-[calc(var(--radius-sm)-2px)] px-3 py-1.5 font-medium transition-colors',
            tab === 'url' ? 'bg-accent text-[oklch(16%_0.012_265)]' : 'text-fg-secondary hover:text-fg',
          )}
        >
          Paste URL
        </button>
      </div>

      {tab === 'upload' ? (
        <div className="relative flex flex-col items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFileChosen(e.target.files?.[0])}
          />
          <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} strokeWidth={1.75} />
            Choose a video file
          </Button>
          {!compact && <p className="text-xs text-fg-muted">or drag and drop &middot; MP4, WebM, MOV, and more</p>}
        </div>
      ) : (
        <div className="relative flex w-full max-w-sm flex-col items-center gap-2">
          <div className="flex w-full items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-bg-elevated-2 px-3 py-2">
              <Link2 size={14} strokeWidth={1.75} className="text-fg-muted" />
              <input
                type="text"
                value={urlDraft}
                onChange={(e) => {
                  setUrlDraft(e.target.value);
                  setUrlWarning(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                placeholder="https://example.com/video.mp4"
                className="w-full bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none"
              />
            </div>
            <Button variant="primary" onClick={handleUrlSubmit}>
              Load
            </Button>
          </div>
          {urlWarning && <p className="text-xs text-de-red">{urlWarning}</p>}
        </div>
      )}
    </div>
  );
}
