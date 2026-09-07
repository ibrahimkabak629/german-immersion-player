import { useMemo } from 'react';
import type { Segment } from '../types/segment';

/**
 * Binary search over segments (sorted ascending by start) for the one
 * where start <= currentTime < end. Returns index -1 during gaps
 * (silence between lines) so callers can fade subtitles out cleanly
 * instead of showing stale text.
 */
export function useActiveSegment(segments: Segment[], currentTime: number) {
  return useMemo(() => {
    let lo = 0;
    let hi = segments.length - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const segment = segments[mid];

      if (currentTime < segment.start) {
        hi = mid - 1;
      } else if (currentTime >= segment.end) {
        lo = mid + 1;
      } else {
        return { index: mid, segment };
      }
    }

    return { index: -1, segment: null as Segment | null };
  }, [segments, currentTime]);
}
