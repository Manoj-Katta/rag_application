import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import { createRag } from './rag.js';
import { listCorpora, loadCorpus, isIndexed, PACKAGE_ROOT } from './corpus.js';

const PORT = process.env.PORT || 3000;
const MODES = new Set(['hybrid', 'vector', 'keyword']);

// Every indexed corpus is served; each index is loaded once, on first use.
const available = listCorpora().filter((name) => isIndexed(loadCorpus(name)));
if (!available.length) {
  console.error('No indexed corpora. Run: npm run fetch -- <corpus> && npm run ingest -- <corpus>');
  process.exit(1);
}
const rags = new Map();
const getRag = (name) => {
  if (!rags.has(name)) rags.set(name, createRag({ corpus: name }));
  return rags.get(name);
};

const app = express();
app.use(express.json());
app.use(express.static(path.join(PACKAGE_ROOT, 'public')));

app.get('/api/corpora', (_req, res) => {
  res.json(available.map((name) => ({ name, description: loadCorpus(name).description || '' })));
});

function parse(req, res) {
  const question = String(req.body?.question || '').trim();
  const mode = MODES.has(req.body?.mode) ? req.body.mode : 'hybrid';
  const corpus = req.body?.corpus || available[0];
  if (!question || question.length > 500) {
    res.status(400).json({ error: 'question must be 1-500 characters' });
    return null;
  }
  if (!available.includes(corpus)) {
    res.status(400).json({ error: `unknown or unindexed corpus; available: ${available.join(', ')}` });
    return null;
  }
  return { question, mode, rag: getRag(corpus) };
}

const toSource = ({ section, url, text, score }) => ({ section, url, score, preview: text.slice(0, 300) });

app.post('/api/search', async (req, res) => {
  const p = parse(req, res);
  if (!p) return;
  const sources = await p.rag.search(p.question, { mode: p.mode });
  res.json({ sources: sources.map(toSource) });
});

app.post('/api/ask', async (req, res) => {
  const p = parse(req, res);
  if (!p) return;
  try {
    const { answer, sources } = await p.rag.ask(p.question, { mode: p.mode });
    res.json({
      answer,
      note: answer === null ? 'GEMINI_API_KEY not set; showing retrieved sources only.' : undefined,
      sources: sources.map(toSource),
    });
  } catch (err) {
    console.error('ask failed:', err.message);
    res.status(502).json({ error: 'generation failed' });
  }
});

app.listen(PORT, () => console.log(`http://localhost:${PORT} (corpora: ${available.join(', ')})`));
