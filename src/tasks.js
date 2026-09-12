// Parse a standards / task-list document (the "Condition / Standard / Performance Steps" format
// common to training & readiness manuals) into structured task objects.
const isNoise = (l) =>
  /Enclosure \(\d+\)/i.test(l) || /^\d+ - \d+/.test(l) ||
  /^[0-9a-fA-F]{2}( [0-9a-fA-F*{}-]{1,3}){6,}/.test(l) || /^\d{1,2} [A-Z][a-z]{2} 20\d{2}$/.test(l) ||
  /Facility Code \d+/i.test(l);

const clean = (s) => s.split('\n').filter((l) => !isNoise(l)).join(' ').replace(/\s+/g, ' ').trim();

const grab = (block, startKey, endKeys) => {
  const s = block.indexOf(startKey);
  if (s < 0) return '';
  let end = block.length;
  for (const k of endKeys) { const e = block.indexOf(k, s + startKey.length); if (e > -1 && e < end) end = e; }
  return clean(block.slice(s + startKey.length, end));
};

/**
 * Extract structured tasks from a document's plain text.
 * Recognizes headers like "0300-DEF-1003: Defend a Position" followed by CONDITION / STANDARD /
 * PERFORMANCE STEPS. Returns [{ code, title, condition, standard, performanceSteps }].
 */
export function extractTasks(raw, { headerRe } = {}) {
  const re = headerRe || /(^|\n)([0-9X]{4}-[A-Z]{2,4}-[0-9]{4}):\s*([^\n]+)/g;
  const marks = [];
  let m;
  while ((m = re.exec(raw))) marks.push({ idx: m.index + (m[1] ? m[1].length : 0), code: m[2], title: m[3].trim() });

  const tasks = [];
  for (let i = 0; i < marks.length; i++) {
    const block = raw.slice(marks[i].idx, marks[i + 1] ? marks[i + 1].idx : marks[i].idx + 6000);
    const condition = grab(block, 'CONDITION:', ['STANDARD:']);
    const standard = grab(block, 'STANDARD:', ['PERFORMANCE STEPS:', 'REFERENCES:', 'CHAINED']);
    const stepsRaw = grab(block, 'PERFORMANCE STEPS:', ['REFERENCES:', 'CHAINED EVENTS', 'PREREQUISITE EVENTS', 'SUPPORT REQUIREMENTS', 'RANGE/TRAINING']);
    if (!condition || !standard) continue;
    const steps = [];
    const sre = /(?:^|\s)(\d+)\.\s+([^]*?)(?=\s\d+\.\s|$)/g; let s;
    while ((s = sre.exec(stepsRaw))) { const t = s[2].replace(/\s+[a-z]\.\s.*$/, '').replace(/\s+/g, ' ').trim(); if (t && t.length < 240) steps.push(t); }
    tasks.push({ code: marks[i].code, title: clean(marks[i].title).replace(/\s+(EVALUATION-CODED|DESCRIPTION|INITIAL).*$/i, ''), condition, standard, performanceSteps: steps.slice(0, 10) });
  }
  return tasks;
}
