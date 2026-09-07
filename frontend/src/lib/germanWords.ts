// A small stoplist of very common function words, kept out of the word bank
// so it fills up with words worth actually studying rather than "der/die/das".
const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
  'und', 'ist', 'sind', 'war', 'waren', 'sein', 'bin', 'bist', 'seid', 'hat', 'habe', 'hast', 'habt', 'haben', 'hatte',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'ihn', 'uns', 'euch', 'ihm', 'ihnen',
  'nicht', 'kein', 'keine', 'mit', 'auf', 'für', 'von', 'zu', 'zum', 'zur', 'im', 'in', 'an', 'am',
  'aus', 'bei', 'nach', 'über', 'unter', 'vor', 'zwischen', 'durch', 'ohne', 'um', 'gegen',
  'dass', 'wie', 'was', 'wer', 'wo', 'warum', 'wenn', 'als', 'aber', 'oder', 'auch', 'so', 'nur',
  'noch', 'schon', 'sehr', 'mehr', 'kann', 'muss', 'soll', 'will', 'wird', 'wurde', 'werden',
  'mein', 'meine', 'dein', 'deine', 'unser', 'unsere', 'euer', 'eure', 'ihre', 'sein', 'seine',
  'man', 'da', 'dann', 'doch', 'ja', 'nein', 'hier', 'dort', 'jetzt',
]);

const WORD_RE = /[A-Za-zÀ-ÖØ-öø-ÿß]+/g;

/** Strips a token down to its letters (drops surrounding punctuation), or null if nothing's left. */
export function cleanWord(token: string): string | null {
  const match = token.match(WORD_RE);
  return match ? match.join('') : null;
}

/** Splits a sentence into {text, isWord} runs, preserving order and whitespace/punctuation for display. */
export function tokenizeForDisplay(text: string): { text: string; isWord: boolean }[] {
  const tokens: { text: string; isWord: boolean }[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(WORD_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) tokens.push({ text: text.slice(lastIndex, index), isWord: false });
    tokens.push({ text: match[0], isWord: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex), isWord: false });
  return tokens;
}

/** Extracts unique, study-worthy German words from a sentence (drops stopwords and 1-letter tokens). */
export function extractVocabWords(text: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const match of text.matchAll(WORD_RE)) {
    const word = match[0];
    const key = word.toLowerCase();
    if (word.length < 2 || STOPWORDS.has(key) || seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  return words;
}
