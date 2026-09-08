import { SchemaType, type FunctionDeclarationsTool } from "@google/generative-ai";
import { allergiesToFilterList, recipeConflictsWithAllergies } from "@/lib/allergens";
import { embedText } from "@/lib/embeddings";
import { ensureRecipeQuantities } from "@/lib/ingredients";
import type { Recipe } from "@/lib/types";

export type CatalogRecipe = Recipe & {
  id: string;
  similarity: number;
  source: "retrieved";
  tags?: string[];
  allergens?: string[];
};

export const SEARCH_FOOD_COM_TOOL_NAME = "search_food_com_recipes";

/** Gemini function declaration for the Food.com / catalog vector search tool. */
export const searchFoodComTool: FunctionDeclarationsTool = {
  functionDeclarations: [
    {
      name: SEARCH_FOOD_COM_TOOL_NAME,
      description:
        "Semantic search over the Food.com recipe catalog stored in Supabase (pgvector). " +
        "Pass a focused cooking query (dish style, key proteins, techniques, or ingredient themes). " +
        "Call multiple times with different query_text values to cover ingredient synonyms or alternate dish ideas.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query_text: {
            type: SchemaType.STRING,
            description:
              "Natural-language search query, e.g. 'skillet chicken with garlic and rice' or 'vegetarian sheet pan dinner'.",
          },
          match_count: {
            type: SchemaType.INTEGER,
            description: "How many recipes to return (default 6, max 12).",
          },
        },
        required: ["query_text"],
      },
    },
  ],
};

type MatchRow = {
  id: string;
  recipe_name: string;
  ingredients: string;
  description: string;
  source?: string;
  tags?: string[];
  allergens?: string[];
  similarity: number;
};

/**
 * Tool implementation: embed query_text with Gemini, then call Supabase match_recipes.
 * Returns a clean JSON string for the orchestrator model to read.
 */
export async function searchFoodComRecipes(
  queryText: string,
  options?: {
    allergies?: string;
    matchCount?: number;
  }
): Promise<string> {
  const query = queryText.trim();
  if (!query) {
    return JSON.stringify({ ok: false, error: "query_text is required", recipes: [] });
  }

  const matchCount = Math.min(12, Math.max(1, options?.matchCount ?? 6));
  const filterAllergens = allergiesToFilterList(options?.allergies ?? "None");

  try {
    const queryEmbedding = await embedText(query);
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("match_recipes", {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      filter_allergens: filterAllergens,
    });

    if (error) {
      console.error("search_food_com_recipes RPC error:", error);
      return JSON.stringify({
        ok: false,
        error: error.message,
        recipes: [],
      });
    }

    const rows = (data ?? []) as MatchRow[];
    const recipes = rows
      .map((row) => {
        const recipe = ensureRecipeQuantities({
          id: row.id,
          Recipe_name: row.recipe_name,
          Ingredients: row.ingredients,
          Instructions: row.description,
          source: "retrieved" as const,
          score: row.similarity,
        });
        return { recipe, similarity: row.similarity, tags: row.tags ?? [] };
      })
      .filter(({ recipe }) => !recipeConflictsWithAllergies(recipe, options?.allergies ?? "None"))
      .map(({ recipe, similarity, tags }) => ({
        id: recipe.id,
        Recipe_name: recipe.Recipe_name,
        Ingredients: recipe.Ingredients,
        Instructions: recipe.Instructions,
        similarity,
        tags,
      }));

    return JSON.stringify({
      ok: true,
      query: query,
      count: recipes.length,
      recipes,
    });
  } catch (error) {
    console.error("search_food_com_recipes failed:", error);
    return JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "Search failed",
      recipes: [],
    });
  }
}

export function parseCatalogRecipesFromToolJson(payload: string): CatalogRecipe[] {
  try {
    const parsed = JSON.parse(payload) as {
      recipes?: Array<{
        id?: string;
        Recipe_name?: string;
        Ingredients?: string;
        Instructions?: string;
        similarity?: number;
      }>;
    };
    if (!Array.isArray(parsed.recipes)) return [];
    return parsed.recipes
      .filter((r) => r.id && r.Recipe_name && r.Ingredients && r.Instructions)
      .map((r) =>
        ensureRecipeQuantities({
          id: String(r.id),
          Recipe_name: String(r.Recipe_name),
          Ingredients: String(r.Ingredients),
          Instructions: String(r.Instructions),
          source: "retrieved" as const,
          score: Number(r.similarity) || 0,
        })
      )
      .map((r) => ({
        ...r,
        id: String(r.id),
        similarity: r.score ?? 0,
        source: "retrieved" as const,
      }));
  } catch {
    return [];
  }
}
