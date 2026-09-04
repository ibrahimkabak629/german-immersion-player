import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { ChatMessage as ChatMessageType } from '../../types/segment';

export function ChatMessage({ role, content }: ChatMessageType) {
  const isUser = role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={clsx(
          'max-w-[85%] rounded-[var(--radius-md)] px-3 py-2 text-[13.5px] leading-snug',
          isUser ? 'bg-accent text-[oklch(16%_0.012_265)]' : 'border border-border bg-bg-elevated-2 text-fg-secondary',
        )}
      >
        {content}
      </div>
    </motion.div>
  );
}
