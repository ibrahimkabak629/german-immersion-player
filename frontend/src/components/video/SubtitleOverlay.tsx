import { AnimatePresence, motion, type Variants } from 'framer-motion';
import type { Segment } from '../../types/segment';

interface SubtitleOverlayProps {
  segment: Segment | null;
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.028 } },
};

const word: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
};

export function SubtitleOverlay({ segment }: SubtitleOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[64px] flex max-h-[45%] items-end justify-center px-3 sm:bottom-[84px] sm:max-h-[60%] sm:px-6">
      <AnimatePresence mode="wait">
        {segment && (
          <motion.div
            key={segment.id}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.18 }}
            className="gradient-border max-w-2xl overflow-hidden rounded-[var(--radius-md)] bg-black/45 px-3.5 py-2 text-center shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md sm:rounded-[var(--radius-lg)] sm:px-5 sm:py-3.5"
          >
            <motion.p
              variants={container}
              initial="hidden"
              animate="show"
              className="flex flex-wrap justify-center gap-x-[0.3em] font-[family-name:var(--font-display)] text-[16px] leading-[1.25] text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)] sm:text-[26px] sm:leading-[1.3]"
            >
              {segment.translated.split(' ').map((w, i) => (
                <motion.span key={i} variants={word}>
                  {w}
                </motion.span>
              ))}
            </motion.p>
            <p className="mt-1 line-clamp-1 text-[11px] leading-snug text-white/60 sm:mt-1.5 sm:line-clamp-none sm:text-[15px]">
              {segment.original}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
