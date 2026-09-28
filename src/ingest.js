import fs from 'node:fs';
import path from 'node:path';
import { chunkDocument } from './chunker.js';
import { embedPassages, EMBED_MODEL, DIM } from './embedder.js';
import { DOCS_ROOT, INDEX_DIR } from './paths.js';

// Generated API/CLI reference and contributor guides are excluded: they are
// large, repetitive, and drown out the conceptual pages users actually ask about.
const SECTIONS = ['concepts', 'tasks', 'tutorials', 'setup'];
const BATCH = 32;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : [];
  });
}

async function main() {
  if (!fs.existsSync(DOCS_ROOT)) {
    console.error(`Docs not found at ${DOCS_ROOT}. Run: npm run fetch-docs`);
    process.exit(1);
  }

  const files = SECTIONS.flatMap((s) => walk(path.join(DOCS_ROOT, s)));
  const chunks = files.flatMap((f) =>
    chunkDocument(fs.readFileSync(f, 'utf8'), path.relative(DOCS_ROOT, f))
  );
  console.log(`${files.length} pages -> ${chunks.length} chunks`);

  const vectors = new Float32Array(chunks.length * DIM);
  const started = Date.now();
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const embs = await embedPassages(batch.map((c) => `${c.section}\n\n${c.text}`));
    embs.forEach((v, j) => vectors.set(v, (i + j) * DIM));
    if ((i / BATCH) % 20 === 0) {
      const done = Math.min(i + BATCH, chunks.length);
      console.log(`embedded ${done}/${chunks.length} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    }
  }

  fs.mkdirSync(INDEX_DIR, { recursive: true });
  fs.writeFileSync(path.join(INDEX_DIR, 'chunks.json'), JSON.stringify(chunks));
  fs.writeFileSync(path.join(INDEX_DIR, 'vectors.bin'), Buffer.from(vectors.buffer));
  fs.writeFileSync(
    path.join(INDEX_DIR, 'meta.json'),
    JSON.stringify({ model: EMBED_MODEL, dim: DIM, chunks: chunks.length, pages: files.length, builtAt: new Date().toISOString() }, null, 2)
  );
  console.log(`index written to ${INDEX_DIR} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

main();
