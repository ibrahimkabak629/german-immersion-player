import { Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { PlaybackSpeedControl } from './PlaybackSpeedControl';
import { SubtitleDelayControl } from './SubtitleDelayControl';

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
  playbackRate: number;
  subtitleOffset: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
  onRateChange: (rate: number) => void;
  onSubtitleOffsetChange: (offset: number | ((prev: number) => number)) => void;
}

export function VideoControls({
  isPlaying,
  currentTime,
  duration,
  muted,
  playbackRate,
  subtitleOffset,
  onPlayPause,
  onSeek,
  onToggleMute,
  onFullscreen,
  onRateChange,
  onSubtitleOffsetChange,
}: VideoControlsProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="absolute inset-x-2 bottom-2 z-10 rounded-[var(--radius-lg)] border border-white/10 bg-black/50 px-3 py-2.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md sm:inset-x-3 sm:bottom-3">
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
        <div className="flex items-center gap-0.5 sm:gap-1">
          <IconButton
            label={isPlaying ? 'Pause' : 'Play'}
            onClick={onPlayPause}
            className="text-white hover:bg-white/10 hover:text-white active:scale-90"
          >
            {isPlaying ? <Pause size={16} strokeWidth={1.75} /> : <Play size={16} strokeWidth={1.75} />}
          </IconButton>
          <IconButton
            label={muted ? 'Unmute' : 'Mute'}
            onClick={onToggleMute}
            className="text-white hover:bg-white/10 hover:text-white active:scale-90"
          >
            {muted ? <VolumeX size={16} strokeWidth={1.75} /> : <Volume2 size={16} strokeWidth={1.75} />}
          </IconButton>
          <span className="ml-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-white/70 sm:text-xs">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <SubtitleDelayControl offset={subtitleOffset} onChange={onSubtitleOffsetChange} />
          <PlaybackSpeedControl rate={playbackRate} onChange={onRateChange} />
          <IconButton label="Fullscreen" onClick={onFullscreen} className="text-white hover:bg-white/10 hover:text-white active:scale-90">
            <Maximize size={15} strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
