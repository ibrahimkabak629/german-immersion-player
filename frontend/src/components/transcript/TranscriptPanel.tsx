import { useEffect, useRef } from 'react';
import { ScrollText } from 'lucide-react';
import type { Segment } from '../../types/segment';
import { usePlayback } from '../../context/PlaybackContext';
import { useActiveSegment } from '../../hooks/useActiveSegment';
import { TranscriptEntry } from './TranscriptEntry';

interface TranscriptPanelProps {
  segments: Segment[];
  onWordClick?: (word: string, segment: Segment) => void;
}

export function TranscriptPanel({ segments, onWordClick }: TranscriptPanelProps) {
  const { currentTime, subtitleOffset, seekTo, replaySegment } = usePlayback();
  const { index: activeIndex } = useActiveSegment(segments, currentTime - subtitleOffset);

  const entryRefs = useRef<(HTMLDivElement | null)[]>([]);
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
      <div className="hidden shrink-0 items-center justify-between border-b border-border px-4 py-3 lg:flex">
        <div className="flex items-center gap-2">
          <ScrollText size={14} strokeWidth={1.75} className="text-fg-muted" />
          <h2 className="text-xs font-medium uppercase tracking-wide text-fg-muted">Transcript</h2>
        </div>
        {segments.length > 0 && (
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-fg-muted">{segments.length} lines</span>
        )}
      </div>
      <div onWheel={handleWheel} className="min-h-0 flex-1 overflow-y-auto p-2">
        {segments.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <ScrollText size={20} strokeWidth={1.5} className="text-fg-muted" />
            <p className="text-sm text-fg-muted">The transcript will appear here once a video is processed.</p>
          </div>
        ) : (
          segments.map((segment, i) => (
            <TranscriptEntry
              key={segment.id}
              ref={(el) => {
                entryRefs.current[i] = el;
              }}
              segment={segment}
              isActive={i === activeIndex}
              onClick={() => seekTo(segment.start)}
              onWordClick={(word) => onWordClick?.(word, segment)}
              onReplay={() => replaySegment(segment.start)}
            />
          ))
        )}
      </div>
    </div>
  );
}
