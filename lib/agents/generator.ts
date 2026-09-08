import type { Recipe } from "@/lib/types";
import { generateMockRecipes } from "@/lib/recipes";
import { recipeConflictsWithAllergies } from "@/lib/allergens";
import { executeWithModelFallback, GEMINI_CHAT_MODEL } from "@/lib/gemini";
import {
  INGREDIENT_QUANTITY_RULES,
  ensureRecipeQuantities,
  ingredientsHaveQuantities,
} from "@/lib/ingredients";
import { getCookingTier } from "@/lib/cooking-tier";
import type { CatalogRecipe } from "@/lib/agents/tools/search-food-com";

function parseJsonObject(text: string): unknown {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

function parseJsonArray(text: string): unknown {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

export type GeneratorContextInput = {
  items: string[];
  budget: number;
  allergies: string;
  creativity?: number | string;
  styleRequest?: string;
  groundTruth: CatalogRecipe[];
  /** Feedback from a previous failed validation round. */
  validatorFeedback?: string;
};

function formatGroundTruth(recipes: CatalogRecipe[]): string {
  if (!recipes.length) return "(no catalog recipes available)";
  return recipes
    .map(
      (r, i) =>
        `### Ground-truth recipe ${i + 1}: ${r.Recipe_name}\n` +
        `Ingredients:\n${r.Ingredients}\n` +
        `Instructions:\n${r.Instructions}`
    )
    .join("\n\n");
}

/**
 * Context-infused generator: invent ONE new recipe guided by Top-2 catalog recipes,
 * incorporating leftover / unused flyer ingredients when possible.
 */
export async function runContextInfusedGenerator(
  input: GeneratorContextInput
): Promise<Recipe | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const mocks = generateMockRecipes(input);
    return mocks[0] ? ensureRecipeQuantities(mocks[0]) : null;
  }

  const tier = getCookingTier(input.creativity);

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(key);

    const groundTruth = formatGroundTruth(input.groundTruth);
    const feedbackBlock = input.validatorFeedback
      ? `\nPrevious validation FAILED. Fix these issues:\n${input.validatorFeedback}\n`
      : "";

    const prompt = `You are a culinary recipe inventor for Walmart weekly-ad shoppers.

User flyer ingredients: ${input.items.join(", ")}
Budget about USD $${input.budget}
Allergies (never include): ${input.allergies}
Cooking attitude / vibe: ${tier.label} — ${tier.subtitle}
${tier.promptGuidance}
Style preferences: ${input.styleRequest?.trim() || "none"}
${feedbackBlock}
## Ground-truth context (2 real Food.com recipes)
Use these as a STRUCTURAL GUIDE for cooking methods, temperatures, timing, and proportions.
Do NOT copy them wholesale — invent a third, original recipe.

${groundTruth}

## Your task
Invent exactly ONE new recipe that:
1. Matches the requested cooking attitude: "${tier.label}" (${tier.subtitle}).
2. Follows the cooking science / method patterns of the ground-truth recipes (oven temps, pan techniques, timing scale).
3. Creatively incorporates remaining leftover flyer ingredients that the catalog recipes under-used.
4. Is culinary-sound, weeknight-friendly, and allergy-safe.
5. Has numbered instruction steps (1., 2., 3., …).
6. ${INGREDIENT_QUANTITY_RULES}

Output ONLY JSON object (not an array):
{"Recipe_name":"...","Ingredients":"newline-separated quantified lines","Instructions":"numbered newline-separated steps"}`;

    const { result } = await executeWithModelFallback(
      async (modelName) => {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: tier.temperature,
            maxOutputTokens: 4096,
          },
        });
        return await model.generateContent(prompt);
      },
      { timeoutMs: 10000 }
    );

    const parsed = parseJsonObject(result.response.text()) as Record<string, unknown>;
    const recipe = ensureRecipeQuantities({
      Recipe_name: String(parsed.Recipe_name ?? parsed.recipe_name ?? ""),
      Ingredients: String(parsed.Ingredients ?? parsed.ingredients ?? ""),
      Instructions: String(parsed.Instructions ?? parsed.description ?? parsed.instructions ?? ""),
      source: "generated",
    });

    if (!recipe.Recipe_name || !recipe.Ingredients || !recipe.Instructions) return null;
    if (recipeConflictsWithAllergies(recipe, input.allergies)) return null;
    return recipe;
  } catch (error) {
    console.warn("runContextInfusedGenerator failed across all models:", error);
    return null;
  }
}

/** @deprecated Prefer runContextInfusedGenerator — kept for simple multi-recipe fallbacks. */
export async function runGeneratorAgent(input: {
  items: string[];
  budget: number;
  allergies: string;
  creativity?: number | string;
  styleRequest?: string;
}): Promise<Recipe[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return generateMockRecipes(input).map(ensureRecipeQuantities);

  const tier = getCookingTier(input.creativity);

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: GEMINI_CHAT_MODEL,
      generationConfig: {
        temperature: tier.temperature,
        maxOutputTokens: 4096,
      },
    });

    const prompt = `You are a recipe generator for Walmart grocery deals.
Create 1-3 recipes using these discounted items: ${input.items.join(", ")}.
Budget about USD $${input.budget}. Strictly avoid these allergies: ${input.allergies}.
Cooking vibe: ${tier.label} (${tier.subtitle}).
${tier.promptGuidance}
Style preferences: ${input.styleRequest?.trim() || "none"}.
Never include an allergen in any recipe, even if a selected item contains it.
You do not need every item in every recipe, but each recipe should use at least one selected item.
${INGREDIENT_QUANTITY_RULES}
Label instruction steps 1., 2., 3., etc.
Output ONLY a JSON array of objects with keys Recipe_name, Ingredients, Instructions.
Ingredients and Instructions must each be one string with newline-separated entries.`;

    const result = await model.generateContent(prompt);
    const parsed = parseJsonArray(result.response.text());
    if (!Array.isArray(parsed) || !parsed.length) {
      return generateMockRecipes(input).map(ensureRecipeQuantities);
    }

    const recipes = parsed
      .map((row) => {
        const obj = row as Record<string, unknown>;
        return ensureRecipeQuantities({
          Recipe_name: String(obj.Recipe_name ?? obj.recipe_name ?? ""),
          Ingredients: String(obj.Ingredients ?? obj.ingredients ?? ""),
          Instructions: String(obj.Instructions ?? obj.description ?? obj.instructions ?? ""),
        });
      })
      .filter((r) => r.Recipe_name && r.Ingredients && r.Instructions);

    return recipes.length ? recipes : generateMockRecipes(input).map(ensureRecipeQuantities);
  } catch (error) {
    console.error("generator agent failed:", error);
    return generateMockRecipes(input).map(ensureRecipeQuantities);
  }
}

export type ValidationResult = {
  ok: boolean;
  recipe?: Recipe;
  reasons: string[];
};

export function validateRecipeLocal(
  recipe: Recipe,
  input: { items: string[]; allergies: string; budget: number }
): ValidationResult {
  const reasons: string[] = [];
  if (!recipe.Recipe_name?.trim()) reasons.push("Missing recipe name");
  if (!recipe.Ingredients?.trim()) reasons.push("Missing ingredients");
  if (!recipe.Instructions?.trim()) reasons.push("Missing instructions");

  if (recipeConflictsWithAllergies(recipe, input.allergies)) {
    reasons.push("Recipe contains a listed allergen");
  }

  const blob = `${recipe.Ingredients}\n${recipe.Instructions}`.toLowerCase();
  const overlap = input.items.some((item) => {
    const tokens = item.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    return tokens.some((t) => blob.includes(t)) || blob.includes(item.toLowerCase());
  });
  if (!overlap) reasons.push("Does not clearly use selected flyer items");

  if (!/\b1\./.test(recipe.Instructions)) {
    reasons.push("Instructions should be numbered");
  }

  const quantityCheck = ingredientsHaveQuantities(recipe.Ingredients);
  if (!quantityCheck.ok) {
    const preview = quantityCheck.missing.slice(0, 4).join("; ");
    reasons.push(
      quantityCheck.missing.length > 4
        ? `Ingredient lines missing quantities (e.g. ${preview}…)`
        : `Ingredient lines missing quantities: ${preview}`
    );
  }

  return { ok: reasons.length === 0, recipe, reasons };
}

export async function runValidatorAgent(
  recipe: Recipe,
  input: {
    items: string[];
    allergies: string;
    budget: number;
    groundTruth?: CatalogRecipe[];
    styleRequest?: string;
  }
): Promise<ValidationResult> {
  const local = validateRecipeLocal(recipe, input);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ...local, recipe: ensureRecipeQuantities(recipe), ok: local.ok };

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(key);

    const groundTruthBlock = input.groundTruth?.length
      ? formatGroundTruth(input.groundTruth)
      : "(none)";

    const prompt = `You are a strict culinary validator comparing a NEW generated recipe against 2 real Food.com recipes.

Selected flyer items: ${input.items.join(", ")}
Budget USD: ${input.budget}
Allergies to avoid: ${input.allergies}
Style preferences: ${input.styleRequest?.trim() || "none"}
${INGREDIENT_QUANTITY_RULES}

## Ground-truth recipes
${groundTruthBlock}

## Candidate recipe to audit
${JSON.stringify(recipe)}

Audit for:
- Cooking science issues (unsafe times/temps, undercooked proteins, illogical step order)
- Missing ingredients that appear in the title but not the ingredient list
- Allergies
- Quantity coverage on every ingredient line
- Whether proportions/method are roughly coherent with the ground-truth style

Return ONLY JSON:
{"ok": boolean, "reasons": string[], "fixed": null | { "Recipe_name": string, "Ingredients": string, "Instructions": string }}
ok=false if any serious issue. If minor and fixable, set ok=true and provide fixed.`;

    const { result } = await executeWithModelFallback(
      async (modelName) => {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0, maxOutputTokens: 1536 },
        });
        return await model.generateContent(prompt);
      },
      { timeoutMs: 12000 }
    );

    const parsed = parseJsonObject(result.response.text()) as {
      ok?: boolean;
      reasons?: string[];
      fixed?: Recipe | null;
    };

    if (parsed.fixed?.Recipe_name && parsed.fixed.Ingredients && parsed.fixed.Instructions) {
      const fixed = ensureRecipeQuantities({
        Recipe_name: parsed.fixed.Recipe_name,
        Ingredients: parsed.fixed.Ingredients,
        Instructions: parsed.fixed.Instructions,
        source: "generated",
      });
      const recheck = validateRecipeLocal(fixed, input);
      return {
        ok: recheck.ok,
        recipe: fixed,
        reasons: [...(parsed.reasons ?? []), ...recheck.reasons],
      };
    }

    const ok = Boolean(parsed.ok) && local.ok;
    return {
      ok,
      recipe: ensureRecipeQuantities(recipe),
      reasons: [...(parsed.reasons ?? []), ...local.reasons],
    };
  } catch (error) {
    console.warn("validator agent failed across models (falling back to local checks):", error);
    return { ...local, recipe: ensureRecipeQuantities(recipe) };
  }
}
