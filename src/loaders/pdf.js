import { extractText, getDocumentProxy } from 'unpdf';
import { packParagraphs, MIN_CHARS } from '../chunking.js';

// PDF text arrives as visual lines: rejoin them into running text, undo
// end-of-line hyphenation, then pack by sentence. Chunks stay within a page
// so each citation points at a page the reader can open.
function pageSentences(pageText) {
  const text = pageText
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [];
}

export async function chunkPdf(buffer, relPath, { url, title: givenTitle } = {}) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const info = await pdf.getMetadata().catch(() => null);
  const title = givenTitle || info?.info?.Title?.trim() || relPath.split('/').pop().replace(/\.pdf$/i, '');
  const { text: pages } = await extractText(pdf, { mergePages: false });

  const chunks = [];
  pages.forEach((pageText, n) => {
    const sentences = pageSentences(pageText).map((s) => s.trim());
    for (const packed of packParagraphs(sentences)) {
      const text = packed.replace(/\n\n/g, ' ');
      if (text.length < MIN_CHARS) continue;
      chunks.push({
        doc: relPath,
        title,
        section: `${title} > p. ${n + 1}`,
        url: url ? `${url}#page=${n + 1}` : null,
        text,
      });
    }
  });
  return chunks;
}
