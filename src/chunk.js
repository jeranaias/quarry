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

const wordCount = (s) => (s.match(/\S+/g) || []).length;

/**
 * Hard-split a single over-budget paragraph into sentence-aligned pieces, each at or under
 * `maxWords` where the sentences allow (a lone sentence longer than the budget is emitted whole,
 * since there's nothing smaller to split on).
 * @param {string} p a paragraph whose own word count exceeds `maxWords`
 * @param {number} maxWords word budget per piece
 * @returns {string[]} sentence-packed pieces
 */
const splitLongParagraph = (p, maxWords) => {
  const sentences = p.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [p];
  const out = [];
  let cur = '', curWords = 0;
  for (const raw of sentences) {
    const sent = raw.replace(/\s+/g, ' ').trim();
    if (!sent) continue;
    const sw = wordCount(sent);
    if (curWords && curWords + sw > maxWords) { out.push(cur); cur = ''; curWords = 0; }
    if (sw > maxWords && !cur) { out.push(sent); continue; }
    cur = cur ? cur + ' ' + sent : sent;
    curWords += sw;
  }
  if (cur) out.push(cur);
  return out;
};

/**
 * Pack extracted text into retrieval-sized chunks, filtering out index/figure-list noise.
 * Paragraphs (blank-line separated) are accumulated until adding the next one would exceed
 * `maxWords`, then a new chunk starts. A single paragraph over the limit is hard-split by sentence
 * so no chunk silently blows past the budget.
 * @param {string} text extracted document text
 * @param {number} [maxWords=180] word budget per chunk; must be a finite number >= 1
 * @returns {string[]} retrieval-sized, denoised chunks
 * @throws {TypeError} if `text` isn't a string, or `maxWords` isn't a finite number >= 1
 */
export function chunkText(text, maxWords = 180) {
  if (typeof text !== 'string') throw new TypeError('chunkText(text): text must be a string');
  if (typeof maxWords !== 'number' || !Number.isFinite(maxWords) || maxWords < 1)
    throw new TypeError('chunkText(text, maxWords): maxWords must be a finite number >= 1');
  const paras = text.split(/\n\s*\n/).map((s) => s.trim().replace(/[ \t]+/g, ' ')).filter((p) => p && !isNoise(p));
  const chunks = [];
  let buf = '', bufWords = 0;
  for (const p of paras) {
    const pw = wordCount(p);
    if (pw > maxWords) {
      if (buf) { chunks.push(buf); buf = ''; bufWords = 0; }
      for (const piece of splitLongParagraph(p, maxWords)) chunks.push(piece);
      continue;
    }
    if (buf && bufWords + pw > maxWords) { chunks.push(buf); buf = ''; bufWords = 0; }
    buf = buf ? buf + '\n' + p : p;
    bufWords += pw;
  }
  if (buf) chunks.push(buf);
  return chunks;
}
