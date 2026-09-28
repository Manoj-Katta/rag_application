import { loadCorpus } from './corpus.js';
import { Retriever } from './retriever.js';
import { geminiGenerator } from './generate.js';

function systemPrompt(corpus) {
  return `You answer questions using ONLY the numbered excerpts provided, which come from: ${corpus.description || corpus.name}.
Rules:
- Cite every claim with the excerpt number in square brackets, e.g. [2].
- If the excerpts do not contain the answer, say "The retrieved sources don't cover this." and stop. Do not use outside knowledge.
- Be concise. Include a code or config example only if an excerpt has one.`;
}

// createRag({ corpus: 'kubernetes' }) -> { search, ask }. The index must already be
// built (npm run ingest -- <corpus>); construction only loads it from disk.
export function createRag({ corpus, generator = geminiGenerator() } = {}) {
  const config = loadCorpus(corpus);
  const retriever = new Retriever(config.indexDir);
  const system = systemPrompt(config);

  async function search(question, { k = 6, mode = 'hybrid' } = {}) {
    return retriever.search(question, { k, mode });
  }

  async function ask(question, opts = {}) {
    const sources = await search(question, opts);
    if (!generator) return { answer: null, sources };
    const context = sources.map((c, n) => `[${n + 1}] ${c.section}\n${c.text}`).join('\n\n---\n\n');
    const answer = await generator.generate({ system, prompt: `Excerpts:\n\n${context}\n\nQuestion: ${question}` });
    return { answer, sources };
  }

  return { name: config.name, description: config.description, chunks: retriever.chunks.length, generation: Boolean(generator), search, ask };
}
