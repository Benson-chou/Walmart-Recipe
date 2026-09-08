import { runContextInfusedGenerator, runValidatorAgent } from "@/lib/agents/generator";
import type { CatalogRecipe } from "@/lib/agents/tools/search-food-com";
import { recipeConflictsWithAllergies } from "@/lib/allergens";
import { ensureRecipeQuantities } from "@/lib/ingredients";
import type { Recipe } from "@/lib/types";

export type ValidatorLoopInput = {
  items: string[];
  budget: number;
  allergies: string;
  creativity?: number | string;
  styleRequest?: string;
  groundTruth: CatalogRecipe[];
  maxRetries?: number;
};

export type ValidatorLoopResult = {
  recipe: Recipe | null;
  attempts: number;
  passed: boolean;
  feedbackHistory: string[];
};

/**
 * Multi-turn agentic loop: generate → validate against ground-truth → regenerate with feedback.
 * Max retries default 3 (i.e. up to 3 generation attempts).
 */
export async function runValidatorLoop(
  input: ValidatorLoopInput
): Promise<ValidatorLoopResult> {
  const maxRetries = input.maxRetries ?? 3;
  const feedbackHistory: string[] = [];
  let validatorFeedback: string | undefined;
  let lastRecipe: Recipe | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const draft = await runContextInfusedGenerator({
      items: input.items,
      budget: input.budget,
      allergies: input.allergies,
      creativity: input.creativity,
      styleRequest: input.styleRequest,
      groundTruth: input.groundTruth,
      validatorFeedback,
    });

    if (!draft) {
      const msg = "Generator returned no recipe (AI unavailable or rate-limited).";
      feedbackHistory.push(`Attempt ${attempt}: ${msg}`);
      // Break early to avoid repeated timeout delays against an overloaded AI service
      break;
    }

    if (recipeConflictsWithAllergies(draft, input.allergies)) {
      const msg = "Recipe conflicts with allergies.";
      feedbackHistory.push(`Attempt ${attempt}: ${msg}`);
      validatorFeedback = feedbackHistory.join("\n");
      lastRecipe = draft;
      continue;
    }

    const validated = await runValidatorAgent(draft, {
      items: input.items,
      budget: input.budget,
      allergies: input.allergies,
      groundTruth: input.groundTruth,
      styleRequest: input.styleRequest,
    });

    const candidate = validated.recipe
      ? ensureRecipeQuantities(validated.recipe)
      : ensureRecipeQuantities(draft);
    lastRecipe = candidate;

    if (validated.ok) {
      return {
        recipe: candidate,
        attempts: attempt,
        passed: true,
        feedbackHistory,
      };
    }

    const reasons =
      validated.reasons.length > 0
        ? validated.reasons.join("; ")
        : "Failed culinary / structure audit.";
    feedbackHistory.push(`Attempt ${attempt}: ${reasons}`);
    validatorFeedback = feedbackHistory.join("\n");
  }

  // Hit max retries — return best effort last draft
  return {
    recipe: lastRecipe,
    attempts: maxRetries,
    passed: false,
    feedbackHistory,
  };
}
