import JSZip from 'jszip';
import type { GermanLevel, VideoSource } from '../types/segment';

const LEVEL_NAMES: Record<GermanLevel, string> = {
  A1: 'A1 (beginner)',
  A2: 'A2 (elementary)',
  B1: 'B1 (intermediate)',
  B2: 'B2 (upper-intermediate)',
  C1: 'C1 (advanced)',
  C2: 'C2 (mastery)',
};

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const PROGRESS_WS_URL = `${API_BASE_URL.replace(/^http/, 'ws')}/progress`;

export class ApiError extends Error {}

async function readErrorDetail(response: Response): Promise<string | null> {
  try {
    const data = await response.json();
    return typeof data?.detail === 'string' ? data.detail : null;
  } catch {
    return null;
  }
}

export interface ProcessVideoResult {
  videoBlob: Blob;
  srtText: string;
}

/** Posts a video (file or url) + CEFR level to the backend and unzips the dubbed video + dual SRT it returns. */
export async function processVideo(source: NonNullable<VideoSource>, level: GermanLevel): Promise<ProcessVideoResult> {
  const formData = new FormData();
  formData.append('level', level);
  if (source.kind === 'file') {
    formData.append('file', source.file);
  } else {
    formData.append('url', source.url);
  }

  const response = await fetch(`${API_BASE_URL}/process-video`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new ApiError((await readErrorDetail(response)) ?? `Processing failed (${response.status})`);
  }

  const zip = await JSZip.loadAsync(await response.blob());
  const videoEntry = zip.file('dubbed_video.mp4');
  const srtEntry = zip.file('subtitles_dual.srt');
  if (!videoEntry || !srtEntry) {
    throw new ApiError('Server response was missing the expected video or subtitle file');
  }

  const [videoBuffer, srtText] = await Promise.all([videoEntry.async('arraybuffer'), srtEntry.async('text')]);
  return { videoBlob: new Blob([videoBuffer], { type: 'video/mp4' }), srtText };
}

/** Asks the AI tutor a plain-English question about a German subtitle line. */
export async function askTutor(germanText: string, question: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/ask-tutor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ german_text: germanText, question }),
  });

  if (!response.ok) {
    throw new ApiError((await readErrorDetail(response)) ?? `Tutor request failed (${response.status})`);
  }

  const data = await response.json();
  return data.answer as string;
}

/** Asks for a full grammar breakdown of one word as used in a sentence, for the Grammar Explainer popover. */
export async function explainWord(word: string, sentence: string, level: GermanLevel): Promise<string> {
  const question =
    `Explain the German word "${word}" as it's used in this exact sentence. Cover, briefly: ` +
    `1) what it means here, 2) grammar details (gender and case if it's a noun, tense/person if it's a verb, ` +
    `or its word type otherwise), 3) why it takes this form in this sentence, and 4) two short example ` +
    `sentences using it at ${LEVEL_NAMES[level]} level. Use short labeled lines, not one long paragraph.`;
  return askTutor(sentence, question);
}

/** Asks for a short (1-4 word) English translation of a single German word, for the word bank. */
export async function quickTranslateWord(word: string, sentence: string): Promise<string> {
  const question = `Reply with ONLY a short 1-4 word English translation of the German word "${word}" — no explanation, no punctuation, nothing else.`;
  const answer = await askTutor(sentence, question);
  return answer.replace(/^["'.\s]+|["'.\s]+$/g, '');
}

/** Opens the /progress websocket and reports each {step, status} broadcast as the backend works through the pipeline. */
export function connectProgressSocket(onStep: (step: string, status: string) => void): WebSocket {
  const socket = new WebSocket(PROGRESS_WS_URL);
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (typeof data?.step === 'string' && typeof data?.status === 'string') {
        onStep(data.step, data.status);
      }
    } catch {
      // ignore malformed/non-JSON messages
    }
  };
  return socket;
}
