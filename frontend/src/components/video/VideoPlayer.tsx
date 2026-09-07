import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import type { Segment, VideoSource } from '../../types/segment';
import { nextLearningMode } from '../../types/learningMode';
import { usePlayback } from '../../context/PlaybackContext';
import type { VideoPlayerHandle } from '../../context/PlaybackContext';
import { useActiveSegment } from '../../hooks/useActiveSegment';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { useWordHighlight } from '../../hooks/useWordHighlight';
import { stepSpeed } from '../../lib/playbackSpeed';
import { ModeSelector } from './ModeSelector';
import { SpeakingPracticeCard } from './SpeakingPracticeCard';
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
  onWordClick?: (word: string, segment: Segment) => void;
  onEnded?: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(
  { source, segments, onSourceChange, onWordClick, onEnded },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSegmentIdRef = useRef<number | null>(null);

  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pausedSegment, setPausedSegment] = useState<Segment | null>(null);

  const {
    currentTime,
    duration,
    isPlaying,
    playbackRate,
    mode,
    subtitleOffset,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setPlaybackRate,
    setMode,
    setSubtitleOffset,
  } = usePlayback();
  // Subtitle offset shifts DISPLAY timing only: audio/video keep real time,
  // but the "active" segment is looked up at (time - offset).
  const { segment: activeSegment } = useActiveSegment(segments, currentTime - subtitleOffset);
  const wordHighlight = useWordHighlight(videoRef, activeSegment, subtitleOffset);

  const objectUrl = useObjectUrl(source?.kind === 'file' ? source.file : null);
  const resolvedSrc = source?.kind === 'file' ? objectUrl : source?.kind === 'url' ? source.url : null;

  function clearSpeakingPause() {
    lastSegmentIdRef.current = null;
    setPausedSegment(null);
  }

  useImperativeHandle(ref, () => ({
    seekTo(time: number) {
      if (videoRef.current) videoRef.current.currentTime = time;
      clearSpeakingPause();
    },
    replaySegment(start: number) {
      const video = videoRef.current;
      if (!video) return;
      clearSpeakingPause();
      video.currentTime = start;
      void video.play();
    },
  }));

  // "R" replays the segment currently on screen, "<"/">" nudge playback speed,
  // "M" cycles the learning mode — all ignored while typing anywhere else.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      if (e.key.toLowerCase() === 'r') {
        if (!activeSegment || !videoRef.current) return;
        e.preventDefault();
        clearSpeakingPause();
        videoRef.current.currentTime = activeSegment.start;
        void videoRef.current.play();
        return;
      }

      if (e.key === '<' || e.key === '>') {
        e.preventDefault();
        setPlaybackRate((prev) => stepSpeed(prev, e.key === '<' ? -1 : 1));
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setMode((prev) => nextLearningMode(prev));
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSegment, setPlaybackRate, setMode]);

  // Leaving speaking mode (or loading a new video) drops any pending pause-for-practice.
  useEffect(() => {
    clearSpeakingPause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, resolvedSrc]);

  // Keep the element's actual rate in sync with the saved preference, including
  // right after a new source loads (playbackRate is a property of the element,
  // not the resource, but we reassert it here to be safe across browsers).
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, resolvedSrc]);

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
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime;
    setCurrentTime(time);

    if (mode !== 'speaking' || pausedSegment) return;

    const lastId = lastSegmentIdRef.current;
    if (lastId !== null) {
      const justEnded = segments.find((s) => s.id === lastId);
      if (justEnded && time >= justEnded.end) {
        video.pause();
        // Snap just inside the segment (not exactly at its end) so the transcript
        // and subtitle still resolve to this line rather than the next one that
        // may start at the very same timestamp for back-to-back segments.
        video.currentTime = Math.max(justEnded.start, justEnded.end - 0.05);
        setPausedSegment(justEnded);
        lastSegmentIdRef.current = null;
        return;
      }
    }
    const current = segments.find((s) => time >= s.start && time < s.end);
    if (current) lastSegmentIdRef.current = current.id;
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
    clearSpeakingPause();
  }

  function handleResumeFromPractice() {
    setPausedSegment(null);
    void videoRef.current?.play();
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
    <div className="relative h-full">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 -z-10 opacity-40 blur-2xl"
        style={{
          background:
            'radial-gradient(closest-side, var(--accent-soft), transparent), radial-gradient(closest-side at 80% 90%, var(--de-red-soft), transparent)',
        }}
      />
      <div
        ref={containerRef}
        className="gradient-border relative h-full overflow-hidden rounded-[var(--radius-xl)] bg-black shadow-[var(--shadow-card)]"
      >
      <video
        ref={videoRef}
        src={resolvedSrc}
        crossOrigin="anonymous"
        className="h-full w-full object-contain"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={onEnded}
        onError={handleError}
      />

      <ModeSelector mode={mode} onChange={setMode} />

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

      <div className="pointer-events-none absolute inset-x-0 bottom-[64px] flex max-h-[45%] items-end justify-center px-3 sm:bottom-[84px] sm:max-h-[60%] sm:px-6">
        {pausedSegment ? (
          <AnimatePresence mode="wait">
            <SpeakingPracticeCard key={`practice-${pausedSegment.id}`} segment={pausedSegment} onResume={handleResumeFromPractice} />
          </AnimatePresence>
        ) : (
          <SubtitleOverlay
            segment={activeSegment}
            mode={mode}
            highlight={wordHighlight}
            onWordClick={onWordClick && activeSegment ? (word) => onWordClick(word, activeSegment) : undefined}
          />
        )}
      </div>

      <VideoControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        muted={muted}
        playbackRate={playbackRate}
        subtitleOffset={subtitleOffset}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onToggleMute={handleToggleMute}
        onFullscreen={handleFullscreen}
        onRateChange={setPlaybackRate}
        onSubtitleOffsetChange={setSubtitleOffset}
      />
      </div>
    </div>
  );
});
