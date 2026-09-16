import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { ensureRecipeQuantities } from "@/lib/ingredients";
import { createPublicClient } from "@/lib/supabase/public";
import type { Recipe, RecipeSource } from "@/lib/types";

const RECIPE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRecipeId(id: string) {
  return RECIPE_UUID.test(id);
}

function toRecipeSource(source?: string | null): RecipeSource | undefined {
  if (source === "generated") return "generated";
  if (source === "retrieved" || source === "seed") return "retrieved";
  return undefined;
}

export function splitRecipeLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function instructionSteps(text: string) {
  return splitRecipeLines(text).map((line) =>
    line.replace(/^\d+[\.)]\s*/, "").trim()
  );
}

export function recipeMetaDescription(recipe: Recipe) {
  const preview = splitRecipeLines(recipe.Ingredients).slice(0, 4).join(", ");
  const lead = `Cook ${recipe.Recipe_name} from this week's Walmart deals.`;
  const combined = preview ? `${lead} ${preview}` : lead;
  return combined.length > 180 ? `${combined.slice(0, 177).trimEnd()}…` : combined;
}

export const getPublicRecipe = cache(async (id: string): Promise<Recipe | null> => {
  if (!isRecipeId(id) || !isSupabaseConfigured()) return null;

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("recipes")
      .select("id, recipe_name, ingredients, description, source")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;

    return ensureRecipeQuantities({
      id: data.id,
      Recipe_name: data.recipe_name,
      Ingredients: data.ingredients,
      Instructions: data.description,
      source: toRecipeSource(data.source),
    });
  } catch (error) {
    console.error("getPublicRecipe failed:", error);
    return null;
  }
});
