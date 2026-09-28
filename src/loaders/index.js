import fs from 'node:fs';
import { chunkMarkdown } from './markdown.js';
import { chunkPdf } from './pdf.js';

export const EXTENSIONS = ['.md', '.mdx', '.txt', '.pdf'];

export async function loadFile(absPath, relPath, corpus) {
  if (relPath.toLowerCase().endsWith('.pdf')) {
    const src = corpus.sourceUrls?.[relPath];
    return chunkPdf(fs.readFileSync(absPath), relPath, { url: src?.url, title: src?.title });
  }
  return chunkMarkdown(fs.readFileSync(absPath, 'utf8'), relPath, corpus);
}
