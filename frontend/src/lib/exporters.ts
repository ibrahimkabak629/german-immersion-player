import type { Segment } from '../types/segment';
import type { WordBankEntry } from '../types/learning';

/** Escapes a value for CSV: quote it and double any inner quotes. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/**
 * Anki's plain-text importer: no header row, one note per line, front and
 * back separated by a comma. Back combines the translation with the example
 * sentence so the card has context.
 */
export function wordBankToAnkiCsv(entries: WordBankEntry[]): string {
  const rows = entries.map((entry) => {
    const parts: string[] = [];
    if (entry.translation) parts.push(entry.translation);
    if (entry.exampleGerman) parts.push(`<i>${entry.exampleGerman}</i>`);
    return [entry.word, parts.join('<br>')];
  });
  return toCsv(rows);
}

/** Plain CSV with a header row, for spreadsheets. */
export function wordBankToCsv(entries: WordBankEntry[]): string {
  const rows: string[][] = [
    ['Word', 'Translation', 'Level', 'Video', 'Example (German)', 'Example (English)', 'Learned', 'Starred'],
    ...entries.map((entry) => [
      entry.word,
      entry.translation ?? '',
      entry.level,
      entry.videoTitle,
      entry.exampleGerman,
      entry.exampleEnglish,
      entry.learned ? 'yes' : 'no',
      entry.starred ? 'yes' : 'no',
    ]),
  ];
  return toCsv(rows);
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Builds a print-ready HTML document of the transcript with German and English
 * side by side. Opened in a new window and handed to the browser's print
 * dialog, where "Save as PDF" produces the file — no PDF library needed.
 */
export function transcriptToPrintableHtml(segments: Segment[], title: string): string {
  const rows = segments
    .map(
      (segment) => `
      <tr>
        <td class="time">${formatTimestamp(segment.start)}</td>
        <td class="de">${escapeHtml(segment.translated)}</td>
        <td class="en">${escapeHtml(segment.original)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} — Transcript</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; margin: 32px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.meta { font-size: 12px; color: #666; margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
       color: #666; border-bottom: 1px solid #ccc; padding: 6px 8px; }
  td { vertical-align: top; padding: 8px; border-bottom: 1px solid #eee; font-size: 13px; }
  td.time { width: 52px; font-family: ui-monospace, monospace; font-size: 11px; color: #888; }
  td.de { width: 46%; }
  td.en { width: 46%; color: #555; }
  @media print { body { margin: 12mm; } tr { page-break-inside: avoid; } }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Transcript · ${segments.length} lines · exported ${new Date().toLocaleDateString()}</p>
  <table>
    <thead><tr><th>Time</th><th>German</th><th>English</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

export function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Opens the printable transcript and triggers the print/Save-as-PDF dialog. */
export function printTranscriptPdf(segments: Segment[], title: string): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(transcriptToPrintableHtml(segments, title));
  win.document.close();
  win.focus();
  // Let the document lay out before invoking print.
  win.setTimeout(() => win.print(), 250);
  return true;
}
