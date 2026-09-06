import { Fragment } from 'react';

/** Renders `**bold**` spans and `- ` / `* ` bullet lines from LLM answers — not a full markdown parser. */
export function MiniMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);

  return (
    <div className={className}>
      {lines.map((line, i) => {
        const bulletMatch = line.match(/^\s*[-*]\s+(.*)/);
        const content = renderBold(bulletMatch ? bulletMatch[1] : line);
        return bulletMatch ? (
          <div key={i} className="flex gap-2">
            <span className="text-fg-muted">•</span>
            <span>{content}</span>
          </div>
        ) : (
          <p key={i}>{content}</p>
        );
      })}
    </div>
  );
}

function renderBold(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-fg">{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
