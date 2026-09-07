import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Segment } from '../types/segment';

export interface WordHighlight {
  /** Index of the currently spoken word in the ORIGINAL (English) line, or -1. */
  originalIndex: number;
  /** Proportionally mapped index for the GERMAN line, or -1. */
  translatedIndex: number;
  /** False when the segment has no word timings — callers render plain text. */
  available: boolean;
}

const NONE: WordHighlight = { originalIndex: -1, translatedIndex: -1, available: false };

/** Trailing grace after a word's end before it stops being highlighted. */
const TAIL_SECONDS = 0.35;

function computeIndices(segment: Segment, time: number): { originalIndex: number; translatedIndex: number } {
  const words = segment.words!;

  let originalIndex = -1;
  for (let i = 0; i < words.length; i++) {
    if (time >= words[i].start) originalIndex = i;
    else break;
  }
  if (originalIndex >= 0 && time > words[originalIndex].end + TAIL_SECONDS) originalIndex = -1;
  if (originalIndex < 0) return { originalIndex: -1, translatedIndex: -1 };

  // The German line is a rewrite with no timings of its own, so its highlight
  // is mapped proportionally through the segment's word progress.
  const germanWordCount = segment.translated.split(/\s+/).filter(Boolean).length;
  const progress = words.length > 1 ? originalIndex / (words.length - 1) : 0;
  const translatedIndex =
    germanWordCount > 0 ? Math.min(germanWordCount - 1, Math.round(progress * (germanWordCount - 1))) : -1;

  return { originalIndex, translatedIndex };
}

/**
 * Tracks which word is being spoken in the active segment.
 *
 * Reads the media element directly on an animation frame rather than the
 * throttled `timeupdate` state (which fires only ~4x/sec and would make the
 * highlight visibly lag), but only re-renders when the word index actually
 * changes — so it stays smooth without a 60fps render loop.
 */
export function useWordHighlight(
  videoRef: RefObject<HTMLVideoElement | null>,
  segment: Segment | null,
  offsetSeconds: number,
): WordHighlight {
  // State carries the segment it was computed for, so a highlight from the
  // previous line can never flash onto the next one before the effect reruns.
  const [state, setState] = useState<{ segmentId: number | null; originalIndex: number; translatedIndex: number }>({
    segmentId: null,
    originalIndex: -1,
    translatedIndex: -1,
  });
  const latestRef = useRef(state);

  const hasWords = !!segment?.words?.length;
  const segmentId = segment?.id ?? null;

  useEffect(() => {
    if (!hasWords || !segment) return;

    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        const { originalIndex, translatedIndex } = computeIndices(segment, video.currentTime - offsetSeconds);
        const prev = latestRef.current;
        if (prev.segmentId !== segmentId || prev.originalIndex !== originalIndex || prev.translatedIndex !== translatedIndex) {
          const next = { segmentId, originalIndex, translatedIndex };
          latestRef.current = next;
          setState(next);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentId, hasWords, offsetSeconds]);

  // Derived during render: only surface a highlight that belongs to the
  // segment currently on screen, and only when it actually has timings.
  if (!hasWords || state.segmentId !== segmentId) return NONE;
  return { originalIndex: state.originalIndex, translatedIndex: state.translatedIndex, available: true };
}
