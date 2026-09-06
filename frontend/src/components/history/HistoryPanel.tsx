import { History, Play, Trash2 } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { useLearningData } from '../../context/LearningDataContext';
import { usePlayback } from '../../context/PlaybackContext';

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  currentTitle: string | null;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '–';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function HistoryPanel({ open, onClose, currentTitle }: HistoryPanelProps) {
  const { history, wordBank, deleteHistoryEntry } = useLearningData();
  const { seekTo } = usePlayback();

  return (
    <Drawer open={open} onClose={onClose} title="Watch History" icon={<History size={15} strokeWidth={1.75} className="text-fg-muted" />}>
      {history.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <History size={22} strokeWidth={1.5} className="text-fg-muted" />
          <p className="text-sm text-fg-muted">Videos you process will show up here, with your progress saved.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {history.map((entry) => {
            const duration = entry.durationSeconds ?? 0;
            const furthest = entry.furthestSeconds ?? 0;
            const pct = duration > 0 ? Math.min(100, Math.round((furthest / duration) * 100)) : 0;
            const videoWords = wordBank.filter((w) => w.videoTitle === entry.title);
            const learned = videoWords.filter((w) => w.learned).length;
            const isCurrent = entry.title === currentTitle;
            const resumeAt = entry.lastPositionSeconds ?? 0;

            return (
              <li key={entry.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-[family-name:var(--font-display)] text-[15px] text-fg">{entry.title}</p>
                    <p className="mt-0.5 text-xs text-fg-muted">
                      {new Date(entry.completedAt).toLocaleDateString()} · {formatDuration(duration)} ·{' '}
                      <span className="rounded-full border border-border px-1.5 py-px text-[10px] font-medium">{entry.level}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isCurrent && resumeAt > 0 && (
                      <button
                        type="button"
                        title={`Resume at ${formatDuration(resumeAt)}`}
                        onClick={() => {
                          seekTo(resumeAt);
                          onClose();
                        }}
                        className="flex h-7 items-center gap-1 rounded-full bg-accent px-2.5 text-xs font-medium text-[oklch(16%_0.012_265)] transition-colors hover:bg-accent-strong"
                      >
                        <Play size={11} strokeWidth={2} fill="currentColor" />
                        Resume
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Delete ${entry.title} from history`}
                      onClick={() => deleteHistoryEntry(entry.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-de-red-soft hover:text-de-red"
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-elevated-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-fg-muted">
                    {pct}% watched
                  </span>
                </div>

                <p className="mt-1.5 text-xs text-fg-muted">
                  <span className="text-success">{learned}</span> of {videoWords.length} words learned
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
