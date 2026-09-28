#!/usr/bin/env node
import 'dotenv/config';
import { loadCorpus, listCorpora, isIndexed } from './corpus.js';
import { fetchSources } from './fetch.js';
import { buildIndex } from './indexer.js';
import { runEval } from './eval.js';
import { createRag } from './rag.js';

const USAGE = `usage: rag <command> <corpus>

  list                      corpora in corpora/ and whether they are indexed
  fetch <corpus>            download the corpus sources
  ingest <corpus>           chunk + embed into data/index/<corpus>
  eval <corpus>             retrieval metrics per mode
  ask <corpus> "question"   answer from the command line

<corpus> is a name from corpora/ or a path to a corpus .json file.`;

const [cmd, ref, ...rest] = process.argv.slice(2);

async function main() {
  if (cmd === 'list') {
    for (const name of listCorpora()) console.log(`${isIndexed(loadCorpus(name)) ? '●' : '○'} ${name}`);
    return;
  }
  if (!cmd || !ref) return console.log(USAGE);
  const corpus = loadCorpus(ref);
  if (cmd === 'fetch') return fetchSources(corpus);
  if (cmd === 'ingest') return buildIndex(corpus);
  if (cmd === 'eval') return runEval(corpus);
  if (cmd === 'ask') {
    const { answer, sources } = await createRag({ corpus: ref }).ask(rest.join(' '));
    console.log(answer ?? '(GEMINI_API_KEY not set; sources only)');
    sources.forEach((s, n) => console.log(`[${n + 1}] ${s.section}${s.url ? `  ${s.url}` : ''}`));
    return;
  }
  console.log(USAGE);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
