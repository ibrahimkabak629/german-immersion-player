import { useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, Send } from 'lucide-react';
import type { ChatMessage as ChatMessageType, GermanLevel, Segment } from '../../types/segment';
import { usePlayback } from '../../context/PlaybackContext';
import { useActiveSegment } from '../../hooks/useActiveSegment';
import { getTutorResponse } from '../../data/tutorResponses';
import { ChatMessage } from './ChatMessage';
import { ChatTypingIndicator } from './ChatTypingIndicator';
import { IconButton } from '../ui/IconButton';

let messageIdCounter = 0;
function nextId() {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

interface AITutorChatProps {
  level: GermanLevel;
  segments: Segment[];
}

export function AITutorChat({ level, segments }: AITutorChatProps) {
  const { currentTime } = usePlayback();
  const { segment: activeSegment } = useActiveSegment(segments, currentTime);

  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: nextId(),
      role: 'assistant',
      content: `Hallo! I'm your AI tutor. Ask about any word or line — I'll use what's playing right now for context.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setInput('');
    setIsTyping(true);

    const delay = 500 + Math.random() * 700;
    setTimeout(() => {
      const reply = getTutorResponse(text, { level, activeSegment });
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: reply }]);
      setIsTyping(false);
    }, delay);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <MessageCircleQuestion size={14} strokeWidth={1.75} className="text-fg-muted" />
        <h2 className="text-xs font-medium uppercase tracking-wide text-fg-muted">AI Tutor</h2>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.map((m) => (
          <ChatMessage key={m.id} {...m} />
        ))}
        {isTyping && <ChatTypingIndicator />}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border p-2.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about this line…"
          className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border bg-bg-elevated-2 px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-border-strong"
        />
        <IconButton
          label="Send"
          onClick={handleSend}
          disabled={!input.trim()}
          className="bg-accent text-[oklch(16%_0.012_265)] hover:bg-accent-strong hover:text-[oklch(16%_0.012_265)]"
        >
          <Send size={14} strokeWidth={1.75} />
        </IconButton>
      </div>
    </div>
  );
}
