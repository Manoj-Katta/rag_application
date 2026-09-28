import { GoogleGenAI } from '@google/genai';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const SYSTEM = `You answer questions about Kubernetes using ONLY the numbered documentation excerpts provided.
Rules:
- Cite every claim with the excerpt number in square brackets, e.g. [2].
- If the excerpts do not contain the answer, say "The retrieved docs don't cover this." and stop. Do not use outside knowledge.
- Be concise. Prefer a short explanation plus a YAML or kubectl example if an excerpt has one.`;

let client;

export function generationEnabled() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function answer(question, chunks) {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const context = chunks
    .map((c, n) => `[${n + 1}] ${c.section}\n${c.text}`)
    .join('\n\n---\n\n');
  const res = await client.models.generateContent({
    model: MODEL,
    contents: `Excerpts:\n\n${context}\n\nQuestion: ${question}`,
    config: { systemInstruction: SYSTEM, temperature: 0.2 },
  });
  return res.text ?? '';
}
