// Structure extraction — pull the heading hierarchy out of a document, and split it into the
// sections under those headings. Heuristic, but it turns a wall of text into a navigable tree.

const HEAD = [
  { re: /^(chapter|part)\s+([\dIVXLC]+)\b(.*)$/i, level: 1 },
  { re: /^(section)\s+([\dIVXLC]+)\b(.*)$/i, level: 2 },
  { re: /^(\d+)\.\s+([A-Z].{2,80})$/, level: 1 },          // "1. Heading"
  { re: /^(\d+\.\d+)\s+([A-Z].{2,80})$/, level: 2 },       // "1.2 Heading"
  { re: /^(\d+\.\d+\.\d+)\s+([A-Z].{2,80})$/, level: 3 },  // "1.2.3 Heading"
];

function classify(line) {
  const l = line.trim();
  if (!l || l.length > 90) return null;
  for (const h of HEAD) { const m = l.match(h.re); if (m) return { level: h.level, title: l }; }
  // short ALL-CAPS line with letters → a heading
  if (/^[A-Z0-9][A-Z0-9 ,&/'()-]{2,60}$/.test(l) && /[A-Z]{3,}/.test(l) && l.split(' ').length <= 9) return { level: 2, title: l };
  return null;
}

/**
 * Extract the heading outline.
 * @param {string} text document text (one heading per line)
 * @returns {{ level: number, title: string, line: number }[]} headings in document order
 */
export function outline(text) {
  if (typeof text !== 'string') throw new TypeError('outline(text): text must be a string');
  const lines = text.split('\n');
  const out = [];
  lines.forEach((line, i) => { const h = classify(line); if (h) out.push({ ...h, line: i }); });
  return out;
}

/**
 * Split the document into the body under each detected heading. Any text that precedes the first
 * heading is returned as a leading `{ title: null, level: 0 }` preamble section.
 * @param {string} text document text
 * @returns {{ title: string|null, level: number, body: string }[]}
 */
export function sections(text) {
  if (typeof text !== 'string') throw new TypeError('sections(text): text must be a string');
  const lines = text.split('\n');
  const heads = outline(text);
  if (!heads.length) return [{ title: null, level: 0, body: text.trim() }];
  const out = [];
  const preamble = lines.slice(0, heads[0].line).join('\n').trim();
  if (preamble) out.push({ title: null, level: 0, body: preamble });
  for (let h = 0; h < heads.length; h++) {
    const start = heads[h].line + 1;
    const end = h + 1 < heads.length ? heads[h + 1].line : lines.length;
    out.push({ title: heads[h].title, level: heads[h].level, body: lines.slice(start, end).join('\n').trim() });
  }
  return out;
}
