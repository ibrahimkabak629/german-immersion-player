import { useCallback, useRef, useState } from 'react';
import type { GermanLevel, Segment, VideoSource } from '../types/segment';
import { ApiError, downloadJobResult, getJobStatus, submitVideo } from '../lib/api';
import { parseDualSrt, parseSegmentsJson } from '../lib/srtParser';

export type ProcessingStep = 'extracting_audio' | 'transcribing' | 'diarizing' | 'translating' | 'dubbing' | 'syncing_subtitles' | 'done';

export type ProcessingState =
  | { status: 'idle' }
  | { status: 'queued'; queuePosition: number | null }
  | { status: 'processing'; step: ProcessingStep | null }
  | { status: 'ready'; videoFile: File; srtBlob: Blob; segments: Segment[]; title: string; level: GermanLevel }
  | { status: 'error'; message: string };

const POLL_INTERVAL_MS = 1500;

function titleFromSource(source: NonNullable<VideoSource>): string {
  if (source.kind === 'file') return source.file.name.replace(/\.[^.]+$/, '');
  try {
    const path = new URL(source.url).pathname;
    const name = path.split('/').filter(Boolean).pop();
    return name ? decodeURIComponent(name.replace(/\.[^.]+$/, '')) : 'Video';
  } catch {
    return 'Video';
  }
}

/**
 * Orchestrates the real pipeline for one video: submits it to the job
 * queue, polls GET /jobs/{id} until it's done (surfacing queue position
 * while queued and the current step while processing), then downloads and
 * unzips the result into a playable file + parsed segments.
 */
export function useVideoProcessing() {
  const [state, setState] = useState<ProcessingState>({ status: 'idle' });
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const stopPolling = useCallback(() => {
    cancelledRef.current = true;
    if (pollTimeoutRef.current !== null) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setState({ status: 'idle' });
  }, [stopPolling]);

  const start = useCallback(
    async (source: VideoSource, level: GermanLevel) => {
      if (!source) return;

      cancelledRef.current = false;
      setState({ status: 'queued', queuePosition: null });

      try {
        const jobId = await submitVideo(source, level);

        const poll = async () => {
          if (cancelledRef.current) return;

          const job = await getJobStatus(jobId);

          if (cancelledRef.current) return;

          if (job.status === 'error') {
            setState({ status: 'error', message: job.error ?? 'Something went wrong while processing this video.' });
            return;
          }

          if (job.status === 'done') {
            const { videoBlob, srtText, segmentsJson } = await downloadJobResult(jobId);
            if (cancelledRef.current) return;
            const videoFile = new File([videoBlob], 'dubbed_video.mp4', { type: 'video/mp4' });
            const srtBlob = new Blob([srtText], { type: 'application/x-subrip' });
            // Prefer segments.json (has word timings); fall back to the SRT.
            const segments = parseSegmentsJson(segmentsJson) ?? parseDualSrt(srtText);
            setState({ status: 'ready', videoFile, srtBlob, segments, title: titleFromSource(source), level });
            return;
          }

          if (job.status === 'queued') {
            setState({ status: 'queued', queuePosition: job.queuePosition });
          } else {
            setState({ status: 'processing', step: job.step as ProcessingStep | null });
          }

          pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        };

        await poll();
      } catch (error) {
        if (cancelledRef.current) return;
        const message = error instanceof ApiError ? error.message : 'Something went wrong while processing this video.';
        setState({ status: 'error', message });
      }
    },
    [],
  );

  return { state, start, reset };
}
