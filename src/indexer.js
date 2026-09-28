import fs from 'node:fs';
import path from 'node:path';
import { loadFile, EXTENSIONS } from './loaders/index.js';
import { embedPassages, EMBED_MODEL, DIM } from './embedder.js';

const BATCH = 32;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name.startsWith('.') ? [] : walk(p);
    return EXTENSIONS.some((ext) => e.name.toLowerCase().endsWith(ext)) ? [p] : [];
  });
}

export async function buildIndex(corpus, { log = console.log } = {}) {
  if (!fs.existsSync(corpus.docsDir)) throw new Error(`No sources at ${corpus.docsDir}. Run: npm run fetch -- ${corpus.name}`);

  const manifest = path.join(corpus.sourceDir, 'urls.json');
  const withUrls = fs.existsSync(manifest) ? { ...corpus, sourceUrls: JSON.parse(fs.readFileSync(manifest, 'utf8')) } : corpus;

  const roots = corpus.include.length ? corpus.include.map((d) => path.join(corpus.docsDir, d)) : [corpus.docsDir];
  const files = roots.flatMap(walk);
  const chunks = [];
  for (const f of files) chunks.push(...(await loadFile(f, path.relative(corpus.docsDir, f), withUrls)));
  log(`${corpus.name}: ${files.length} files -> ${chunks.length} chunks`);
  if (!chunks.length) throw new Error('no chunks produced; check root/include in the corpus config');

  const vectors = new Float32Array(chunks.length * DIM);
  const started = Date.now();
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const embs = await embedPassages(batch.map((c) => `${c.section}\n\n${c.text}`));
    embs.forEach((v, j) => vectors.set(v, (i + j) * DIM));
    if ((i / BATCH) % 20 === 0) log(`embedded ${Math.min(i + BATCH, chunks.length)}/${chunks.length} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  }

  fs.mkdirSync(corpus.indexDir, { recursive: true });
  fs.writeFileSync(path.join(corpus.indexDir, 'chunks.json'), JSON.stringify(chunks));
  fs.writeFileSync(path.join(corpus.indexDir, 'vectors.bin'), Buffer.from(vectors.buffer));
  const meta = { corpus: corpus.name, model: EMBED_MODEL, dim: DIM, chunks: chunks.length, files: files.length, builtAt: new Date().toISOString() };
  fs.writeFileSync(path.join(corpus.indexDir, 'meta.json'), JSON.stringify(meta, null, 2));
  log(`index written to ${corpus.indexDir} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  return meta;
}
