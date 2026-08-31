export const ALLERGEN_OPTIONS = [
  "Dairy",
  "Eggs",
  "Peanuts",
  "Tree nuts",
  "Shellfish",
  "Fish",
  "Soy",
  "Wheat / gluten",
  "Sesame",
  "Mustard",
  "Sulphites",
] as const;

export type AllergenOption = (typeof ALLERGEN_OPTIONS)[number];

const KNOWN = new Set<string>(ALLERGEN_OPTIONS);

export function isKnownAllergen(value: string) {
  return KNOWN.has(value);
}

export function splitAllergies(selected: string[]) {
  const known = selected.filter((item) => isKnownAllergen(item));
  const custom = selected.filter((item) => !isKnownAllergen(item));
  return { known, custom };
}

/** Parse stored profile/API string into selected option labels. */
export function parseAllergies(value: string | null | undefined): string[] {
  if (!value) return [];
  const normalized = value.trim();
  if (!normalized || /^none$/i.test(normalized)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of normalized.split(/[,;|]/).map((item) => item.trim()).filter(Boolean)) {
    const match = ALLERGEN_OPTIONS.find(
      (option) => option.toLowerCase() === part.toLowerCase()
    );
    const label = match ?? part;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }

  return result;
}

/** Serialize selections for DB / recipe API. */
export function formatAllergies(selected: string[]): string {
  if (!selected.length) return "None";
  return selected.join(", ");
}
