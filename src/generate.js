import { GoogleGenAI } from '@google/genai';

// Any object with generate({ system, prompt }) -> Promise<string> can replace this,
// so library users can plug in a different model provider.
export function geminiGenerator({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-2.5-flash' } = {}) {
  if (!apiKey) return null;
  const client = new GoogleGenAI({ apiKey });
  return {
    name: `gemini:${model}`,
    async generate({ system, prompt }) {
      const res = await client.models.generateContent({
        model,
        contents: prompt,
        config: { systemInstruction: system, temperature: 0.2 },
      });
      return res.text ?? '';
    },
  };
}
