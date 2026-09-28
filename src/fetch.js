import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed`);
}

// Sparse, shallow clone: only the docs subtree is downloaded.
function fetchGit(corpus) {
  const { repo, sparsePath } = corpus.source;
  const dir = corpus.sourceDir;
  if (fs.existsSync(path.join(dir, '.git'))) return git(['pull', '--depth', '1'], dir);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  git(['clone', '--depth', '1', '--filter=blob:none', ...(sparsePath ? ['--sparse'] : []), repo, dir]);
  if (sparsePath) git(['sparse-checkout', 'set', sparsePath], dir);
}

// Downloads each URL once; urls.json maps saved files back to their source URL
// and title so PDF citations can link to the original.
async function fetchUrls(corpus) {
  fs.mkdirSync(corpus.sourceDir, { recursive: true });
  const manifest = {};
  for (const entry of corpus.source.urls) {
    const { url, title } = typeof entry === 'string' ? { url: entry } : entry;
    const name = `${new URL(url).pathname.split('/').filter(Boolean).pop()}.pdf`.replace(/\.pdf\.pdf$/i, '.pdf');
    const file = path.join(corpus.sourceDir, name);
    if (!fs.existsSync(file)) {
      const res = await fetch(url, { headers: { 'User-Agent': 'rag_application (docs ingest)' } });
      if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      console.log(`downloaded ${name}`);
    }
    manifest[name] = { url, title };
  }
  fs.writeFileSync(path.join(corpus.sourceDir, 'urls.json'), JSON.stringify(manifest, null, 2));
}

export async function fetchSources(corpus) {
  const type = corpus.source?.type;
  if (type === 'git') return fetchGit(corpus);
  if (type === 'urls') return fetchUrls(corpus);
  if (type === 'local') return console.log(`local source, nothing to fetch: ${corpus.sourceDir}`);
  throw new Error(`unsupported source type "${type}"`);
}
