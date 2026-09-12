// Parse a standards / task-list document (the "Condition / Standard / Performance Steps" format
// common to training & readiness manuals) into structured task objects.
const isNoise = (l) =>
  /Enclosure \(\d+\)/i.test(l) || /^\d+ - \d+/.test(l) ||
  /^[0-9a-fA-F]{2}( [0-9a-fA-F*{}-]{1,3}){6,}/.test(l) || /^\d{1,2} [A-Z][a-z]{2} 20\d{2}$/.test(l) ||
  /Facility Code \d+/i.test(l);

const clean = (s) => s.split('\n').filter((l) => !isNoise(l)).join(' ').replace(/\s+/g, ' ').trim();

// Case-insensitive indexOf: search the actual string (not an uppercased copy) so unicode
// characters that change length under toUpperCase() can't shift the returned offset.
const ciIndexOf = (hay, needle, from = 0) => {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const m = re.exec(hay.slice(from));
  return m ? from + m.index : -1;
};

const grab = (block, startKey, endKeys) => {
  const s = ciIndexOf(block, startKey);
  if (s < 0) return '';
  let end = block.length;
  for (const k of endKeys) { const e = ciIndexOf(block, k, s + startKey.length); if (e > -1 && e < end) end = e; }
  return clean(block.slice(s + startKey.length, end));
};

/**
 * Extract structured tasks from a document's plain text.
 * Recognizes headers like "0300-DEF-1003: Defend a Position" followed by CONDITION / STANDARD /
 * PERFORMANCE STEPS (the CONDITION/STANDARD/PERFORMANCE-STEPS keywords are matched
 * case-insensitively, so `Condition:` / `Standard:` parse too). Returns
 * [{ code, title, condition, standard, performanceSteps }].
 * @param {string} raw document text
 * @param {object} [opts]
 * @param {RegExp} [opts.headerRe] custom task-header pattern; capture groups are (prefix, code, title).
 *   Any flags are honored and `g` is always applied — the caller's own RegExp object is never exec'd
 *   or mutated, and its `lastIndex` is ignored, so a reused/preset global regex still matches.
 * @param {number} [opts.maxSteps=Infinity] keep at most this many performance steps (no cap by default).
 * @param {number} [opts.maxStepChars=Infinity] drop steps longer than this many chars (no cap by default).
 */
export function extractTasks(raw, { headerRe, maxSteps = Infinity, maxStepChars = Infinity } = {}) {
  if (typeof raw !== 'string') throw new TypeError('extractTasks(raw): raw must be a string');
  if (headerRe && !(headerRe instanceof RegExp)) throw new TypeError('extractTasks: headerRe must be a RegExp');
  // Always compile a FRESH global regex from the caller's source/flags — never exec (and thus mutate,
  // or honor a stale lastIndex on) the caller's own RegExp object. A non-global exec would loop forever.
  const re = headerRe
    ? new RegExp(headerRe.source, headerRe.flags.includes('g') ? headerRe.flags : headerRe.flags + 'g')
    : /(^|\n)([0-9X]{4}-[A-Z]{2,4}-[0-9]{4}):\s*([^\n]+)/g;
  re.lastIndex = 0;
  const marks = [];
  let m;
  while ((m = re.exec(raw))) marks.push({ idx: m.index + (m[1] ? m[1].length : 0), code: m[2], title: m[3].trim() });

  const tasks = [];
  for (let i = 0; i < marks.length; i++) {
    // The final task runs to end-of-string; earlier tasks stop at the next task's header.
    const block = raw.slice(marks[i].idx, marks[i + 1] ? marks[i + 1].idx : undefined);
    const condition = grab(block, 'CONDITION:', ['STANDARD:']);
    const standard = grab(block, 'STANDARD:', ['PERFORMANCE STEPS:', 'REFERENCES:', 'CHAINED']);
    const stepsRaw = grab(block, 'PERFORMANCE STEPS:', ['REFERENCES:', 'CHAINED EVENTS', 'PREREQUISITE EVENTS', 'SUPPORT REQUIREMENTS', 'RANGE/TRAINING']);
    if (!condition || !standard) continue;
    const steps = [];
    const sre = /(?:^|\s)(\d+)\.\s+([^]*?)(?=\s\d+\.\s|$)/g; let s;
    while ((s = sre.exec(stepsRaw))) { const t = s[2].replace(/\s+[a-z]\.\s.*$/, '').replace(/\s+/g, ' ').trim(); if (t && t.length <= maxStepChars) steps.push(t); }
    tasks.push({ code: marks[i].code, title: clean(marks[i].title).replace(/\s+(EVALUATION-CODED|DESCRIPTION|INITIAL).*$/i, ''), condition, standard, performanceSteps: steps.slice(0, maxSteps) });
  }
  return tasks;
}
