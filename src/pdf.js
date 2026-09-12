// Coordinate-aware PDF → text: rebuild reading order from glyph positions so headers and columns
// don't scramble. Returns the full text plus a per-page count.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

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
    .filter(Boolean);
}

export async function pdfText(data) {
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    pages.push(pageLines(await pg.getTextContent()).join('\n'));
  }
  return { text: pages.join('\n\n'), pages: doc.numPages };
}
