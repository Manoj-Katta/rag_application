const STOPWORDS = new Set(
  'a an and are as at be by can do does for from how i if in is it its of on or that the this to what when where which who why will with you your'.split(' ')
);

export function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export class BM25 {
  constructor(docs, { k1 = 1.2, b = 0.75 } = {}) {
    this.k1 = k1;
    this.b = b;
    this.tf = [];
    this.len = [];
    this.df = new Map();
    for (const doc of docs) {
      const counts = new Map();
      const tokens = tokenize(doc);
      for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
      for (const t of counts.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
      this.tf.push(counts);
      this.len.push(tokens.length);
    }
    this.N = docs.length;
    this.avgLen = this.len.reduce((a, b) => a + b, 0) / this.N;
  }

  idf(term) {
    const n = this.df.get(term) || 0;
    return Math.log(1 + (this.N - n + 0.5) / (n + 0.5));
  }

  search(query, k) {
    const terms = [...new Set(tokenize(query))];
    const scores = new Float64Array(this.N);
    for (const term of terms) {
      const idf = this.idf(term);
      if (!this.df.has(term)) continue;
      for (let i = 0; i < this.N; i++) {
        const f = this.tf[i].get(term);
        if (!f) continue;
        const norm = this.k1 * (1 - this.b + (this.b * this.len[i]) / this.avgLen);
        scores[i] += (idf * f * (this.k1 + 1)) / (f + norm);
      }
    }
    return topK(scores, k);
  }
}

export function topK(scores, k) {
  const idx = [];
  for (let i = 0; i < scores.length; i++) if (scores[i] > 0) idx.push(i);
  idx.sort((a, b) => scores[b] - scores[a]);
  return idx.slice(0, k).map((i) => ({ i, score: scores[i] }));
}
