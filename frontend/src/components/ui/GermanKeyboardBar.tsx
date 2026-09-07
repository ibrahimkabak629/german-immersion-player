import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';

const CHARACTERS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];

type TextField = HTMLInputElement | HTMLTextAreaElement;

function isTextField(el: Element | null): el is TextField {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return type === 'text' || type === 'search' || type === '';
}

/**
 * Floating ä/ö/ü/ß bar that follows focus into any text field, so German
 * characters are reachable without a German keyboard layout.
 */
export function GermanKeyboardBar() {
  const { settings } = useSettings();
  const [field, setField] = useState<TextField | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const fieldRef = useRef<TextField | null>(null);

  // Sit just above the focused field so it never covers what you're typing in.
  function positionFor(el: TextField) {
    const rect = el.getBoundingClientRect();
    return { left: rect.left + rect.width / 2, top: rect.top - 8 };
  }

  useEffect(() => {
    // Nothing to listen for when it's off — rendering is gated on the setting
    // too, so any leftover state simply stays hidden.
    if (!settings.germanKeyboard) {
      fieldRef.current = null;
      return;
    }

    function onFocusIn(e: FocusEvent) {
      const target = e.target as Element | null;
      if (isTextField(target)) {
        fieldRef.current = target;
        setField(target);
        setAnchor(positionFor(target));
      }
    }

    function onFocusOut() {
      // Let a click on one of our buttons land before hiding the bar.
      window.setTimeout(() => {
        if (!isTextField(document.activeElement)) {
          fieldRef.current = null;
          setField(null);
          setAnchor(null);
        }
      }, 120);
    }

    function reposition() {
      if (fieldRef.current) setAnchor(positionFor(fieldRef.current));
    }

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    if (isTextField(document.activeElement)) {
      fieldRef.current = document.activeElement;
      setField(document.activeElement);
      setAnchor(positionFor(document.activeElement));
    }
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [settings.germanKeyboard]);

  function insert(character: string) {
    const el = fieldRef.current;
    if (!el) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + character + el.value.slice(end);

    // Use the native setter so React's onChange sees the update.
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setValue = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setValue?.call(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));

    const caret = start + character.length;
    el.setSelectionRange(caret, caret);
    el.focus();
  }

  return (
    <AnimatePresence>
      {settings.germanKeyboard && field && anchor && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.15 }}
          style={{ left: anchor.left, top: anchor.top }}
          className="fixed z-40 flex -translate-x-1/2 -translate-y-full gap-1 rounded-full border border-border-strong bg-bg-elevated px-1.5 py-1 shadow-[var(--shadow-float)]"
        >
          {CHARACTERS.map((character) => (
            <button
              key={character}
              type="button"
              // Keep focus in the text field so the caret position survives.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(character)}
              className="h-8 w-8 rounded-full font-[family-name:var(--font-display)] text-[15px] text-fg-secondary transition-colors hover:bg-accent-soft hover:text-accent"
            >
              {character}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
