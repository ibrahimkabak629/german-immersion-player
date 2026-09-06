import { tokenizeForDisplay } from '../../lib/germanWords';
import { useSettings } from '../../context/SettingsContext';

interface ClickableGermanTextProps {
  text: string;
  onWordClick: (word: string) => void;
  className?: string;
  wordClassName?: string;
}

/** Renders German text as plain spans, or — when the grammar explainer is on — as clickable per-word spans. */
export function ClickableGermanText({ text, onWordClick, className, wordClassName }: ClickableGermanTextProps) {
  const { settings } = useSettings();

  if (!settings.grammarExplainer) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {tokenizeForDisplay(text).map((token, i) =>
        token.isWord ? (
          <span
            key={i}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onWordClick(token.text);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onWordClick(token.text);
              }
            }}
            className={wordClassName ?? 'rounded-sm transition-colors hover:bg-accent-soft hover:text-accent'}
          >
            {token.text}
          </span>
        ) : (
          <span key={i}>{token.text}</span>
        ),
      )}
    </span>
  );
}
