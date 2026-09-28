# Kubernetes Docs Q&A — hybrid-retrieval RAG

Ask a question about Kubernetes and get an answer grounded in the official
[kubernetes.io](https://kubernetes.io/docs/) documentation, with numbered citations
that link to the exact section it came from.

The interesting part is retrieval rather than the LLM call. This repo includes an
**eval harness** that measures how often the right page is retrieved, and it
compares keyword, vector and hybrid search on the same question set. Hybrid search
is the default because it measured best, not by assumption.

## Results

36 hand-written questions over 474 docs pages (5,496 chunks). A question counts
as a hit when any chunk from a page that answers it appears in the top k.

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
- **Remaining misses are honest failures.** "My app takes two minutes to boot and
  keeps getting restarted" should retrieve the startup-probe task page, and no mode
  finds it in the top 10. That question is the next thing to fix (see *Next*).

**How the labels were set.** Questions are phrased the way a user would ask, not in
page-title words. After the first run, I inspected every miss. Where the retrieved
page genuinely answers the question, for example the dedicated
*Configure Memory and CPU Quotas for a Namespace* task for a quota question, I added
it as a valid answer. This changed 5 of the 36 questions, and all three modes are
scored on the same labels. Run `npm run eval` to reproduce.

## How it works

```
kubernetes/website (content/en/docs)
        │  sparse clone, ~21 MB
        ▼
 chunker ── strip Hugo shortcodes, split on ##/###/#### headings,
        │   pack paragraphs to ≤1,500 chars, never split a code block
        ▼
 5,496 chunks ──► bge-small-en-v1.5 (local, 384-d) ──► vectors.bin
        │
        └──────► BM25 inverted index (built in memory at startup)

 query ──► vector top-50 ─┐
       └─► BM25 top-50  ──┴─► reciprocal rank fusion ──► top-6 ──► Gemini ──► cited answer
```

**Design choices**
- **Heading-path chunks.** Each chunk carries its breadcrumb (`Pod Lifecycle > Container probes`)
  in both the embedded text and the BM25 text. A section titled only "Limitations"
  is then still findable, and each citation links to the section anchor.
- **Reciprocal rank fusion, not score blending.** BM25 scores and cosine similarities
  are on different scales. RRF (`Σ 1/(60 + rank)`) combines ranks, so no weights need
  tuning.
- **Local embeddings.** `bge-small-en-v1.5` runs in-process through Transformers.js.
  Indexing is free and has no rate limits, and query embedding adds no network hop.
- **No vector database.** A 5.5K × 384 brute-force dot product takes milliseconds. A
  vector DB would add operational cost without a measurable benefit at this size.
- **Grounded generation.** The prompt allows only the retrieved excerpts, requires a
  `[n]` citation on every claim, and tells the model to say the docs don't cover
  the question rather than fall back on its own knowledge.
- **Scope.** The concepts, tasks, tutorials and setup sections are indexed. The
  generated API/CLI reference (11 MB of repetitive tables) is excluded because it
  drowned out conceptual pages.

## Run it

Requires Node 20+.

```bash
npm install
npm run fetch-docs        # sparse clone of kubernetes/website docs
npm run ingest            # chunk + embed, ~16 min on a laptop CPU
cp .env.example .env      # add a free Gemini API key: https://aistudio.google.com/apikey
npm start                 # http://localhost:3000
npm run eval              # retrieval metrics table
```

Without `GEMINI_API_KEY` the app still runs and shows the retrieved sources, with no
generated answer.

**API**
- `POST /api/ask` `{ "question": "...", "mode": "hybrid" | "vector" | "keyword" }` → `{ answer, sources[] }`
- `POST /api/search` with the same body → `{ sources[] }` only (retrieval, no LLM)

## Stack

Node.js · Express · Transformers.js (`bge-small-en-v1.5`) · BM25 (hand-written) · Google Gemini API (free tier)

## Next

- A cross-encoder reranker over the fused top-50, aimed at the probe and port-forward misses
- An answer-faithfulness eval: check that every `[n]` citation supports its sentence
- Query rewriting for symptom-style questions ("keeps getting restarted" → liveness/startup probes)

## Attribution

Documentation content © The Kubernetes Authors, licensed under
[CC BY 4.0](https://github.com/kubernetes/website/blob/main/LICENSE). It is
downloaded at build time and not redistributed in this repo.
