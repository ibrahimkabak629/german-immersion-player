import { useCallback, useRef, useState } from 'react';
import type { GermanLevel, Segment, VideoSource } from '../types/segment';
import { ApiError, connectProgressSocket, processVideo } from '../lib/api';
import { parseDualSrt } from '../lib/srtParser';

export type ProcessingStep = 'extracting_audio' | 'transcribing' | 'translating' | 'dubbing' | 'syncing_subtitles' | 'done';

export type ProcessingState =
  | { status: 'idle' }
  | { status: 'processing'; step: ProcessingStep | null }
  | { status: 'ready'; videoFile: File; segments: Segment[] }
  | { status: 'error'; message: string };

/**
 * Orchestrates the real pipeline for one video: opens /progress before
 * posting so no early step is missed, calls POST /process-video, and
 * unzips the result into a playable file + parsed segments.
 */
export function useVideoProcessing() {
  const [state, setState] = useState<ProcessingState>({ status: 'idle' });
  const socketRef = useRef<WebSocket | null>(null);

  const reset = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    setState({ status: 'idle' });
  }, []);

  const start = useCallback(async (source: VideoSource, level: GermanLevel) => {
    if (!source) return;

    setState({ status: 'processing', step: null });

    const socket = connectProgressSocket((step) => {
      setState((prev) => (prev.status === 'processing' ? { status: 'processing', step: step as ProcessingStep } : prev));
    });
    socketRef.current = socket;

    try {
      const { videoBlob, srtText } = await processVideo(source, level);
      const videoFile = new File([videoBlob], 'dubbed_video.mp4', { type: 'video/mp4' });
      const segments = parseDualSrt(srtText);
      setState({ status: 'ready', videoFile, segments });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Something went wrong while processing this video.';
      setState({ status: 'error', message });
    } finally {
      socket.close();
      socketRef.current = null;
    }
  }, []);

  return { state, start, reset };
}
