import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Segment, VideoSource } from '../../types/segment';
import { usePlayback } from '../../context/PlaybackContext';
import type { VideoPlayerHandle } from '../../context/PlaybackContext';
import { useActiveSegment } from '../../hooks/useActiveSegment';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { SubtitleOverlay } from './SubtitleOverlay';
import { VideoControls } from './VideoControls';
import { VideoErrorBanner } from './VideoErrorBanner';
import { VideoSourceBar } from './VideoSourceBar';
import { IconButton } from '../ui/IconButton';

const LOAD_TIMEOUT_MS = 8000;

interface VideoPlayerProps {
  source: VideoSource;
  segments: Segment[];
  onSourceChange: (source: VideoSource) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(
  { source, segments, onSourceChange },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { currentTime, duration, isPlaying, setCurrentTime, setDuration, setIsPlaying } = usePlayback();
  const { segment: activeSegment } = useActiveSegment(segments, currentTime);

  const objectUrl = useObjectUrl(source?.kind === 'file' ? source.file : null);
  const resolvedSrc = source?.kind === 'file' ? objectUrl : source?.kind === 'url' ? source.url : null;

  useImperativeHandle(ref, () => ({
    seekTo(time: number) {
      if (videoRef.current) videoRef.current.currentTime = time;
    },
  }));

  useEffect(() => {
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    if (resolvedSrc) {
      loadTimeoutRef.current = setTimeout(() => {
        setError("This video couldn't be loaded — the host may be blocking playback, or the link isn't a playable file.");
      }, LOAD_TIMEOUT_MS);
    }

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSrc]);

  function handleLoadedMetadata() {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    if (videoRef.current) setDuration(videoRef.current.duration);
  }

  function handleTimeUpdate() {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }

  function handleError() {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setError("This video couldn't be loaded. It may be an unsupported format, or the host may be blocking playback.");
  }

  function handlePlayPause() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  function handleSeek(time: number) {
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  }

  function handleToggleMute() {
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
    setMuted((m) => !m);
  }

  function handleFullscreen() {
    containerRef.current?.requestFullscreen?.();
  }

  if (!resolvedSrc) {
    return (
      <div className="h-full">
        <VideoSourceBar onSourceChange={onSourceChange} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full overflow-hidden rounded-[var(--radius-xl)] border border-border bg-black">
      <video
        ref={videoRef}
        src={resolvedSrc}
        crossOrigin="anonymous"
        className="h-full w-full object-contain"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={handleError}
      />

      <div className="absolute right-3 top-3 z-10">
        <IconButton
          label="Change video"
          onClick={() => onSourceChange(null)}
          className="bg-black/40 text-white backdrop-blur-md hover:bg-black/60 hover:text-white"
        >
          <RefreshCw size={14} strokeWidth={1.75} />
        </IconButton>
      </div>

      {error && (
        <VideoErrorBanner
          message={error}
          onDismiss={() => setError(null)}
          onTryUpload={() => {
            setError(null);
            onSourceChange(null);
          }}
        />
      )}

      <SubtitleOverlay segment={activeSegment} />

      <VideoControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        muted={muted}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onToggleMute={handleToggleMute}
        onFullscreen={handleFullscreen}
      />
    </div>
  );
});
