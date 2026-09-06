import { useEffect, useRef } from 'react';
import { usePlayback } from '../../context/PlaybackContext';
import { useLearningData } from '../../context/LearningDataContext';

const SAVE_INTERVAL_SECONDS = 5;
const RESUME_MIN_SECONDS = 10;
const RESUME_END_MARGIN_SECONDS = 10;

/**
 * Invisible helper mounted while a video is loaded: persists watch progress
 * into the history entry (throttled), keeps its duration honest once real
 * metadata arrives, and resumes playback position when the same video
 * comes back.
 */
export function VideoSessionManager({ title }: { title: string }) {
  const { currentTime, duration, isPlaying, seekTo } = usePlayback();
  const { history, updateWatchProgress } = useLearningData();

  const lastSavedRef = useRef(0);
  const resumedTitleRef = useRef<string | null>(null);

  // Resume once per video, as soon as real metadata (duration) is in.
  useEffect(() => {
    if (duration <= 0 || resumedTitleRef.current === title) return;
    resumedTitleRef.current = title;
    const entry = history.find((e) => e.title === title);
    const saved = entry?.lastPositionSeconds ?? 0;
    if (saved >= RESUME_MIN_SECONDS && saved <= duration - RESUME_END_MARGIN_SECONDS) {
      seekTo(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, title]);

  // Throttled progress save while playing.
  useEffect(() => {
    if (Math.abs(currentTime - lastSavedRef.current) < SAVE_INTERVAL_SECONDS) return;
    lastSavedRef.current = currentTime;
    updateWatchProgress(title, currentTime, duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime]);

  // Pausing is the natural "I'm leaving off here" moment — save it exactly.
  useEffect(() => {
    if (isPlaying || currentTime <= 0) return;
    lastSavedRef.current = currentTime;
    updateWatchProgress(title, currentTime, duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  return null;
}
