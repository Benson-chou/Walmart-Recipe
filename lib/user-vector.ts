import { embedText, meanPool, recipeToEmbedText } from "@/lib/embeddings";

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
    .select("recipes ( recipe_name, ingredients, description )")
    .eq("user_id", userId)
    .limit(40);

  const vectors: number[][] = [];

  const prefText = [
    `Location ${profile?.preferred_location ?? ""}`,
    `Allergies ${profile?.allergies ?? "None"}`,
  ].join("\n");
  vectors.push(await embedText(prefText));

  for (const row of saved ?? []) {
    const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
    if (!recipe) continue;
    vectors.push(
      await embedText(
        recipeToEmbedText({
          recipe_name: recipe.recipe_name,
          ingredients: recipe.ingredients,
          description: recipe.description,
        })
      )
    );
  }

  const embedding = meanPool(vectors);
  await admin.from("profiles").update({ embedding }).eq("id", userId);
  return embedding;
}
