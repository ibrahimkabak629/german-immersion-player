import { createContext, useContext, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { LearningMode } from '../types/learningMode';

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
  replaySegment: (start: number) => void;
}

interface PlaybackContextValue {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  mode: LearningMode;
  /** Display-only shift for subtitles/transcript sync, in seconds (video and audio untouched). */
  subtitleOffset: number;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setIsPlaying: (p: boolean) => void;
  setPlaybackRate: (rate: number | ((prev: number) => number)) => void;
  setMode: (mode: LearningMode | ((prev: LearningMode) => LearningMode)) => void;
  setSubtitleOffset: (offset: number | ((prev: number) => number)) => void;
  seekTo: (time: number) => void;
  replaySegment: (start: number) => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function PlaybackProvider({
  children,
  videoPlayerRef,
}: {
  children: ReactNode;
  videoPlayerRef: RefObject<VideoPlayerHandle | null>;
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useLocalStorage<number>('gip-playback-rate', 1);
  const [mode, setMode] = useLocalStorage<LearningMode>('gip-learning-mode', 'reading');
  // Per-video persistence lives in VideoSessionManager; this is just the live value.
  const [subtitleOffset, setSubtitleOffset] = useState(0);

  const seekTo = useMemo(
    () => (time: number) => videoPlayerRef.current?.seekTo(time),
    [videoPlayerRef],
  );

  const replaySegment = useMemo(
    () => (start: number) => videoPlayerRef.current?.replaySegment(start),
    [videoPlayerRef],
  );

  return (
    <PlaybackContext.Provider
      value={{
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
        seekTo,
        replaySegment,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlayback must be used within a PlaybackProvider');
  return ctx;
}
