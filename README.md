# ⛏️ Quarry

[![CI](https://github.com/jeranaias/quarry/actions/workflows/ci.yml/badge.svg)](https://github.com/jeranaias/quarry/actions/workflows/ci.yml) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**Pull clean, structured data out of dense source PDFs — text, chunks, and tasks.**

Big reference PDFs are a mess to work with: multi-column layouts scramble when you extract them,
tables of contents flood your search index, and the structured content you actually want is buried in
hundreds of pages. Quarry does the dig.

- **Coordinate-aware text** — rebuilds reading order from glyph positions, so headers and columns don't scramble. Wide vertical gaps become paragraph breaks (blank lines), so downstream chunking sees real paragraphs instead of one page-sized block.
- **Retrieval-ready chunks** — paragraph-packed to a word budget, with table-of-contents and figure-list noise filtered out. A single paragraph over budget is hard-split by sentence, so no chunk silently blows past the limit.
- **Structured tasks** — parses the `Condition / Standard / Performance Steps` format (case-insensitive labels) straight into JSON objects.

```js
import { readFileSync } from 'node:fs';
import { pdfText } from 'quarry';
import { chunkText } from 'quarry/chunk';
import { extractTasks } from 'quarry/tasks';

const { text, pages, pageTexts } = await pdfText(readFileSync('manual.pdf'));
// text      → full document, reading order rebuilt from glyph positions
// pages     → page count
// pageTexts → text of each page, so you can keep a page number on every chunk

const chunks = chunkText(text);          // → ["…", "…"]  retrieval-sized, denoised
const tasks  = extractTasks(text);       // → [{ code, title, condition, standard, performanceSteps }]
```

`chunkText(text, maxWords = 180)` throws a `TypeError` if `maxWords` isn't a finite number ≥ 1 — a
bad budget fails loudly instead of silently packing the whole document into one chunk.

`pdfText` throws a `TypeError` on missing/empty input and a `PdfParseError` (with the underlying
pdfjs error on `.cause`) when the bytes can't be parsed:

```js
import { pdfText, PdfParseError } from 'quarry';
try {
  await pdfText(bytes);
} catch (err) {
  if (err instanceof PdfParseError) { /* corrupt / encrypted / not-a-PDF */ }
}
```

From the terminal:

```bash
npx quarry manual.pdf --text     # clean full text
npx quarry manual.pdf --chunks   # JSON array of chunks (default)
npx quarry manual.pdf --tasks    # JSON array of structured tasks
```

## What `--tasks` finds

Documents that number their tasks like `0300-DEF-1003: Defend a Position` and describe each with a
condition, a standard, and numbered performance steps parse straight into:

```jsonc
[
  {
    "code": "0300-DEF-1003",
    "title": "Defend a Position",
    "condition": "Given a squad, an assigned sector, and an enemy force…",
    "standard": "Construct the position for the assigned sector, maintain 360° observation…",
    "performanceSteps": ["Construct primary fighting position(s)…", "Camouflage and conceal…"]
  }
]
```

The `CONDITION` / `STANDARD` / `PERFORMANCE STEPS` labels are matched case-insensitively, so
`Condition:` / `Standard:` parse just as well as the all-caps form.

Bring your own header pattern if your documents number things differently. Your `RegExp` is never
exec'd or mutated — Quarry compiles a fresh global copy — so a reused or preset-`lastIndex` regex
still matches:

```js
extractTasks(text, { headerRe: /(^|\n)(TASK-\d+):\s*([^\n]+)/ });   // flags optional; `g` is added for you
```

By default every performance step is kept. Cap the count or drop over-long steps explicitly — these
are options, not silent losses:

```js
extractTasks(text, { maxSteps: 10, maxStepChars: 240 });
```

## Structure: outline & sections

Turn a wall of text into a navigable tree — pull the heading hierarchy, or split the document into the
body under each heading:

```js
import { outline, sections } from 'quarry/outline';

outline(text);
// → [{ level: 1, title: 'Chapter 1 Fundamentals', line: 0 },
//    { level: 2, title: '1.1 Aiming', line: 12 }, … ]

sections(text);
// → [{ title: '1.1 Aiming', level: 2, body: '…' }, … ]   ← great for per-section chunking
```

Recognizes chapter/part/section markers, decimal numbering (`1.2.3`), and short all-caps headings
(Unicode-aware, so accented caps like `SÉCURITÉ DES OPÉRATIONS` are detected) — so you can chunk
*by section* instead of by arbitrary length.

## Install

```bash
npm install quarry
```

Requires Node 18+. Uses `pdfjs-dist` under the hood; nothing else.

## License

Apache-2.0.
