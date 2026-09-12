// Turn extracted text into retrieval-sized chunks, dropping table-of-contents / figure-list /
// mostly-numeric noise that otherwise dominates keyword search.

/**
 * Detect table-of-contents / figure-list / mostly-numeric paragraphs worth dropping.
 * @param {string} p a candidate paragraph
 * @returns {boolean} true if the paragraph looks like navigation/index noise
 */
const isNoise = (p) => {
  const dots = (p.match(/\./g) || []).length;
  const alpha = p.replace(/[^A-Za-z]/g, '').length;
  return dots > 35 || /^\s*(Contents|List of (Figures|Tables))\b/i.test(p) || alpha < 80;
};

/**
 * Pack extracted text into retrieval-sized chunks, filtering out index/figure-list noise.
 * Paragraphs (blank-line separated) are accumulated until adding the next one would exceed
 * `maxWords`, then a new chunk starts. A single paragraph over the limit becomes its own chunk.
 * @param {string} text extracted document text
 * @param {number} [maxWords=180] soft word budget per chunk
 * @returns {string[]} retrieval-sized, denoised chunks
 */
export function chunkText(text, maxWords = 180) {
  if (typeof text !== 'string') throw new TypeError('chunkText(text): text must be a string');
  const paras = text.split(/\n\s*\n/).map((s) => s.trim().replace(/[ \t]+/g, ' ')).filter((p) => p && !isNoise(p));
  const chunks = [];
  let buf = '';
  for (const p of paras) {
    const w = (buf + ' ' + p).split(/\s+/).length;
    if (w > maxWords && buf) { chunks.push(buf); buf = p; } else buf = buf ? buf + '\n' + p : p;
  }
  if (buf) chunks.push(buf);
  return chunks;
}
