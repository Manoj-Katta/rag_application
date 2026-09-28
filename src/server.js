import 'dotenv/config';
import express from 'express';
import { Retriever } from './retriever.js';
import { answer, generationEnabled } from './generate.js';
import { PUBLIC_DIR } from './paths.js';

const PORT = process.env.PORT || 3000;
const MODES = new Set(['hybrid', 'vector', 'keyword']);

const retriever = new Retriever();
const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function parse(req, res) {
  const question = String(req.body?.question || '').trim();
  const mode = MODES.has(req.body?.mode) ? req.body.mode : 'hybrid';
  if (!question || question.length > 500) {
    res.status(400).json({ error: 'question must be 1-500 characters' });
    return null;
  }
  return { question, mode };
}

const toSource = ({ section, url, text, score }) => ({ section, url, score, preview: text.slice(0, 300) });

app.post('/api/search', async (req, res) => {
  const p = parse(req, res);
  if (!p) return;
  const hits = await retriever.search(p.question, { mode: p.mode });
  res.json({ sources: hits.map(toSource) });
});

app.post('/api/ask', async (req, res) => {
  const p = parse(req, res);
  if (!p) return;
  const hits = await retriever.search(p.question, { mode: p.mode });
  if (!generationEnabled()) {
    return res.json({ answer: null, note: 'GEMINI_API_KEY not set; showing retrieved sources only.', sources: hits.map(toSource) });
  }
  try {
    res.json({ answer: await answer(p.question, hits), sources: hits.map(toSource) });
  } catch (err) {
    console.error('generation failed:', err.message);
    res.status(502).json({ error: 'generation failed', sources: hits.map(toSource) });
  }
});

app.listen(PORT, () => console.log(`http://localhost:${PORT} (${retriever.chunks.length} chunks, generation ${generationEnabled() ? 'on' : 'off'})`));
