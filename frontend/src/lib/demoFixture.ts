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
  { id: 0, start: 0, end: 2, original: 'Once upon a time,', translated: 'Es war einmal,' },
  { id: 1, start: 2, end: 4, original: 'there lived a fox.', translated: 'lebte ein Fuchs.' },
  { id: 2, start: 4, end: 4.6, original: 'The end.', translated: 'Das Ende.' },
];
