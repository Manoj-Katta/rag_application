import fs from 'node:fs';
import path from 'node:path';
import { BM25, topK } from './bm25.js';
import { embedQuery, DIM } from './embedder.js';

const RRF_K = 60;
const CANDIDATES = 50;

export class Retriever {
  constructor(indexDir) {
    const chunksPath = path.join(indexDir, 'chunks.json');
    if (!fs.existsSync(chunksPath)) throw new Error(`No index at ${indexDir}. Run: npm run ingest -- <corpus>`);
    this.chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf8'));
    const buf = fs.readFileSync(path.join(indexDir, 'vectors.bin'));
    this.vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    this.bm25 = new BM25(this.chunks.map((c) => `${c.section} ${c.text}`));
  }

  // Vectors are L2-normalised at ingest, so a dot product is cosine similarity.
  async vectorSearch(query, k) {
    const q = await embedQuery(query);
    const scores = new Float64Array(this.chunks.length);
    for (let i = 0; i < this.chunks.length; i++) {
      let s = 0;
      const off = i * DIM;
      for (let d = 0; d < DIM; d++) s += q[d] * this.vectors[off + d];
      scores[i] = s;
    }
    return topK(scores, k);
  }

  keywordSearch(query, k) {
    return this.bm25.search(query, k);
  }

  // Reciprocal rank fusion uses ranks, not raw scores, so BM25 and cosine
  // scores never need to be put on a common scale.
  async hybridSearch(query, k) {
    const [vec, kw] = await Promise.all([
      this.vectorSearch(query, CANDIDATES),
      this.keywordSearch(query, CANDIDATES),
    ]);
    const fused = new Map();
    for (const list of [vec, kw]) {
      list.forEach(({ i }, rank) => fused.set(i, (fused.get(i) || 0) + 1 / (RRF_K + rank + 1)));
    }
    return [...fused.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([i, score]) => ({ i, score }));
  }

  async search(query, { k = 6, mode = 'hybrid' } = {}) {
    const hits =
      mode === 'vector' ? await this.vectorSearch(query, k)
      : mode === 'keyword' ? this.keywordSearch(query, k)
      : await this.hybridSearch(query, k);
    return hits.map(({ i, score }) => ({ ...this.chunks[i], score }));
  }
}
