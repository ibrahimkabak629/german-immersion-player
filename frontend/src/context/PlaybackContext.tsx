import { createContext, useContext, useMemo, useState, type ReactNode, type RefObject } from 'react';

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
}

interface PlaybackContextValue {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setIsPlaying: (p: boolean) => void;
  seekTo: (time: number) => void;
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

  const seekTo = useMemo(
    () => (time: number) => videoPlayerRef.current?.seekTo(time),
    [videoPlayerRef],
  );

  return (
    <PlaybackContext.Provider
      value={{ currentTime, duration, isPlaying, setCurrentTime, setDuration, setIsPlaying, seekTo }}
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
