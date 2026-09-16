import { embedText, parseEmbedding, weightedMeanPool } from "@/lib/embeddings";

/** Prefs (ZIP / allergies) stay as a light prior — taste comes from saves. */
const PREF_WEIGHT = 0.15;
/** Base weight for each saved recipe relative to prefs. */
const RECIPE_BASE_WEIGHT = 1;
/** Newest save gets this many times the weight of the oldest among saves. */
const RECENCY_BOOST = 1.5;

/**
 * Rebuilds profiles.embedding from:
 * 1) profile preferences text (weak prior — 1 Gemini embed call)
 * 2) stored recipe.embedding vectors for saved recipes (dominant signal)
 *
 * Saved recipes are recency-weighted so recent bookmarks pull recommendations harder.
 */
export async function refreshUserEmbedding(userId: string) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("allergies, preferred_location")
    .eq("id", userId)
    .maybeSingle();

  const { data: saved } = await admin
    .from("saved")
    .select("created_at, recipes ( embedding )")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  const recipeVectors: number[][] = [];
  for (const row of saved ?? []) {
    const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
    const embedding = parseEmbedding(
      (recipe as { embedding?: unknown } | null)?.embedding
    );
    if (embedding?.length) {
      recipeVectors.push(embedding);
    }
  }

  const weighted: Array<{ vector: number[]; weight: number }> = [];

  const prefText = [
    `Location ${profile?.preferred_location ?? ""}`,
    `Allergies ${profile?.allergies ?? "None"}`,
  ].join("\n");
  weighted.push({
    vector: await embedText(prefText),
    weight: recipeVectors.length === 0 ? 1 : PREF_WEIGHT,
  });

  const n = recipeVectors.length;
  recipeVectors.forEach((vector, index) => {
    const recencyFactor =
      n <= 1 ? 1 : 1 + RECENCY_BOOST * ((n - 1 - index) / (n - 1));
    weighted.push({
      vector,
      weight: RECIPE_BASE_WEIGHT * recencyFactor,
    });
  });

  const embedding = weightedMeanPool(weighted);
  await admin.from("profiles").update({ embedding }).eq("id", userId);
  return embedding;
}
