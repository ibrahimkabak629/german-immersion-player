export interface Segment {
  /** UI-only identifier — not part of the Python pipeline's segment shape */
  id: number;
  start: number;
  end: number;
  /** English source text */
  original: string;
  /** German translation */
  translated: string;
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
