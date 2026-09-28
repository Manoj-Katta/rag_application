import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DOCS_ROOT = path.join(ROOT, 'data', 'k8s-website', 'content', 'en', 'docs');
export const INDEX_DIR = path.join(ROOT, 'data', 'index');
export const PUBLIC_DIR = path.join(ROOT, 'public');
