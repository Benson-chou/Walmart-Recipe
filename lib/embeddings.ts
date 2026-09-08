import { GEMINI_EMBED_MODEL } from "@/lib/gemini";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const EMBEDDING_DIM = 768;


export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Deterministic unit vector for local/dev without Gemini. */
export function mockEmbed(text: string, dim = EMBEDDING_DIM): number[] {
  const vec = new Array(dim).fill(0);
  const normalized = text.toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    vec[i % dim] += (code % 31) / 31;
  }
  return l2Normalize(vec);
}

export function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function meanPool(vectors: number[][]): number[] {
  if (!vectors.length) return new Array(EMBEDDING_DIM).fill(0);
  const dim = vectors[0].length;
  const out = new Array(dim).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) out[i] += vec[i] ?? 0;
  }
  for (let i = 0; i < dim; i++) out[i] /= vectors.length;
  return l2Normalize(out);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

export async function embedText(text: string): Promise<number[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return mockEmbed(text);

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: GEMINI_EMBED_MODEL });
    const result = await model.embedContent({
      content: { role: "user", parts: [{ text: text.slice(0, 8000) }] },
      outputDimensionality: EMBEDDING_DIM,
    } as Parameters<typeof model.embedContent>[0]);
    const values = result.embedding.values;
    if (!values?.length) return mockEmbed(text);
    return l2Normalize(values);
  } catch (error) {
    console.error("embedText failed, using mock:", error);
    return mockEmbed(text);
  }
}

export function recipeToEmbedText(input: {
  recipe_name: string;
  ingredients: string;
  description?: string;
  tags?: string[];
}): string {
  return [
    input.recipe_name,
    input.ingredients,
    input.description ?? "",
    (input.tags ?? []).join(", "),
  ]
    .filter(Boolean)
    .join("\n");
}
