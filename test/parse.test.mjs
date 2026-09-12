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

test('outline finds headings and sections splits under them', () => {
  const text = 'Chapter 1 Fundamentals\nsome intro text here that is long enough\n1.1 Aiming\nbody about aiming goes here\n1.2 Trigger\nbody about the trigger control';
  const heads = outline(text);
  assert.ok(heads.length >= 2);
  const secs = sections(text);
  assert.ok(secs.some((s) => /Aiming/.test(s.title)));
});
