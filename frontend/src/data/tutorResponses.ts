import type { GermanLevel, Segment } from '../types/segment';

interface TutorContext {
  level: GermanLevel;
  activeSegment: Segment | null;
}

function extractQuotedOrLastWord(message: string): string {
  const quoted = message.match(/["'“”]([^"'“”]+)["'“”]/);
  if (quoted) return quoted[1];
  const words = message.trim().split(/\s+/);
  return words[words.length - 1]?.replace(/[?.!,]/g, '') ?? 'that word';
}

export function getTutorResponse(userMessage: string, ctx: TutorContext): string {
  const msg = userMessage.toLowerCase().trim();

  if (/^(hi|hallo|hey|hello|na)\b/.test(msg)) {
    return `Hallo! 👋 I'm your tutor for ${ctx.level}-level German. Ask me about any word or sentence from the subtitles.`;
  }

  if (/what does|bedeutet|meaning of|what is/.test(msg)) {
    const word = extractQuotedOrLastWord(userMessage);
    return ctx.activeSegment
      ? `Good question! In the current line — "${ctx.activeSegment.translated}" — that roughly corresponds to "${ctx.activeSegment.original}" in English. Look for "${word}" in context there.`
      : `Play the video and pause near the word you're curious about — I can explain it using the exact subtitle line.`;
  }

  if (/grammar|conjugat|case|akkusativ|dativ|nominativ|genitiv/.test(msg)) {
    return `Grammar tip: at ${ctx.level}, focus on recognizing the pattern rather than memorizing every rule. Want me to break down the current subtitle line word by word?`;
  }

  if (/level|schwer|difficult|too hard|too easy|easier|harder/.test(msg)) {
    return `You're set to ${ctx.level}. You can change this any time from the dropdown in the top bar — it adjusts how I explain things.`;
  }

  if (/danke|thanks|thank you/.test(msg)) {
    return `Bitte! Keep watching — I'm here whenever a line trips you up.`;
  }

  if (msg.length === 0) {
    return `Type a question whenever you're ready — no rush.`;
  }

  return `Interesting! Try asking me things like "what does that mean?", "explain the grammar here", or click a line in the transcript and ask about it.`;
}
