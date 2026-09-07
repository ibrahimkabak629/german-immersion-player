import type { Segment } from '../types/segment';

/**
 * Dev-only fixture: open the app with ?demo=1 to load a short public-domain
 * clip with fake dual-language segments, so player features can be exercised
 * without running the full transcribe/translate/dub pipeline.
 */
export const DEMO = new URLSearchParams(window.location.search).get('demo') === '1';

export const DEMO_TITLE = 'Demo Video';
export const DEMO_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

export const DEMO_SEGMENTS: Segment[] = [
  {
    id: 0,
    start: 0,
    end: 2,
    original: 'Once upon a time,',
    translated: 'Es war einmal,',
    words: [
      { word: 'Once', start: 0.0, end: 0.4 },
      { word: 'upon', start: 0.45, end: 0.9 },
      { word: 'a', start: 0.95, end: 1.1 },
      { word: 'time,', start: 1.15, end: 1.9 },
    ],
  },
  {
    id: 1,
    start: 2,
    end: 4,
    original: 'there lived a fox.',
    translated: 'lebte ein Fuchs.',
    words: [
      { word: 'there', start: 2.0, end: 2.4 },
      { word: 'lived', start: 2.45, end: 2.9 },
      { word: 'a', start: 2.95, end: 3.1 },
      { word: 'fox.', start: 3.15, end: 3.9 },
    ],
  },
  // Deliberately has no word timings — exercises the segment-level fallback.
  { id: 2, start: 4, end: 4.6, original: 'The end.', translated: 'Das Ende.' },
];
