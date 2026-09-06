import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { Ear, Eye } from 'lucide-react';
import type { Segment } from '../../types/segment';
import type { LearningMode } from '../../types/learningMode';
import { cleanWord } from '../../lib/germanWords';
import { useSettings } from '../../context/SettingsContext';

interface SubtitleOverlayProps {
  segment: Segment | null;
  mode: LearningMode;
  onWordClick?: (word: string) => void;
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.028 } },
};

const word: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
};

function SubtitleCard({ segment, clickable, onWordClick }: { segment: Segment; clickable: boolean; onWordClick?: (word: string) => void }) {
  return (
    <motion.div
      key={segment.id}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.99 }}
      transition={{ duration: 0.18 }}
      className="gradient-border relative pointer-events-auto max-w-2xl overflow-hidden rounded-[var(--radius-md)] bg-black/45 px-3.5 py-2 text-center shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md sm:rounded-[var(--radius-lg)] sm:px-5 sm:py-3.5"
    >
      <motion.p
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-wrap justify-center gap-x-[0.3em] font-[family-name:var(--font-display)] text-[16px] leading-[1.25] text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)] sm:text-[26px] sm:leading-[1.3]"
      >
        {segment.translated.split(' ').map((w, i) => (
          <motion.span
            key={i}
            variants={word}
            onClick={
              clickable
                ? () => {
                    const clean = cleanWord(w);
                    if (clean) onWordClick!(clean);
                  }
                : undefined
            }
            className={clickable ? 'cursor-pointer rounded-sm transition-colors hover:bg-white/15' : undefined}
          >
            {w}
          </motion.span>
        ))}
      </motion.p>
      <p className="mt-1 line-clamp-1 text-[11px] leading-snug text-white/60 sm:mt-1.5 sm:line-clamp-none sm:text-[15px]">
        {segment.original}
      </p>
    </motion.div>
  );
}

export function SubtitleOverlay({ segment, mode, onWordClick }: SubtitleOverlayProps) {
  const { settings } = useSettings();
  const clickable = settings.grammarExplainer && !!onWordClick;

  // Listening mode: remember the line that was just playing so a "Show" button
  // can reveal it once it ends, then forget it again once a new line starts.
  const [lastSegment, setLastSegment] = useState<Segment | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (segment && segment.id !== lastSegment?.id) {
      setLastSegment(segment);
      setRevealed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment?.id]);

  let content: ReactNode = null;

  if (mode === 'listening') {
    if (segment) {
      content = (
        <motion.div
          key={`hint-${segment.id}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-[13px] text-white/70 backdrop-blur-md"
        >
          <Ear size={14} strokeWidth={1.75} />
          Try to understand without subtitles
        </motion.div>
      );
    } else if (lastSegment && !revealed) {
      content = (
        <motion.button
          key={`reveal-${lastSegment.id}`}
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          onClick={() => setRevealed(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 text-[13px] font-medium text-white backdrop-blur-md transition-colors hover:bg-black/65"
        >
          <Eye size={14} strokeWidth={1.75} />
          Show subtitle
        </motion.button>
      );
    } else if (lastSegment && revealed) {
      content = <SubtitleCard segment={lastSegment} clickable={clickable} onWordClick={onWordClick} />;
    }
  } else if (segment) {
    content = <SubtitleCard segment={segment} clickable={clickable} onWordClick={onWordClick} />;
  }

  return <AnimatePresence mode="wait">{content}</AnimatePresence>;
}
