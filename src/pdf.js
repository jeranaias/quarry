// Coordinate-aware PDF → text: rebuild reading order from glyph positions so headers and columns
// don't scramble. Returns the full text, a per-page count, and the text of each page.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Error thrown when pdfjs fails to parse the supplied bytes (corrupt/encrypted/not-a-PDF input).
 * The underlying pdfjs error is preserved on `.cause`. A `TypeError` is thrown instead when the
 * input itself is missing or empty, so callers can tell bad input from a parse failure.
 */
export class PdfParseError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'PdfParseError';
    if (options && options.cause !== undefined && this.cause === undefined) this.cause = options.cause;
  }
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Rebuild one page's reading order from its glyph positions.
 * Groups items into horizontal bands by y-coordinate, orders bands top-to-bottom, and orders the
 * glyphs within each band left-to-right. A vertical gap markedly larger than the page's typical
 * line pitch is treated as a paragraph break and emitted as a blank line, so downstream chunking
 * sees real paragraphs instead of one page-sized block.
 * @param {import('pdfjs-dist/types/src/display/api').TextContent} textContent
 * @returns {string} the page's text, one line per band, blank line between paragraphs
 */
function pageLines(textContent) {
  const bands = new Map();
  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) continue;
    const x = item.transform[4], y = item.transform[5];
    const key = Math.round(y / 4); // 4pt bands
    if (!bands.has(key)) bands.set(key, []);
    bands.get(key).push([x, item.str]);
  }
  const rows = [...bands.keys()]
    .sort((a, b) => b - a) // PDF y grows upward → descending is top-to-bottom
    .map((k) => ({ key: k, text: bands.get(k).sort((p, q) => p[0] - q[0]).map((p) => p[1]).join(' ').replace(/\s+/g, ' ').trim() }))
    .filter((r) => r.text);
  if (!rows.length) return '';
  const gaps = [];
  for (let i = 1; i < rows.length; i++) { const g = rows[i - 1].key - rows[i].key; if (g > 0) gaps.push(g); }
  const pitch = median(gaps); // typical line-to-line spacing on this page
  let out = rows[0].text;
  for (let i = 1; i < rows.length; i++) {
    const gap = rows[i - 1].key - rows[i].key;
    // A gap well beyond the normal line pitch is a paragraph break → blank line.
    out += (pitch && gap > pitch * 1.8 ? '\n\n' : '\n') + rows[i].text;
  }
  return out;
}

/**
 * Extract coordinate-aware text from a PDF.
 * @param {Uint8Array|ArrayBuffer} data raw PDF bytes (non-empty)
 * @returns {Promise<{ text: string, pages: number, pageTexts: string[] }>}
 *   `text` is every page joined by a blank line (with paragraph breaks within pages surfaced as
 *   blank lines too), `pages` is the page count, and `pageTexts[i]` is the text of page `i + 1`
 *   (handy for page-scoped indexing).
 * @throws {TypeError} if `data` is missing or zero-length
 * @throws {PdfParseError} if pdfjs cannot parse the bytes (the pdfjs error is on `.cause`)
 */
export async function pdfText(data) {
  const len = data == null ? 0 : (typeof data.byteLength === 'number' ? data.byteLength : data.length);
  if (!len) throw new TypeError('pdfText(data): expected non-empty PDF bytes (Uint8Array or ArrayBuffer)');
  try {
    const doc = await getDocument({ data, useSystemFonts: true }).promise;
    const pageTexts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      pageTexts.push(pageLines(await pg.getTextContent()));
    }
    return { text: pageTexts.join('\n\n'), pages: doc.numPages, pageTexts };
  } catch (err) {
    if (err instanceof PdfParseError) throw err;
    throw new PdfParseError(`pdfText: failed to parse PDF (${err && err.message ? err.message : err})`, { cause: err });
  }
}
