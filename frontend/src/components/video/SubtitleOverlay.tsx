import { AnimatePresence, motion } from 'framer-motion';
import type { Segment } from '../../types/segment';

interface SubtitleOverlayProps {
  segment: Segment | null;
}

export function SubtitleOverlay({ segment }: SubtitleOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[76px] flex justify-center px-6">
      <AnimatePresence mode="wait">
        {segment && (
          <motion.div
            key={segment.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="max-w-2xl rounded-[var(--radius-lg)] border border-white/10 bg-black/40 px-5 py-3 text-center backdrop-blur-md"
          >
            <p className="font-[family-name:var(--font-display)] text-[26px] leading-[1.3] text-white">
              {segment.translated}
            </p>
            <p className="mt-1 text-[15px] leading-snug text-white/70">{segment.original}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
