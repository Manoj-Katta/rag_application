import matter from 'gray-matter';
import { paragraphs, packParagraphs, MIN_CHARS } from '../chunking.js';

// Hugo shortcodes carry meaning in a few cases (glossary terms), so rewrite
// those to plain text before stripping the rest.
function stripHugo(body) {
  return body
    .replace(/\{\{<\s*glossary_tooltip\s+([^>]*?)>\}\}/g, (_, attrs) => {
      const text = attrs.match(/text="([^"]*)"/);
      const term = attrs.match(/term_id="([^"]*)"/);
      return text ? text[1] : term ? term[1].replace(/-/g, ' ') : '';
    })
    .replace(/\{\{[<%][\s\S]*?[>%]\}\}/g, '');
}

export function cleanMarkdown(body, preprocess = []) {
  let out = body.replace(/<!--[\s\S]*?-->/g, '');
  if (preprocess.includes('hugo')) out = stripHugo(out);
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function slugify(heading) {
  return heading
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function docUrl(relPath, urlBase) {
  if (!urlBase) return null;
  const p = relPath.replace(/\.(md|mdx|txt)$/, '').replace(/(^|\/)_index$/, '');
  return `${urlBase}${p}${p ? '/' : ''}`;
}

// One chunk per heading section (split further if long). Each chunk carries its
// heading path so a section like "Limitations" is still retrievable out of context.
export function chunkMarkdown(raw, relPath, { preprocess = [], urlBase } = {}) {
  const { data, content } = matter(raw);
  const title = data.title || relPath.split('/').pop().replace(/\.\w+$/, '');
  const body = cleanMarkdown(content, preprocess);
  const url = docUrl(relPath, urlBase);

  const sections = [];
  let headings = [];
  let anchor = '';
  let lines = [];
  let inFence = false;

  const flush = () => {
    const text = lines.join('\n').trim();
    if (text) sections.push({ headings: [...headings], anchor, text });
    lines = [];
  };

  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = !inFence && line.match(/^(#{2,4})\s+(.*?)\s*(\{#([^}]+)\})?\s*$/);
    if (m) {
      flush();
      const level = m[1].length;
      headings = headings.slice(0, level - 2);
      headings[level - 2] = m[2].replace(/`/g, '');
      anchor = m[4] || slugify(m[2]);
      continue;
    }
    lines.push(line);
  }
  flush();

  const chunks = [];
  for (const s of sections) {
    const path = [title, ...s.headings.filter(Boolean)].join(' > ');
    for (const text of packParagraphs(paragraphs(s.text))) {
      if (text.length < MIN_CHARS) continue;
      chunks.push({
        doc: relPath,
        title,
        section: path,
        url: url && s.anchor ? `${url}#${s.anchor}` : url,
        text,
      });
    }
  }
  return chunks;
}
