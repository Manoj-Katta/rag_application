// Retrieval eval: for each question, does a chunk from an expected page appear
// in the top k? Measured per mode so the hybrid choice is backed by numbers.
import fs from 'node:fs';
import { Retriever } from '../src/retriever.js';

const questions = JSON.parse(fs.readFileSync(new URL('./questions.json', import.meta.url)));
const MODES = ['keyword', 'vector', 'hybrid'];
const K = 10;

const retriever = new Retriever();
const results = {};
const misses = {};

for (const mode of MODES) {
  let hit1 = 0, hit5 = 0, rr = 0;
  misses[mode] = [];
  for (const { q, expected } of questions) {
    const hits = await retriever.search(q, { k: K, mode });
    const rank = hits.findIndex((h) => expected.includes(h.doc));
    if (rank === 0) hit1++;
    if (rank >= 0 && rank < 5) hit5++;
    if (rank >= 0) rr += 1 / (rank + 1);
    else misses[mode].push(q);
  }
  const n = questions.length;
  results[mode] = { 'hit@1': hit1 / n, 'hit@5': hit5 / n, 'MRR@10': rr / n };
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;
console.log(`\n${questions.length} questions, ${retriever.chunks.length} chunks\n`);
console.log('| Mode | hit@1 | hit@5 | MRR@10 |');
console.log('|---|---|---|---|');
for (const mode of MODES) {
  const r = results[mode];
  console.log(`| ${mode} | ${pct(r['hit@1'])} | ${pct(r['hit@5'])} | ${r['MRR@10'].toFixed(3)} |`);
}
for (const mode of MODES) {
  if (misses[mode].length) console.log(`\n${mode} missed top-${K}:\n  - ${misses[mode].join('\n  - ')}`);
}
