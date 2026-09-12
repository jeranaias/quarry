#!/usr/bin/env node
// quarry <file.pdf> [--text|--chunks|--tasks]
import { readFileSync } from 'node:fs';
import { pdfText } from './pdf.js';
import { chunkText } from './chunk.js';
import { extractTasks } from './tasks.js';
const file = process.argv[2];
const mode = (process.argv.find((a) => a.startsWith('--')) || '--chunks').slice(2);
if (!file) { console.error('usage: quarry <file.pdf> [--text|--chunks|--tasks]'); process.exit(1); }
const { text, pages } = await pdfText(new Uint8Array(readFileSync(file)));
console.error(`${pages} pages, ${text.length.toLocaleString()} chars`);
if (mode === 'text') process.stdout.write(text);
else if (mode === 'tasks') console.log(JSON.stringify(extractTasks(text), null, 2));
else { const c = chunkText(text); console.error(`${c.length} chunks`); console.log(JSON.stringify(c, null, 2)); }
