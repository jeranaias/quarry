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
