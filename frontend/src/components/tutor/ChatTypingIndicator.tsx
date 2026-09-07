import { motion } from 'framer-motion';
import { Logo } from '../ui/Logo';

export function ChatTypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <span className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated-2">
        <Logo size={24} />
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-bg-elevated-2 px-3 py-2.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-fg-muted"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
          />
        ))}
      </div>
    </div>
  );
}
