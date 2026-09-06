import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Play, Square, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Segment } from '../../types/segment';
import { Button } from '../ui/Button';

interface SpeakingPracticeCardProps {
  segment: Segment;
  onResume: () => void;
}

export function SpeakingPracticeCard({ segment, onResume }: SpeakingPracticeCardProps) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);

  // The parent keys this component by segment id, so a new line remounts it
  // fresh — this only needs to clean up on the way out.
  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  async function startRecording() {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setMicError("Couldn't access your microphone — check your browser's permission settings.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.99 }}
      transition={{ duration: 0.18 }}
      className="gradient-border relative pointer-events-auto max-w-2xl overflow-hidden rounded-[var(--radius-lg)] bg-black/60 px-4 py-3.5 text-center shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md sm:px-6 sm:py-4"
    >
      <p className="font-[family-name:var(--font-display)] text-[18px] leading-[1.3] text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)] sm:text-[24px]">
        {segment.translated}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-white/60 sm:text-[14px]">{segment.original}</p>
      <p className="mt-2.5 text-[11px] uppercase tracking-wide text-white/50">Now you try it</p>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          aria-label={recording ? 'Stop recording' : 'Record yourself'}
          className={clsx(
            'flex h-11 w-11 items-center justify-center rounded-full border transition-colors',
            recording
              ? 'border-de-red bg-de-red/20 text-de-red'
              : 'border-white/20 bg-white/10 text-white hover:bg-white/20',
          )}
        >
          {recording ? (
            <Square size={16} strokeWidth={2} fill="currentColor" />
          ) : (
            <motion.span
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Mic size={18} strokeWidth={1.75} />
            </motion.span>
          )}
        </button>

        {recording && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 text-[13px] text-de-red"
          >
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-de-red"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            Recording…
          </motion.span>
        )}

        {!recording && audioUrl && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => new Audio(audioUrl).play()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Play your recording"
            >
              <Play size={14} strokeWidth={1.75} fill="currentColor" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
                audioUrlRef.current = null;
                setAudioUrl(null);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Discard recording"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>

      {micError && <p className="mt-2.5 text-xs text-de-red">{micError}</p>}

      <Button variant="primary" onClick={onResume} className="mt-3.5 w-full sm:w-auto">
        Resume
      </Button>
    </motion.div>
  );
}
