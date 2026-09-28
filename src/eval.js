import fs from 'node:fs';
import { Retriever } from './retriever.js';

const MODES = ['keyword', 'vector', 'hybrid'];
const K = 10;

// For each question, does a chunk from an expected document appear in the top k?
// Measured per mode so the retrieval choice is backed by numbers.
export async function runEval(corpus, { log = console.log } = {}) {
  if (!corpus.evalFile) throw new Error(`corpus "${corpus.name}" has no "eval" question file`);
  const questions = JSON.parse(fs.readFileSync(corpus.evalFile, 'utf8'));
  const retriever = new Retriever(corpus.indexDir);
  const results = {};

  for (const mode of MODES) {
    let hit1 = 0, hit5 = 0, rr = 0;
    const misses = [];
    for (const { q, expected } of questions) {
      const hits = await retriever.search(q, { k: K, mode });
      const rank = hits.findIndex((h) => expected.includes(h.doc));
      if (rank === 0) hit1++;
      if (rank >= 0 && rank < 5) hit5++;
      if (rank >= 0) rr += 1 / (rank + 1);
      else misses.push(q);
    }
    const n = questions.length;
    results[mode] = { hit1: hit1 / n, hit5: hit5 / n, mrr: rr / n, misses };
  }

  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  log(`\n${corpus.name}: ${questions.length} questions, ${retriever.chunks.length} chunks\n`);
  log('| Mode | hit@1 | hit@5 | MRR@10 |');
  log('|---|---|---|---|');
  for (const m of MODES) log(`| ${m} | ${pct(results[m].hit1)} | ${pct(results[m].hit5)} | ${results[m].mrr.toFixed(3)} |`);
  for (const m of MODES) if (results[m].misses.length) log(`\n${m} missed top-${K}:\n  - ${results[m].misses.join('\n  - ')}`);
  return results;
}
