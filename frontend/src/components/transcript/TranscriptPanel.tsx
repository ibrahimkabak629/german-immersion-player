import { useEffect, useRef } from 'react';
import { ScrollText } from 'lucide-react';
import type { Segment } from '../../types/segment';
import { usePlayback } from '../../context/PlaybackContext';
import { useActiveSegment } from '../../hooks/useActiveSegment';
import { TranscriptEntry } from './TranscriptEntry';

interface TranscriptPanelProps {
  segments: Segment[];
}

export function TranscriptPanel({ segments }: TranscriptPanelProps) {
  const { currentTime, seekTo } = usePlayback();
  const { index: activeIndex } = useActiveSegment(segments, currentTime);

  const entryRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (activeIndex < 0 || userScrollingRef.current) return;
    entryRefs.current[activeIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex]);

  function handleWheel() {
    userScrollingRef.current = true;
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 3000);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <ScrollText size={14} strokeWidth={1.75} className="text-fg-muted" />
        <h2 className="text-xs font-medium uppercase tracking-wide text-fg-muted">Transcript</h2>
      </div>
      <div onWheel={handleWheel} className="min-h-0 flex-1 overflow-y-auto p-2">
        {segments.map((segment, i) => (
          <TranscriptEntry
            key={segment.id}
            ref={(el) => {
              entryRefs.current[i] = el;
            }}
            segment={segment}
            isActive={i === activeIndex}
            onClick={() => seekTo(segment.start)}
          />
        ))}
      </div>
    </div>
  );
}
