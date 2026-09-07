import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import clsx from 'clsx';
import type { ChatMessage as ChatMessageType } from '../../types/segment';
import { Logo } from '../ui/Logo';

export function ChatMessage({ role, content }: ChatMessageType) {
  const isUser = role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={clsx('flex items-end gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      <span
        className={clsx(
          'mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-bg-elevated-2 text-fg-secondary' : 'overflow-hidden bg-bg-elevated-2',
        )}
      >
        {isUser ? <User size={12} strokeWidth={2} /> : <Logo size={24} />}
      </span>
      <div
        className={clsx(
          'max-w-[80%] px-3 py-2 text-[13.5px] leading-snug',
          isUser
            ? 'rounded-2xl rounded-br-sm bg-accent text-[oklch(16%_0.012_265)]'
            : 'rounded-2xl rounded-bl-sm border border-border bg-bg-elevated-2 text-fg-secondary',
        )}
      >
        {content}
      </div>
    </motion.div>
  );
}
