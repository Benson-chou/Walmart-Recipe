import { allergiesToFilterList, extractAllergensFromText, filterItemsByAllergies, recipeConflictsWithAllergies } from "@/lib/allergens";
import { embedText, parseEmbedding, recipeToEmbedText } from "@/lib/embeddings";
import { runOrchestratorAgent } from "@/lib/agents/orchestrator";
import { runValidatorLoop } from "@/lib/agents/validator-loop";
import {
  parseCatalogRecipesFromToolJson,
  searchFoodComRecipes,
} from "@/lib/agents/tools/search-food-com";
import { ensureRecipeQuantities } from "@/lib/ingredients";
import type { Recipe } from "@/lib/types";

export type RankedRecipe = Recipe & {
  id?: string;
  score: number;
  source: "retrieved" | "generated";
};

export type RecommendResult = {
  recipes: RankedRecipe[];
  notice?: string;
  fallbackUsed?: boolean;
};

export type RecommendInput = {
  items: string[];
  budget: number;
  allergies: string;
  creativity?: number | string;
  styleRequest?: string;
  userEmbedding?: number[] | null;
};

function finalizeRecipes(recipes: RankedRecipe[]): RankedRecipe[] {
  return recipes.map((recipe) => ensureRecipeQuantities(recipe) as RankedRecipe);
}

async function persistGenerated(recipe: Recipe, source = "generated") {
  const embedding = await embedText(
    recipeToEmbedText({
      recipe_name: recipe.Recipe_name,
      ingredients: recipe.Ingredients,
      description: recipe.Instructions,
    })
  );
  const allergens = extractAllergensFromText(
    `${recipe.Ingredients}\n${recipe.Instructions}`
  );

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data } = await admin
      .from("recipes")
      .insert({
        recipe_name: recipe.Recipe_name,
        ingredients: recipe.Ingredients,
        description: recipe.Instructions,
        source,
        allergens,
        embedding,
      })
      .select("id")
      .single();
    return data?.id as string | undefined;
  } catch (error) {
    console.error("persistGenerated failed:", error);
    return undefined;
  }
}

/**
 * Agentic RAG pipeline:
 * 1) Orchestrator (tool calling) → Top 2 Food.com recipes
 * 2) Context-infused generator + multi-turn validator → 1 new recipe
 * 3) Return 2 real + 1 generated
 */
export async function recommendRecipes(input: RecommendInput): Promise<RecommendResult> {
  const safeItems = filterItemsByAllergies(input.items, input.allergies);
  if (!safeItems.length) return { recipes: [] };

  const effective = {
    ...input,
    items: safeItems,
    styleRequest: input.styleRequest?.trim() || undefined,
  };

  // 1. Orchestrator retrieves Top 2 via Gemini tool calling (with automatic failover)
  const orchestrated = await runOrchestratorAgent({
    items: effective.items,
    budget: effective.budget,
    allergies: effective.allergies,
    creativity: effective.creativity,
    styleRequest: effective.styleRequest,
  });

  // Short-circuit: if all Gemini models failed (e.g. 503 high demand or 429 quota),
  // bypass the validator loop completely to avoid 30+ seconds of timeout delays.
  if (orchestrated.aiUnavailable) {
    let catalogRecipes = [...orchestrated.topRecipes];
    if (catalogRecipes.length < 3) {
      const json = await searchFoodComRecipes(
        [effective.items.join(", "), effective.styleRequest || "dinner"].filter(Boolean).join(" | "),
        { allergies: effective.allergies, matchCount: 8 }
      );
      const extra = parseCatalogRecipesFromToolJson(json);
      const seen = new Set(catalogRecipes.map((r) => r.id));
      for (const recipe of extra) {
        if (seen.has(recipe.id)) continue;
        catalogRecipes.push(recipe);
        if (catalogRecipes.length >= 3) break;
      }
    }

    const recipes = finalizeRecipes(
      catalogRecipes.slice(0, 3).map((recipe, index) => ({
        ...ensureRecipeQuantities(recipe),
        id: recipe.id,
        score: recipe.similarity ?? 0.85 - index * 0.05,
        source: "retrieved" as const,
      }))
    );

    return {
      recipes,
      notice: "Google Gemini is currently experiencing high demand. We served top verified recipes from our Food.com catalog for you.",
      fallbackUsed: true,
    };
  }

  let topTwo = orchestrated.topRecipes.slice(0, 2);

  // Safety net if orchestrator returned < 2
  if (topTwo.length < 2) {
    const json = await searchFoodComRecipes(
      [effective.items.join(", "), effective.styleRequest || "dinner"].filter(Boolean).join(" | "),
      { allergies: effective.allergies, matchCount: 8 }
    );
    const extra = parseCatalogRecipesFromToolJson(json);
    const seen = new Set(topTwo.map((r) => r.id));
    for (const recipe of extra) {
      if (seen.has(recipe.id)) continue;
      topTwo.push(recipe);
      if (topTwo.length >= 2) break;
    }
  }

  const retrieved: RankedRecipe[] = topTwo.map((recipe, index) => ({
    ...ensureRecipeQuantities(recipe),
    id: recipe.id,
    score: recipe.similarity ?? 0.8 - index * 0.05,
    source: "retrieved" as const,
  }));

  // 2–4. Generate 3rd recipe with ground-truth context + validator loop (max 3)
  const loop = await runValidatorLoop({
    items: effective.items,
    budget: effective.budget,
    allergies: effective.allergies,
    creativity: effective.creativity,
    styleRequest: effective.styleRequest,
    groundTruth: topTwo,
    maxRetries: 3,
  });

  const generated: RankedRecipe[] = [];
  if (loop.recipe && !recipeConflictsWithAllergies(loop.recipe, effective.allergies)) {
    const id = await persistGenerated(loop.recipe);
    generated.push({
      ...ensureRecipeQuantities(loop.recipe),
      id,
      score: loop.passed ? 0.75 : 0.55,
      source: "generated",
    });
  }

  let notice: string | undefined;
  // If the generator was unable to produce a new recipe, complete the plate with a 3rd catalog recipe
  if (!generated.length && retrieved.length > 0) {
    if (retrieved.length < 3) {
      const json = await searchFoodComRecipes(
        [effective.items.join(", "), effective.styleRequest || "dinner"].filter(Boolean).join(" | "),
        { allergies: effective.allergies, matchCount: 8 }
      );
      const extra = parseCatalogRecipesFromToolJson(json);
      const seen = new Set(retrieved.map((r) => r.id));
      for (const recipe of extra) {
        if (seen.has(recipe.id)) continue;
        retrieved.push({
          ...ensureRecipeQuantities(recipe),
          id: recipe.id,
          score: recipe.similarity ?? 0.65,
          source: "retrieved" as const,
        });
        if (retrieved.length >= 3) break;
      }
    }
    notice = "Google Gemini is temporarily experiencing high demand. Showing 3 verified recipes from our Food.com catalog.";
  }

  // Final plate: 2 real + 1 generated (generated first for visibility)
  const final = [...generated, ...retrieved].slice(0, 3);
  if (!final.length) {
    // Absolute last resort: raw catalog search
    const json = await searchFoodComRecipes(effective.items.join(", "), {
      allergies: effective.allergies,
      matchCount: 3,
    });
    return {
      recipes: finalizeRecipes(
        parseCatalogRecipesFromToolJson(json).slice(0, 3).map((r, i) => ({
          ...r,
          score: r.similarity ?? 0.5 - i * 0.05,
          source: "retrieved" as const,
        }))
      ),
      notice: "Showing top matches from catalog.",
      fallbackUsed: true,
    };
  }

  return {
    recipes: finalizeRecipes(final),
    notice,
    fallbackUsed: orchestrated.fallbackUsed || !generated.length,
  };
}

/** Profile “you may also like” — direct vector search (no generate loop). */
export async function recommendForUser(input: {
  userEmbedding: number[] | null;
  allergies: string;
  excludeIds?: string[];
  limit?: number;
}): Promise<Recipe[]> {
  const filterAllergens = allergiesToFilterList(input.allergies);
  const parsed = parseEmbedding(input.userEmbedding);
  // Avoid embedding the allergy label itself as the query ("Allergies: Mustard"
  // retrieves mustard recipes that then get filtered out → 0–1 results).
  const queryEmbedding =
    parsed?.length
      ? parsed
      : await embedText("weeknight dinner recipes home cooking favorites");

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const limit = input.limit ?? 6;
    const exclude = new Set(input.excludeIds ?? []);
    // Over-fetch heavily: allergen RPC filter + text re-check + exclude saved
    // can discard most of a small candidate pool.
    const matchCount = Math.min(80, Math.max(24, limit + exclude.size + 24));

    const { data, error } = await admin.rpc("match_recipes", {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      filter_allergens: filterAllergens,
    });
    if (error) {
      console.error("recommendForUser match_recipes error:", error);
      return [];
    }

    return ((data ?? []) as Array<{
      id: string;
      recipe_name: string;
      ingredients: string;
      description: string;
    }>)
      .filter((row) => !exclude.has(row.id))
      .map((row) =>
        ensureRecipeQuantities({
          id: row.id,
          Recipe_name: row.recipe_name,
          Ingredients: row.ingredients,
          Instructions: row.description,
          source: "retrieved",
        })
      )
      .filter((recipe) => !recipeConflictsWithAllergies(recipe, input.allergies))
      .slice(0, limit);
  } catch (error) {
    console.error("recommendForUser failed:", error);
    return [];
  }
}
