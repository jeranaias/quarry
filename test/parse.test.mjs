import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText } from '../src/chunk.js';
import { extractTasks } from '../src/tasks.js';
import { outline, sections } from '../src/outline.js';

test('chunkText drops noise and packs paragraphs', () => {
  const text = 'Contents\n\n.......... 5\n\n' + 'The quick brown fox jumps over the lazy dog and keeps going. '.repeat(20) + '\n\n' + 'A second real paragraph with plenty of alphabetic content to survive the noise filter here.';
  const chunks = chunkText(text);
  assert.ok(chunks.length >= 1);
  assert.ok(!chunks.join(' ').includes('..........'));
});

test('chunkText splits when a chunk exceeds the word budget', () => {
  const para = 'word '.repeat(60).trim() + ' and plenty more alphabetic characters here to survive filtering okay.';
  const text = [para, para, para].join('\n\n');
  const chunks = chunkText(text, 100);
  assert.ok(chunks.length >= 2, 'three ~60-word paragraphs should not fit in one 100-word chunk');
});

test('chunkText rejects non-string input', () => {
  assert.throws(() => chunkText(42), TypeError);
});

test('extractTasks parses a Condition/Standard/Steps block', () => {
  const text = `0300-DEF-1003: Defend a Position
CONDITION: Given a squad and an assigned sector.
STANDARD: Construct the position and maintain 360-degree observation.
PERFORMANCE STEPS:
1. Construct primary fighting positions.
2. Camouflage and conceal the position.
3. Maintain observation to the front, flank, and rear.
REFERENCES: none`;
  const tasks = extractTasks(text);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].code, '0300-DEF-1003');
  assert.match(tasks[0].title, /Defend a Position/);
  assert.ok(tasks[0].standard.includes('360'));
  assert.equal(tasks[0].performanceSteps.length, 3);
});

test('extractTasks honors a custom headerRe', () => {
  const text = `TASK-7: Assemble the Kit
CONDITION: Given the packed container and a checklist.
STANDARD: Lay out every component and account for all items.
PERFORMANCE STEPS:
1. Open the container and inventory the contents.
2. Arrange components in assembly order.
REFERENCES: none`;
  const tasks = extractTasks(text, { headerRe: /(^|\n)(TASK-\d+):\s*([^\n]+)/g });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].code, 'TASK-7');
  assert.match(tasks[0].title, /Assemble the Kit/);
  assert.equal(tasks[0].performanceSteps.length, 2);
});

test('extractTasks tolerates a non-global custom headerRe without looping', () => {
  const text = `TASK-1: Do a Thing
CONDITION: Given a situation.
STANDARD: Achieve the outcome to standard.
PERFORMANCE STEPS:
1. Take the first step.
REFERENCES: none`;
  const tasks = extractTasks(text, { headerRe: /(^|\n)(TASK-\d+):\s*([^\n]+)/ });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].code, 'TASK-1');
});

test('extractTasks rejects non-string input', () => {
  assert.throws(() => extractTasks(null), TypeError);
});

test('outline finds headings and sections splits under them', () => {
  const text = 'Chapter 1 Fundamentals\nsome intro text here that is long enough\n1.1 Aiming\nbody about aiming goes here\n1.2 Trigger\nbody about the trigger control';
  const heads = outline(text);
  assert.ok(heads.length >= 2);
  const secs = sections(text);
  assert.ok(secs.some((s) => /Aiming/.test(s.title)));
});

test('outline assigns heading levels by numbering depth', () => {
  const text = 'Chapter 1 Fundamentals\n1. Overview text placed here\n1.2 Aiming Basics\n1.2.3 Sight Alignment Detail';
  const heads = outline(text);
  const byTitle = (frag) => heads.find((h) => h.title.includes(frag));
  assert.equal(byTitle('Chapter 1').level, 1);
  assert.equal(byTitle('Overview').level, 1);
  assert.equal(byTitle('Aiming Basics').level, 2);
  assert.equal(byTitle('Sight Alignment').level, 3);
});

test('sections with no headings returns the whole document as one body', () => {
  const text = 'just a flowing paragraph of prose\nwith a second line and no headings at all';
  const secs = sections(text);
  assert.equal(secs.length, 1);
  assert.equal(secs[0].title, null);
  assert.ok(secs[0].body.includes('flowing paragraph'));
});

test('sections captures preamble text before the first heading', () => {
  const text = 'a preface line before any heading\n1.1 Aiming\nbody about aiming';
  const secs = sections(text);
  assert.equal(secs[0].title, null);
  assert.ok(secs[0].body.includes('preface line'));
  assert.ok(secs.some((s) => s.title && /Aiming/.test(s.title)));
});

test('outline rejects non-string input', () => {
  assert.throws(() => outline(123), TypeError);
});

test('extractTasks matches with a reused/preset global headerRe and does not mutate it', () => {
  const text = `TASK-9: Rig the Line
CONDITION: Given the rig and a load.
STANDARD: Secure the load to standard.
PERFORMANCE STEPS:
1. Inspect the rigging.
2. Attach the load.
REFERENCES: none`;
  const re = /(^|\n)(TASK-\d+):\s*([^\n]+)/g;
  re.lastIndex = 40; // simulate a caller that already used this regex
  const tasks = extractTasks(text, { headerRe: re });
  assert.equal(tasks.length, 1, 'a preset lastIndex must not cause the header to be missed');
  assert.equal(tasks[0].code, 'TASK-9');
  assert.equal(re.lastIndex, 40, 'the caller\'s regex object must not be mutated');
});

test('extractTasks parses lowercase Condition:/Standard: keywords', () => {
  const text = `0300-DEF-1003: Defend a Position
Condition: Given a squad and an assigned sector.
Standard: Construct the position and maintain 360-degree observation.
Performance Steps:
1. Construct primary fighting positions.
2. Camouflage and conceal the position.
References: none`;
  const tasks = extractTasks(text);
  assert.equal(tasks.length, 1, 'case-insensitive keyword matching should parse lowercase labels');
  assert.ok(tasks[0].condition.includes('squad'));
  assert.ok(tasks[0].standard.includes('360'));
  assert.equal(tasks[0].performanceSteps.length, 2);
});

test('extractTasks keeps the full final task and all its steps by default', () => {
  const longStep = 'Do the thing '.repeat(30).trim() + '.'; // > 240 chars
  const stepLines = Array.from({ length: 12 }, (_, i) => `${i + 1}. ${i === 5 ? longStep : 'Perform step number ' + (i + 1) + ' carefully.'}`).join('\n');
  const text = `TASK-1: Final Task
CONDITION: Given the setup.
STANDARD: Meet the outcome.
PERFORMANCE STEPS:
${stepLines}`; // no trailing section — exercises slice-to-end for the last mark
  const tasks = extractTasks(text, { headerRe: /(^|\n)(TASK-\d+):\s*([^\n]+)/ });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].performanceSteps.length, 12, 'no silent 10-step cap by default');
  assert.ok(tasks[0].performanceSteps.some((s) => s.length >= 240), 'no silent 240-char step cap by default');
});

test('extractTasks honors maxSteps / maxStepChars options', () => {
  const longStep = 'Do the thing '.repeat(30).trim() + '.';
  const stepLines = Array.from({ length: 12 }, (_, i) => `${i + 1}. ${i === 5 ? longStep : 'Perform step number ' + (i + 1) + ' carefully.'}`).join('\n');
  const text = `TASK-1: Capped Task
CONDITION: Given the setup.
STANDARD: Meet the outcome.
PERFORMANCE STEPS:
${stepLines}`;
  const tasks = extractTasks(text, { headerRe: /(^|\n)(TASK-\d+):\s*([^\n]+)/, maxSteps: 5, maxStepChars: 200 });
  assert.equal(tasks[0].performanceSteps.length, 5, 'maxSteps should cap the step count');
  assert.ok(!tasks[0].performanceSteps.some((s) => s.length > 200), 'maxStepChars should drop over-long steps');
});

test('chunkText rejects a non-finite or <1 maxWords', () => {
  assert.throws(() => chunkText('some text', NaN), TypeError);
  assert.throws(() => chunkText('some text', 0), TypeError);
  assert.throws(() => chunkText('some text', -5), TypeError);
  assert.throws(() => chunkText('some text', Infinity), TypeError);
});

test('chunkText hard-splits a pdf-style single-newline paragraph over the budget', () => {
  // pdfText historically joined page bands with single "\n" and only blank-lined BETWEEN pages,
  // so a whole page arrives as ONE paragraph. It must still be split down to the word budget.
  const sentence = 'The quarry crew hauled the heavy stone up the steep incline before dawn broke over the ridge. ';
  const page = Array.from({ length: 15 }, () => sentence.trim()).join('\n'); // ~255 words, single \n between lines, no blank line
  assert.equal(page.split(/\n\s*\n/).length, 1, 'sanity: this is a single blank-line-delimited paragraph');
  const chunks = chunkText(page, 100);
  assert.ok(chunks.length >= 2, 'a 255-word single paragraph must not become one 255-word chunk');
  for (const c of chunks) assert.ok(c.split(/\s+/).length <= 100, 'every chunk stays within the word budget');
});

test('chunkText hard-splits an oversized single paragraph by sentence', () => {
  const para = Array.from({ length: 20 }, (_, i) => `Sentence number ${i + 1} carries several plain words to fill space.`).join(' ');
  const chunks = chunkText(para, 40);
  assert.ok(chunks.length >= 3, 'a single ~180-word paragraph should split into multiple ~40-word chunks');
  for (const c of chunks) assert.ok(c.split(/\s+/).length <= 40 + 12, 'pieces stay near the budget');
});

test('outline detects a unicode / accented all-caps heading', () => {
  const text = 'SÉCURITÉ DES OPÉRATIONS\nbody text about operational security follows here on this line';
  const heads = outline(text);
  assert.ok(heads.some((h) => /SÉCURITÉ/.test(h.title)), 'accented all-caps heading should be recognized');
});
