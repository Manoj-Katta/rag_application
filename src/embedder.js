import { pipeline } from '@huggingface/transformers';

export const EMBED_MODEL = 'Xenova/bge-small-en-v1.5';
export const DIM = 384;

// bge models are trained with this instruction on the query side only.
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

let extractor;
async function getExtractor() {
  extractor ??= await pipeline('feature-extraction', EMBED_MODEL, { dtype: 'fp32' });
  return extractor;
}

export async function embedPassages(texts) {
  const ex = await getExtractor();
  const out = await ex(texts, { pooling: 'cls', normalize: true });
  return out.tolist();
}

export async function embedQuery(text) {
  const [v] = await embedPassages([QUERY_PREFIX + text]);
  return v;
}
