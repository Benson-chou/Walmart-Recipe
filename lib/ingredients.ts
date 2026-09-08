import type { Recipe } from "@/lib/types";

const MEASUREMENT_UNITS =
  /\b(cup|cups|c\.|tbsp|tbs|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|fl\s*oz|lb|lbs|pound|pounds|g|gram|grams|kg|ml|milliliter|milliliters|l|liter|liters|clove|cloves|slice|slices|can|cans|bunch|head|piece|pieces|inch|inches|package|pkg|bag|stick|sticks|sprig|sprigs|fillet|fillets|breast|breasts|pinch|dash|handful|dozen|quart|pint|packet|packets)\b/i;

const LEADING_QUANTITY =
  /^(\d+[\d\s./\-–—⁄¼½¾⅓⅔⅛⅜⅝⅞]*|\d+\/\d+|[½¼¾⅓⅔⅛⅜⅝⅞]|a\s+|an\s+|one\s+|two\s+|three\s+|four\s+|five\s+|half\s+|quarter\s+|few\s+|couple\s+|several\s+)/i;

const QUALITATIVE_OK = /\b(to taste|as needed|optional)\b/i;

/** Lines that are notes, not ingredients. */
export function isIngredientLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\(avoid:/i.test(trimmed)) return false;
  if (/^stay near usd/i.test(trimmed)) return false;
  return true;
}

/** True when a single ingredient line includes an amount or allowed qualitative measure. */
export function ingredientLineHasQuantity(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (QUALITATIVE_OK.test(trimmed)) return true;
  if (LEADING_QUANTITY.test(trimmed)) return true;
  if (MEASUREMENT_UNITS.test(trimmed)) return true;
  return false;
}

/** Split comma/bullet lists into one ingredient per line. */
export function normalizeIngredientsFormat(ingredients: string): string {
  const text = ingredients.trim();
  if (!text) return text;

  let lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (lines.length === 1 && lines[0].includes(",")) {
    const parts = lines[0]
      .split(/,(?![^(]*\))/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) lines = parts;
  }

  return lines
    .map((line) => line.replace(/^[-•*]\s*/, "").replace(/^\d+[\.)]\s*/, "").trim())
    .filter(Boolean)
    .join("\n");
}

export function parseIngredientLines(ingredients: string): string[] {
  return normalizeIngredientsFormat(ingredients)
    .split("\n")
    .map((line) => line.trim())
    .filter(isIngredientLine);
}

export function ingredientsHaveQuantities(ingredients: string): {
  ok: boolean;
  missing: string[];
} {
  const lines = parseIngredientLines(ingredients);
  if (!lines.length) return { ok: false, missing: ["(no ingredients)"] };

  const missing = lines.filter((line) => !ingredientLineHasQuantity(line));
  return { ok: missing.length === 0, missing };
}

/** Assign a reasonable default quantity to a flyer product name. */
export function quantifyFlyerItem(item: string): string {
  const lower = item.toLowerCase();
  if (/^(salt|pepper|black pepper)/.test(lower)) return `${item} to taste`;
  if (/butter|oil|sauce|dressing|mustard|vinegar|honey|syrup|paste|mayonnaise|ketchup/.test(lower)) {
    return `2 tbsp ${item}`;
  }
  if (/milk|cream|broth|stock|yogurt|juice/.test(lower)) return `1 cup ${item}`;
  if (/chicken|beef|pork|fish|salmon|shrimp|turkey|sausage|bacon|steak|ground/.test(lower)) {
    return `1 lb ${item}`;
  }
  if (/banana|apple|orange|lemon|lime|potato|tomato|avocado|egg/.test(lower)) {
    return `2 ${item}`;
  }
  if (/rice|pasta|noodle|quinoa|oats|flour|sugar|cheese|bread/.test(lower)) {
    return `8 oz ${item}`;
  }
  if (/garlic|onion|shallot/.test(lower)) return `1 ${item}`;
  if (/herb|parsley|cilantro|basil|spinach|lettuce|greens/.test(lower)) {
    return `1 bunch ${item}`;
  }
  return `1 package ${item}`;
}

/** Add a default amount when a line has no quantity. */
export function quantifyIngredientLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return trimmed;
  if (ingredientLineHasQuantity(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (/\b(salt|pepper)\b/.test(lower) && !/\bto taste\b/.test(lower)) {
    return `${trimmed} to taste`;
  }
  if (/\b(oil|butter|vinegar|sauce|honey|mustard|mayonnaise|ketchup|dressing|paste|syrup)\b/.test(lower)) {
    return `2 tbsp ${trimmed}`;
  }
  if (/\b(milk|cream|broth|stock|water|juice|yogurt)\b/.test(lower)) {
    return `1 cup ${trimmed}`;
  }
  if (/\b(garlic|onion|shallot)\b/.test(lower)) return `1 ${trimmed}`;
  if (/\b(egg|eggs)\b/.test(lower)) return `2 ${trimmed}`;
  if (/\b(chicken|beef|pork|fish|salmon|shrimp|turkey|sausage|bacon|steak)\b/.test(lower)) {
    return `1 lb ${trimmed}`;
  }
  if (/\b(rice|pasta|noodle|flour|sugar|cheese|bread|oats|quinoa)\b/.test(lower)) {
    return `1 cup ${trimmed}`;
  }
  if (/\b(berry|berries|banana|apple|tomato|potato|lemon|lime|avocado)\b/.test(lower)) {
    return `2 ${trimmed}`;
  }
  if (/\b(herb|parsley|cilantro|basil|spinach|lettuce|greens)\b/.test(lower)) {
    return `1 bunch ${trimmed}`;
  }

  return quantifyFlyerItem(trimmed);
}

/** Guarantee every ingredient line has a quantity (deterministic, no LLM). */
export function ensureIngredientQuantities(ingredients: string): string {
  const normalized = normalizeIngredientsFormat(ingredients);
  return normalized
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (!isIngredientLine(trimmed)) return trimmed;
      return quantifyIngredientLine(trimmed);
    })
    .filter(Boolean)
    .join("\n");
}

export function ensureRecipeQuantities(recipe: Recipe): Recipe {
  return {
    ...recipe,
    Ingredients: ensureIngredientQuantities(recipe.Ingredients),
  };
}

/** Prompt snippet shared by generator agents. */
export const INGREDIENT_QUANTITY_RULES = `Every ingredient line MUST include a quantity and unit before the ingredient name.
Format: "<amount> <unit> <ingredient>" (examples: "2 cups rice", "1 lb chicken breast", "1 tbsp olive oil", "1/2 tsp salt").
Use US measurements (cup, tbsp, tsp, oz, lb). Only use "to taste" for salt, pepper, or optional garnish.
Never list bare ingredient names without amounts.`;

export const QUANTIFIED_PANTRY_LINES = [
  "2 tbsp olive oil",
  "2 cloves garlic, minced",
  "1 medium onion, diced",
  "1/2 tsp salt",
  "1/4 tsp black pepper",
  "1 tbsp lemon juice",
  "1/4 cup fresh herbs, chopped",
  "1 tbsp soy sauce",
  "1/4 tsp chili flakes",
  "2 tbsp butter",
  "1 cup chicken stock",
] as const;
