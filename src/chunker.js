import matter from 'gray-matter';

const MAX_CHARS = 1500;

// Hugo shortcodes carry meaning in a few cases (glossary terms), so rewrite
// those to plain text before stripping the rest.
export function cleanMarkdown(body) {
  return body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{<\s*glossary_tooltip\s+([^>]*?)>\}\}/g, (_, attrs) => {
      const text = attrs.match(/text="([^"]*)"/);
      const term = attrs.match(/term_id="([^"]*)"/);
      return text ? text[1] : term ? term[1].replace(/-/g, ' ') : '';
    })
    .replace(/\{\{[<%][\s\S]*?[>%]\}\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function slugify(heading) {
  return heading
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function docUrl(relPath) {
  const p = relPath.replace(/\.md$/, '').replace(/(^|\/)_index$/, '');
  return `https://kubernetes.io/docs/${p}${p ? '/' : ''}`;
}

// Blank lines split paragraphs, except inside fenced code blocks, which stay whole.
function paragraphs(text) {
  const out = [];
  let buf = [];
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence && line.trim() === '') {
      if (buf.length) out.push(buf.join('\n'));
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (buf.length) out.push(buf.join('\n'));
  return out;
}

function packParagraphs(paras) {
  const chunks = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > MAX_CHARS) {
      chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// One chunk per heading section (split further if long). Each chunk carries its
// heading path so a section like "Limitations" is still retrievable out of context.
export function chunkDocument(raw, relPath) {
  const { data, content } = matter(raw);
  const title = data.title || relPath;
  const body = cleanMarkdown(content);
  const url = docUrl(relPath);

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
      if (text.length < 80) continue;
      chunks.push({
        doc: relPath,
        title,
        section: path,
        url: s.anchor ? `${url}#${s.anchor}` : url,
        text,
      });
    }
  }
  return chunks;
}
