import { Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { IconButton } from '../ui/IconButton';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  muted: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
}

export function VideoControls({
  isPlaying,
  currentTime,
  duration,
  muted,
  onPlayPause,
  onSeek,
  onToggleMute,
  onFullscreen,
}: VideoControlsProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="absolute inset-x-3 bottom-3 z-10 rounded-[var(--radius-lg)] border border-white/10 bg-black/40 px-3 py-2.5 backdrop-blur-md">
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="video-seek-range mb-1.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20"
        style={{
          background: `linear-gradient(to right, var(--accent) ${progress}%, rgba(255,255,255,0.2) ${progress}%)`,
        }}
        aria-label="Seek"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <IconButton label={isPlaying ? 'Pause' : 'Play'} onClick={onPlayPause} className="text-white hover:text-white hover:bg-white/10">
            {isPlaying ? <Pause size={16} strokeWidth={1.75} /> : <Play size={16} strokeWidth={1.75} />}
          </IconButton>
          <IconButton label={muted ? 'Unmute' : 'Mute'} onClick={onToggleMute} className="text-white hover:text-white hover:bg-white/10">
            {muted ? <VolumeX size={16} strokeWidth={1.75} /> : <Volume2 size={16} strokeWidth={1.75} />}
          </IconButton>
          <span className="ml-1 font-[family-name:var(--font-mono)] text-xs text-white/70">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <IconButton label="Fullscreen" onClick={onFullscreen} className="text-white hover:text-white hover:bg-white/10">
          <Maximize size={15} strokeWidth={1.75} />
        </IconButton>
      </div>
    </div>
  );
}
