import type { Segment } from '../types/segment';

const TIMESTAMP_RE = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/;

function parseTimestamp(raw: string): number {
  const match = raw.match(TIMESTAMP_RE);
  if (!match) return 0;
  const [, hours, minutes, seconds, millis] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(millis) / 1000;
}

/**
 * Parses the dual-language SRT produced by subtitle_sync.py's generate_dual_srt()
 * (German on the first text line, English on the second) into the frontend's
 * Segment shape.
 */
export function parseDualSrt(srtText: string): Segment[] {
  const blocks = srtText.replace(/\r\n/g, '\n').trim().split(/\n\n+/);
  const segments: Segment[] = [];

  blocks.forEach((block, index) => {
    const lines = block.split('\n').filter((line) => line.length > 0);
    if (lines.length < 4) return;

    const [, timestampLine, german, ...englishLines] = lines;
    const [startRaw, endRaw] = timestampLine.split('-->');
    if (!startRaw || !endRaw) return;

    segments.push({
      id: index,
      start: parseTimestamp(startRaw),
      end: parseTimestamp(endRaw),
      original: englishLines.join(' ').trim(),
      translated: german.trim(),
    });
  });

  return segments;
}
