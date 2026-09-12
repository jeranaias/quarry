# ⛏️ Quarry

**Pull clean, structured data out of dense source PDFs — text, chunks, and tasks.**

Big reference PDFs are a mess to work with: multi-column layouts scramble when you extract them,
tables of contents flood your search index, and the structured content you actually want is buried in
hundreds of pages. Quarry does the dig.

- **Coordinate-aware text** — rebuilds reading order from glyph positions, so headers and columns don't scramble.
- **Retrieval-ready chunks** — paragraph-packed, with table-of-contents and figure-list noise filtered out.
- **Structured tasks** — parses the `Condition / Standard / Performance Steps` format straight into JSON objects.

```js
import { pdfText } from 'quarry';
import { chunkText } from 'quarry/chunk';
import { extractTasks } from 'quarry/tasks';

const { text, pages } = await pdfText(new Uint8Array(fs.readFileSync('manual.pdf')));
const chunks = chunkText(text);          // → ["…", "…"]  retrieval-sized, denoised
const tasks  = extractTasks(text);       // → [{ code, title, condition, standard, performanceSteps }]
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

Bring your own header pattern if your documents number things differently:

```js
extractTasks(text, { headerRe: /(^|\n)(TASK-\d+):\s*([^\n]+)/g });
```

## Install

```bash
npm install quarry
```

Requires Node 18+. Uses `pdfjs-dist` under the hood; nothing else.

## License

Apache-2.0.
