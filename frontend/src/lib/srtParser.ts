import type { Segment, WordTiming } from '../types/segment';

interface RawBackendSegment {
  start?: number;
  end?: number;
  original?: string;
  translated?: string;
  words?: { word?: string; start?: number; end?: number }[];
}

/**
 * Parses the backend's segments.json, which unlike SRT can carry per-word
 * timings. Returns null when the payload is missing or unusable so callers
 * can fall back to parsing the dual SRT.
 */
export function parseSegmentsJson(json: string | null): Segment[] | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw) || raw.length === 0) return null;

    const segments: Segment[] = [];
    (raw as RawBackendSegment[]).forEach((entry, index) => {
      if (typeof entry?.start !== 'number' || typeof entry?.end !== 'number') return;

      const words: WordTiming[] = (entry.words ?? [])
        .filter((w): w is Required<NonNullable<typeof w>> =>
          typeof w?.word === 'string' && typeof w?.start === 'number' && typeof w?.end === 'number',
        )
        .map((w) => ({ word: w.word.trim(), start: w.start, end: w.end }))
        .filter((w) => w.word.length > 0);

      segments.push({
        id: index,
        start: entry.start,
        end: entry.end,
        original: (entry.original ?? '').trim(),
        translated: (entry.translated ?? '').trim(),
        ...(words.length > 0 ? { words } : {}),
      });
    });

    return segments.length > 0 ? segments : null;
  } catch {
    return null;
  }
}

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
