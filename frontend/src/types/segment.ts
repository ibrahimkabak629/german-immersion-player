export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface Segment {
  /** UI-only identifier — not part of the Python pipeline's segment shape */
  id: number;
  start: number;
  end: number;
  /** English source text */
  original: string;
  /** German translation */
  translated: string;
  /**
   * Per-word timings from Whisper, when the model provided them. These track
   * the spoken (English source) audio, so they drive highlighting of the
   * original line; the German line is approximated proportionally.
   */
  words?: WordTiming[];
}

export type GermanLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const GERMAN_LEVELS: GermanLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type VideoSource = { kind: 'file'; file: File } | { kind: 'url'; url: string } | null;

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}
