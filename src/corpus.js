import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILTIN_DIR = path.join(PACKAGE_ROOT, 'corpora');
const DATA_DIR = path.join(PACKAGE_ROOT, 'data');

// A corpus is a name from corpora/, a path to a JSON config, or a config object.
// Relative paths inside a config file resolve against that file's directory, so
// another project can keep its config, sources and index next to its own code.
export function loadCorpus(ref) {
  let config;
  let baseDir = BUILTIN_DIR;
  if (typeof ref === 'object') {
    config = ref;
    baseDir = process.cwd();
  } else {
    const file = ref.endsWith('.json') ? path.resolve(ref) : path.join(BUILTIN_DIR, `${ref}.json`);
    if (!fs.existsSync(file)) throw new Error(`Unknown corpus "${ref}". Available: ${listCorpora().join(', ')}`);
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
    baseDir = path.dirname(file);
  }
  if (!config.name) throw new Error('corpus config needs a "name"');

  const resolve = (p) => (path.isAbsolute(p) ? p : path.resolve(baseDir, p));
  const sourceDir =
    config.source?.type === 'local'
      ? resolve(config.source.path)
      : config.sourceDir ? resolve(config.sourceDir) : path.join(DATA_DIR, 'sources', config.name);

  return {
    preprocess: [],
    include: [],
    ...config,
    sourceDir,
    docsDir: path.join(sourceDir, config.root || ''),
    indexDir: config.indexDir ? resolve(config.indexDir) : path.join(DATA_DIR, 'index', config.name),
    evalFile: config.eval ? resolve(config.eval) : null,
  };
}

export function listCorpora() {
  return fs.readdirSync(BUILTIN_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

export function isIndexed(corpus) {
  return fs.existsSync(path.join(corpus.indexDir, 'chunks.json'));
}
