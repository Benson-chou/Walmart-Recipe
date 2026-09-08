import {
  GoogleGenerativeAI,
  type Content,
  type Part,
} from "@google/generative-ai";
import { executeWithModelFallback } from "@/lib/gemini";
import {
  SEARCH_FOOD_COM_TOOL_NAME,
  parseCatalogRecipesFromToolJson,
  searchFoodComRecipes,
  searchFoodComTool,
  type CatalogRecipe,
} from "@/lib/agents/tools/search-food-com";
import { flyerOverlapScore } from "@/lib/allergens";
import { ensureRecipeQuantities } from "@/lib/ingredients";
import { getCookingTier } from "@/lib/cooking-tier";

export type OrchestratorInput = {
  items: string[];
  budget: number;
  allergies: string;
  creativity?: number | string;
  styleRequest?: string;
};

export type OrchestratorResult = {
  topRecipes: CatalogRecipe[];
  searchQueries: string[];
  reasoning: string;
  fallbackUsed?: boolean;
  aiUnavailable?: boolean;
};

function dedupeRecipes(recipes: CatalogRecipe[]): CatalogRecipe[] {
  const seen = new Set<string>();
  const out: CatalogRecipe[] = [];
  for (const recipe of recipes) {
    const key = recipe.id || recipe.Recipe_name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(recipe);
  }
  return out;
}

function pickTopTwo(
  candidates: CatalogRecipe[],
  items: string[]
): CatalogRecipe[] {
  return dedupeRecipes(candidates)
    .map((recipe) => ({
      ...recipe,
      score:
        0.6 * (recipe.similarity ?? 0) +
        0.4 * flyerOverlapScore(recipe.Ingredients, items),
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 2)
    .map((recipe) => ensureRecipeQuantities(recipe) as CatalogRecipe);
}

/** Fallback when Gemini tool-calling is unavailable. */
async function fallbackRetrieve(input: OrchestratorInput): Promise<OrchestratorResult> {
  const query = [
    input.items.join(", "),
    input.styleRequest?.trim() || "",
    "weeknight dinner",
  ]
    .filter(Boolean)
    .join(" | ");

  const json = await searchFoodComRecipes(query, {
    allergies: input.allergies,
    matchCount: 8,
  });
  const recipes = parseCatalogRecipesFromToolJson(json);
  return {
    topRecipes: pickTopTwo(recipes, input.items),
    searchQueries: [query],
    reasoning: "Fallback retrieval without orchestrator tool-calling.",
  };
}

/**
 * Orchestrator agent: uses Gemini function calling to invent search queries,
 * invoke search_food_com_recipes, then select the Top 2 catalog recipes.
 */
export async function runOrchestratorAgent(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const fallback = await fallbackRetrieve(input);
    return { ...fallback, fallbackUsed: true, aiUnavailable: true };
  }

  const searchQueries: string[] = [];
  const collected: CatalogRecipe[] = [];

  try {
    const { result: response, fallbackOccurred } = await executeWithModelFallback(
      async (modelName) => {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
          model: modelName,
          tools: [searchFoodComTool],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        });

        const tier = getCookingTier(input.creativity);

        const userPrompt = `User flyer ingredients: ${input.items.join(", ")}
Budget about USD $${input.budget}
Allergies to avoid: ${input.allergies}
Cooking vibe: ${tier.label} — ${tier.subtitle}
Style preferences: ${input.styleRequest?.trim() || "none specified"}

Steps:
1. Infer 1-3 focused search queries matching the ingredients, cooking vibe, and style (e.g. for "Just make it edible", search simple/quick dishes; for "Surprise me with something new", search innovative dishes).
2. Call the tool ${SEARCH_FOOD_COM_TOOL_NAME} for each useful query.
3. After tool results, choose exactly the Top 2 best-matching recipes for this shopper.
4. Reply with ONLY JSON (no markdown):
{"top_ids":["uuid1","uuid2"],"reasoning":"short explanation","queries_used":["..."]}`;

        const contents: Content[] = [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ];

        let res = await model.generateContent({ contents });
        let turnResponse = res.response;

        // Agentic tool loop (bounded)
        for (let turn = 0; turn < 4; turn++) {
          const calls = turnResponse.functionCalls?.() ?? [];
          if (!calls.length) break;

          // Append model candidate to conversation history
          const candidateContent = turnResponse.candidates?.[0]?.content;
          if (candidateContent) {
            contents.push({
              role: "model",
              parts: candidateContent.parts,
            });
          }

          const functionResponses: Part[] = [];
          for (const call of calls) {
            if (call.name !== SEARCH_FOOD_COM_TOOL_NAME) {
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { error: `Unknown tool: ${call.name}` },
                },
              });
              continue;
            }

            const args = (call.args ?? {}) as {
              query_text?: string;
              match_count?: number;
            };
            const queryText = String(args.query_text ?? "").trim();
            if (queryText && !searchQueries.includes(queryText)) searchQueries.push(queryText);

            const toolJson = await searchFoodComRecipes(queryText, {
              allergies: input.allergies,
              matchCount: Number(args.match_count) || 6,
            });
            collected.push(...parseCatalogRecipesFromToolJson(toolJson));

            functionResponses.push({
              functionResponse: {
                name: SEARCH_FOOD_COM_TOOL_NAME,
                response: JSON.parse(toolJson) as object,
              },
            });
          }

          // Newer Gemini models require function responses to be passed under role: "user"
          contents.push({
            role: "user",
            parts: functionResponses,
          });

          res = await model.generateContent({ contents });
          turnResponse = res.response;
        }

        return turnResponse;
      },
      { timeoutMs: 10000 }
    );

    // Parse final selection if present
    let text = "";
    try {
      text = response.text();
    } catch {
      text = "";
    }

    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    let selectedIds: string[] = [];
    let reasoning = "Selected by overlap ranking after tool search.";
    try {
      const parsed = JSON.parse(cleaned) as {
        top_ids?: string[];
        reasoning?: string;
        queries_used?: string[];
      };
      if (Array.isArray(parsed.top_ids)) {
        selectedIds = parsed.top_ids.map(String);
      }
      if (parsed.reasoning) reasoning = parsed.reasoning;
      if (Array.isArray(parsed.queries_used)) {
        for (const q of parsed.queries_used) {
          if (q && !searchQueries.includes(q)) searchQueries.push(q);
        }
      }
    } catch {
      /* ranking fallback below */
    }

    const byId = new Map(dedupeRecipes(collected).map((r) => [r.id, r]));
    const fromIds = selectedIds
      .map((id) => byId.get(id))
      .filter((r): r is CatalogRecipe => Boolean(r))
      .slice(0, 2);

    if (fromIds.length >= 2) {
      return {
        topRecipes: fromIds.map((r) => ensureRecipeQuantities(r) as CatalogRecipe),
        searchQueries,
        reasoning,
        fallbackUsed: fallbackOccurred,
      };
    }

    const ranked = pickTopTwo([...fromIds, ...collected], input.items);
    if (!ranked.length) {
      const fallback = await fallbackRetrieve(input);
      return { ...fallback, fallbackUsed: true };
    }

    return {
      topRecipes: ranked,
      searchQueries: searchQueries.length ? searchQueries : ["(ranked fallback)"],
      reasoning,
      fallbackUsed: fallbackOccurred,
    };
  } catch (error) {
    console.warn("runOrchestratorAgent failed across all Gemini models (falling back to vector retrieval):", error);
    const fallback = await fallbackRetrieve(input);
    return {
      ...fallback,
      fallbackUsed: true,
      aiUnavailable: true,
    };
  }
}
