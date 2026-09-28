export const MAX_CHARS = 1500;
export const MIN_CHARS = 80;

// Blank lines split paragraphs, except inside fenced code blocks, which stay whole.
export function paragraphs(text) {
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

export function packParagraphs(paras, max = MAX_CHARS) {
  const chunks = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > max) {
      chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}
