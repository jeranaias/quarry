// Coordinate-aware PDF → text: rebuild reading order from glyph positions so headers and columns
// don't scramble. Returns the full text, a per-page count, and the text of each page.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Rebuild one page's reading order from its glyph positions.
 * Groups items into horizontal bands by y-coordinate, orders bands top-to-bottom,
 * and orders the glyphs within each band left-to-right.
 * @param {import('pdfjs-dist/types/src/display/api').TextContent} textContent
 * @returns {string} the page's text, one line per band
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
  return [...bands.keys()]
    .sort((a, b) => b - a) // PDF y grows upward → descending is top-to-bottom
    .map((k) => bands.get(k).sort((p, q) => p[0] - q[0]).map((p) => p[1]).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Extract coordinate-aware text from a PDF.
 * @param {Uint8Array|ArrayBuffer} data raw PDF bytes
 * @returns {Promise<{ text: string, pages: number, pageTexts: string[] }>}
 *   `text` is every page joined by a blank line, `pages` is the page count, and
 *   `pageTexts[i]` is the text of page `i + 1` (handy for page-scoped indexing).
 */
export async function pdfText(data) {
  if (!data) throw new TypeError('pdfText(data): expected PDF bytes (Uint8Array or ArrayBuffer)');
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pageTexts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    pageTexts.push(pageLines(await pg.getTextContent()));
  }
  return { text: pageTexts.join('\n\n'), pages: doc.numPages, pageTexts };
}
