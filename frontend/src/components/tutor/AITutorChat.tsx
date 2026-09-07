import { useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, Send } from 'lucide-react';
import type { ChatMessage as ChatMessageType, GermanLevel, Segment } from '../../types/segment';
import { usePlayback } from '../../context/PlaybackContext';
import { useActiveSegment } from '../../hooks/useActiveSegment';
import { askTutor } from '../../lib/api';
import { ChatMessage } from './ChatMessage';
import { ChatTypingIndicator } from './ChatTypingIndicator';
import { IconButton } from '../ui/IconButton';

let messageIdCounter = 0;
function nextId() {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

const SUGGESTIONS = ['What does this word mean?', 'Explain the grammar here', 'Give me a similar example'];

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }

  async function sendText(text: string) {
    if (!text) return;

    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setInput('');
    requestAnimationFrame(resizeTextarea);

    if (!activeSegment) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          content: `Play the video and pause near the line you're curious about — I use the exact subtitle text as context. You're set to ${level} level, by the way.`,
        },
      ]);
      return;
    }

    setIsTyping(true);
    try {
      const answer = await askTutor(activeSegment.translated, text);
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', content: "Sorry, I couldn't reach the tutor just now. Try again in a moment." },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="hidden shrink-0 items-center gap-2 border-b border-border px-4 py-3 lg:flex">
        <MessageCircleQuestion size={14} strokeWidth={1.75} className="text-fg-muted" />
        <h2 className="text-xs font-medium uppercase tracking-wide text-fg-muted">AI Tutor</h2>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((m) => (
          <ChatMessage key={m.id} {...m} />
        ))}
        {isTyping && <ChatTypingIndicator />}
      </div>

      {messages.length === 1 && !isTyping && (
        <div className="flex shrink-0 flex-wrap gap-1.5 px-3 pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => sendText(s)}
              className="rounded-full border border-border bg-bg-elevated-2 px-2.5 py-1 text-xs text-fg-secondary transition-colors hover:border-border-strong hover:text-fg"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex shrink-0 items-end gap-2 border-t border-border p-2.5">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            resizeTextarea();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendText(input.trim());
            }
          }}
          placeholder="Ask about this line…"
          className="min-w-0 flex-1 resize-none rounded-[var(--radius-md)] border border-border bg-bg-elevated-2 px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border-strong focus:outline-none"
        />
        <IconButton
          label="Send"
          onClick={() => void sendText(input.trim())}
          disabled={!input.trim()}
          className="bg-accent text-[oklch(16%_0.012_265)] hover:bg-accent-strong hover:text-[oklch(16%_0.012_265)]"
        >
          <Send size={14} strokeWidth={1.75} />
        </IconButton>
      </div>
    </div>
  );
}
