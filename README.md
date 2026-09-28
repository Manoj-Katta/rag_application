# rag_application — config-driven RAG with measured retrieval

Point it at a folder of Markdown, text or PDF documents and ask questions. Answers are
grounded in the retrieved passages and cite the exact section or page they came from.
You can use it as a **Node library** inside another project, as an **HTTP API**, or
through the built-in web UI.

The interesting part is retrieval rather than the LLM call. Each corpus can ship an
**eval question set**, and the harness compares keyword, vector and hybrid search on
it. Hybrid search is the default because it measured best, not by assumption.

## Results — Kubernetes docs corpus

36 hand-written questions over 474 kubernetes.io pages (5,496 chunks). A question
counts as a hit when any chunk from a page that answers it appears in the top k.

| Retrieval mode | hit@1 | hit@5 | MRR@10 |
|---|---|---|---|
| Keyword (BM25) | 44.4% | 80.6% | 0.583 |
| Vector (bge-small) | 41.7% | 69.4% | 0.520 |
| **Hybrid (RRF)** | **55.6%** | **86.1%** | **0.682** |

Warm retrieval latency is about 13 ms per query on a laptop (in-process, no vector DB).

**What the numbers show**
- **Neither method wins alone, and they fail on different questions.** BM25 misses
  paraphrases ("stop pods talking to each other" never says *NetworkPolicy*). Vectors
  miss exact-term questions (label selectors, ConfigMap). Fusing the two recovers most
  of both.
- **Remaining misses are honest failures.** "My app takes two minutes to boot and keeps
  getting restarted" should retrieve the startup-probe page, and no mode finds it in the
  top 10.

**How the labels were set.** Questions are phrased the way a user would ask, not in
page-title words. After the first run, I inspected every miss. Where the retrieved page
genuinely answers the question, for example the dedicated namespace-quota task page for
a quota question, I added it as a valid answer. This changed 5 of the 36 questions, and
all three modes are scored on the same labels.

## Quick start

Requires Node 20+.

```bash
npm install
npm run list                      # built-in corpora and whether they're indexed
npm run fetch  -- kubernetes      # sparse clone of the kubernetes.io docs
npm run ingest -- kubernetes      # chunk + embed (~16 min on a laptop CPU)
npm run eval   -- kubernetes      # the metrics table above
cp .env.example .env              # add a free Gemini key: https://aistudio.google.com/apikey
npm start                         # http://localhost:3000
```

Built-in corpora: `kubernetes` (Markdown docs) and `rag-papers` (three RAG research
papers as PDFs, about 20 s to index). Without `GEMINI_API_KEY` everything still runs and
returns the retrieved sources, with no generated answer.

## Add your own documents

Write a corpus config. Relative paths resolve against the config file, so the config,
sources and index can live in your own project:

```json
{
  "name": "my-notes",
  "description": "my team's runbooks",
  "source": { "type": "local", "path": "./notes" },
  "indexDir": "./.rag-index"
}
```

```bash
npx rag ingest ./my-notes.json
npx rag ask ./my-notes.json "what do I do when the queue backs up?"
```

**Source types**
| `source.type` | Fields | Use for |
|---|---|---|
| `local` | `path` | A folder of `.md`, `.mdx`, `.txt` and `.pdf` files |
| `git` | `repo`, `sparsePath` | A docs folder inside a git repo (shallow, sparse clone) |
| `urls` | `urls: [{ url, title }]` | PDFs to download, e.g. from arXiv |

**Optional fields:** `root` and `include` (which subfolders to index), `preprocess: ["hugo"]`
(strip Hugo shortcodes), `urlBase` (turn file paths into citation links) and `eval`
(a question file for `rag eval`). See `corpora/` for complete examples.

## Use it as a library

```js
import { createRag } from 'rag_application';   // npm install github:Manoj-Katta/rag_application

const rag = createRag({ corpus: './my-notes.json' });
const { answer, sources } = await rag.ask('How do we rotate credentials?');
const hits = await rag.search('credentials', { k: 5, mode: 'keyword' });
```

The generator is pluggable. Pass any object with `generate({ system, prompt })` that
returns a string to use a different model provider:

```js
createRag({ corpus: 'kubernetes', generator: { generate: async ({ system, prompt }) => callMyModel(system, prompt) } });
```

## HTTP API

The server serves every indexed corpus.

- `GET /api/corpora` → `[{ name, description }]`
- `POST /api/ask` `{ "question": "...", "corpus": "kubernetes", "mode": "hybrid" | "vector" | "keyword" }` → `{ answer, sources[] }`
- `POST /api/search` with the same body → `{ sources[] }` (retrieval only, no LLM)

## How it works

```
 corpus config ──► fetch (git sparse clone | URL download | local folder)
        │
        ▼
 loaders ── Markdown: split on ##/###/#### headings, keep code blocks whole
        │   PDF: rejoin lines, undo hyphenation, pack sentences within a page
        ▼
 chunks (≤1,500 chars, each tagged with its heading path or page)
        ├──► bge-small-en-v1.5 (local, 384-d) ──► vectors.bin
        └──► BM25 inverted index (built in memory on load)

 query ──► vector top-50 ─┐
       └─► BM25 top-50  ──┴─► reciprocal rank fusion ──► top-6 ──► LLM ──► cited answer
```

**Design choices**
- **Heading-path chunks.** Each chunk carries its breadcrumb (`Pod Lifecycle > Container probes`)
  in both the embedded text and the BM25 text. A section titled only "Limitations" is
  then still findable, and each citation links to the section anchor or the PDF page.
- **Reciprocal rank fusion, not score blending.** BM25 scores and cosine similarities
  are on different scales. RRF (`Σ 1/(60 + rank)`) combines ranks, so no weights need
  tuning.
- **Local embeddings.** `bge-small-en-v1.5` runs in-process through Transformers.js.
  Indexing is free and has no rate limits, and query embedding adds no network hop.
- **No vector database.** Brute-force dot products over tens of thousands of chunks take
  milliseconds. An ANN index only pays for itself well beyond that.
- **Grounded generation.** The prompt allows only the retrieved excerpts, requires a
  `[n]` citation on every claim, and tells the model to say the sources don't cover
  the question rather than fall back on its own knowledge.
- **Per-page PDF chunks.** A chunk never spans two pages, so a citation always points
  at a page the reader can open.

## Stack

Node.js · Express · Transformers.js (`bge-small-en-v1.5`) · BM25 (hand-written) · unpdf · Google Gemini API (free tier)

## Next

- A cross-encoder reranker over the fused top-50, aimed at the remaining misses
- An answer-faithfulness eval: check that every `[n]` citation supports its sentence
- An eval question set for the PDF corpus

## Attribution

The Kubernetes documentation is © The Kubernetes Authors under
[CC BY 4.0](https://github.com/kubernetes/website/blob/main/LICENSE). Papers in
`rag-papers` are © their authors. All corpus content is downloaded at build time and
not redistributed in this repo.
