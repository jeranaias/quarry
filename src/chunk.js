// Turn extracted text into retrieval-sized chunks, dropping table-of-contents / figure-list /
// mostly-numeric noise that otherwise dominates keyword search.
const isNoise = (p) => {
  const dots = (p.match(/\./g) || []).length;
  const alpha = p.replace(/[^A-Za-z]/g, '').length;
  return dots > 35 || /^\s*Contents\b/i.test(p) || alpha < 80;
};

export function chunkText(text, maxWords = 180) {
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
