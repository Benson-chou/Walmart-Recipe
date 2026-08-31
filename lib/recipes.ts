import type { Recipe } from "@/lib/types";

const BASES = [
  {
    name: (items: string[]) => `One-Pan ${items[0]} Skillet`,
    method: "skillet",
  },
  {
    name: (items: string[]) => `${items[0]} & ${items[1] ?? "Garden"} Bowl`,
    method: "bowl",
  },
  {
    name: (items: string[]) => `Weeknight ${items[0]} Bake`,
    method: "bake",
  },
];

function pickExtras(creativity: number): string[] {
  const extras = [
    "olive oil",
    "garlic",
    "onion",
    "salt & pepper",
    "lemon juice",
    "fresh herbs",
    "soy sauce",
    "chili flakes",
    "butter",
    "stock or broth",
  ];
  const count = Math.min(extras.length, 3 + Math.floor(creativity / 3));
  return extras.slice(0, count);
}

function buildInstructions(method: string, items: string[]): string {
  if (method === "bowl") {
    return [
      `1. Prep ${items.join(", ")} into bite-sized pieces.`,
      "2. Warm a base grain or greens in a bowl.",
      "3. Quickly cook proteins/veg until tender.",
      "4. Assemble, dress lightly, and serve warm.",
    ].join("\n");
  }
  if (method === "bake") {
    return [
      `1. Heat oven to 400°F and toss ${items.slice(0, 2).join(" and ")} with oil and seasoning.`,
      "2. Spread on a sheet pan in a single layer.",
      "3. Roast 18–25 minutes until browned and cooked through.",
      "4. Rest briefly, then plate with any remaining ingredients.",
    ].join("\n");
  }
  return [
    `1. Heat a large skillet over medium and add a splash of oil.`,
    `2. Cook ${items[0]} until nearly done, then add ${items.slice(1, 3).join(", ") || "remaining items"}.`,
    "3. Season to taste and simmer a few minutes so flavors meld.",
    "4. Finish with herbs or acid, then serve immediately.",
  ].join("\n");
}

/** Local mock generator used until Gemini is wired. */
export function generateMockRecipes(input: {
  items: string[];
  budget: number;
  allergies: string;
  creativity: number;
}): Recipe[] {
  const items = input.items.length ? input.items : ["seasonal vegetables"];
  const count = Math.min(3, Math.max(1, 1 + Math.floor(input.creativity / 5)));
  const allergyNote =
    input.allergies && input.allergies.toLowerCase() !== "none"
      ? `\n(Avoid: ${input.allergies})`
      : "";

  return BASES.slice(0, count).map((base, index) => {
    const rotated = [...items.slice(index), ...items.slice(0, index)];
    const extras = pickExtras(input.creativity + index);
    const ingredients = [
      ...rotated.map((item) => item),
      ...extras,
      `Stay near CAD $${input.budget.toFixed(2)} total`,
    ].join("\n");

    return {
      Recipe_name: base.name(rotated),
      Ingredients: ingredients + allergyNote,
      Instructions: buildInstructions(base.method, rotated),
    };
  });
}

export async function generateRecipes(input: {
  items: string[];
  budget: number;
  allergies: string;
  creativity: number;
}): Promise<Recipe[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return generateMockRecipes(input);
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const googleAI = new GoogleGenerativeAI(key);
    const model = googleAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: input.creativity / 10,
        maxOutputTokens: 4096,
      },
    });

    const prompt = `Recommend 1-3 recipes using ${input.items.join(", ")} with a budget of ${input.budget} CAD and avoid these allergies: ${input.allergies}.
You do not have to include every ingredient in every recipe.
Label each instruction step with 1., 2., 3., etc.
Output ONLY JSON array of objects with keys Recipe_name, Ingredients, Instructions.
Ingredients and Instructions should each be one long string with items/steps separated by newline characters.`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const recipes = JSON.parse(text) as Recipe[];
    if (!Array.isArray(recipes) || recipes.length === 0) {
      return generateMockRecipes(input);
    }
    return recipes;
  } catch {
    return generateMockRecipes(input);
  }
}
