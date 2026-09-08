import { parseAllergies } from "@/lib/allergies";

export function allergiesToFilterList(allergies: string): string[] {
  return parseAllergies(allergies);
}

export function extractAllergensFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const checks: Array<[string, string[]]> = [
    ["Dairy", ["milk", "cheese", "butter", "cream", "yogurt", "dairy"]],
    ["Eggs", ["egg", "eggs"]],
    ["Peanuts", ["peanut", "peanuts"]],
    ["Tree nuts", ["almond", "walnut", "cashew", "pecan", "hazelnut", "pistachio"]],
    ["Shellfish", ["shrimp", "crab", "lobster", "shellfish"]],
    ["Fish", ["salmon", "tuna", "cod", "fish"]],
    ["Soy", ["soy", "tofu", "edamame"]],
    ["Wheat / gluten", ["wheat", "flour", "bread", "pasta", "gluten"]],
    ["Sesame", ["sesame", "tahini"]],
    ["Mustard", ["mustard"]],
    ["Sulphites", ["sulphite", "sulfite"]],
  ];

  for (const [label, keywords] of checks) {
    if (keywords.some((k) => lower.includes(k))) found.push(label);
  }
  return found;
}

/** True when free text (item name, ingredients, etc.) matches any listed allergy. */
export function textMatchesAllergies(text: string, allergies: string[]): boolean {
  if (!allergies.length) return false;
  const lower = text.toLowerCase();
  const detected = extractAllergensFromText(text);

  for (const allergy of allergies) {
    const normalized = allergy.trim().toLowerCase();
    if (!normalized || normalized === "none") continue;

    if (
      detected.some(
        (d) =>
          d.toLowerCase() === normalized ||
          d.toLowerCase().includes(normalized) ||
          normalized.includes(d.toLowerCase())
      )
    ) {
      return true;
    }

    // Custom allergies (not in the canonical keyword map)
    if (normalized.length > 2 && lower.includes(normalized)) return true;
  }

  return false;
}

export function filterItemsByAllergies(items: string[], allergies: string): string[] {
  const list = allergiesToFilterList(allergies);
  if (!list.length) return items;
  return items.filter((item) => !textMatchesAllergies(item, list));
}

export function recipeConflictsWithAllergies(
  recipe: { Ingredients: string; Instructions?: string },
  allergies: string
): boolean {
  const blob = `${recipe.Ingredients}\n${recipe.Instructions ?? ""}`;
  return textMatchesAllergies(blob, allergiesToFilterList(allergies));
}

export function flyerOverlapScore(ingredients: string, selectedItems: string[]): number {
  if (!selectedItems.length) return 0;
  const lower = ingredients.toLowerCase();
  let hits = 0;
  for (const item of selectedItems) {
    const tokens = item.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    if (tokens.some((t) => lower.includes(t)) || lower.includes(item.toLowerCase())) {
      hits += 1;
    }
  }
  return hits / selectedItems.length;
}
