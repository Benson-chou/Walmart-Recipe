export type CookingTierId = "edible" | "simple" | "elevated" | "surprise";

export type CookingTier = {
  id: CookingTierId;
  label: string;
  subtitle: string;
  icon: string;
  /** Temperature used for model generation (0.0 - 1.0) */
  temperature: number;
  /** Equivalent 0-10 numeric score */
  creativityScore: number;
  /** Instruction injected into LLM prompt */
  promptGuidance: string;
};

export const COOKING_TIERS: CookingTier[] = [
  {
    id: "edible",
    label: "Just make it edible",
    subtitle: "Bare-minimum effort, 1 pan, foolproof and fast.",
    icon: "🍳",
    temperature: 0.2,
    creativityScore: 2,
    promptGuidance:
      "VIBE: 'Just make it edible'. Prioritize extreme simplicity, minimal prep time, foolproof steps, and basic techniques with standard pantry items. Do not get fancy or use complicated culinary steps.",
  },
  {
    id: "simple",
    label: "Keep it simple & classic for a dummy",
    subtitle: "No chef ego. Familiar comfort food and reliable steps.",
    icon: "🍲",
    temperature: 0.45,
    creativityScore: 5,
    promptGuidance:
      "VIBE: 'Keep it simple and classic for a dummy'. Focus on beloved, familiar home-cooking classics with straightforward, dependable steps and comforting flavor pairings. Make instructions clear and beginner-friendly.",
  },
  {
    id: "elevated",
    label: "A little chef's twist",
    subtitle: "Elevated weeknight dining with restaurant flair.",
    icon: "✨",
    temperature: 0.75,
    creativityScore: 7,
    promptGuidance:
      "VIBE: 'A little chef's twist'. Elevate the meal with thoughtful techniques, pan sauces, and balanced restaurant-style flair while keeping it practical.",
  },
  {
    id: "surprise",
    label: "Surprise me with something new",
    subtitle: "Bold combinations, inventive fusion, unique concepts.",
    icon: "🔮",
    temperature: 0.95,
    creativityScore: 10,
    promptGuidance:
      "VIBE: 'Surprise me with something new'. Be daring, inventive, and creative with unexpected flavor pairings, modern fusion, and unique culinary twists while ensuring the recipe remains delicious and edible.",
  },
];

export const DEFAULT_COOKING_TIER: CookingTierId = "simple";

export function getCookingTier(idOrScore?: string | number | null): CookingTier {
  if (typeof idOrScore === "string") {
    const found = COOKING_TIERS.find((t) => t.id === idOrScore);
    if (found) return found;
  }
  if (typeof idOrScore === "number") {
    if (idOrScore <= 3) return COOKING_TIERS[0];
    if (idOrScore <= 6) return COOKING_TIERS[1];
    if (idOrScore <= 8) return COOKING_TIERS[2];
    return COOKING_TIERS[3];
  }
  return COOKING_TIERS[1]; // default to "simple"
}
