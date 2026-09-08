/**
 * Seed recipe corpus into Supabase with embeddings.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-recipes.ts
 *   npx tsx --env-file=.env.local scripts/seed-recipes.ts --parquet data/recipes.parquet --limit 2000
 *   npx tsx --env-file=.env.local scripts/seed-recipes.ts --csv data/RAW_recipes.csv --limit 2000
 *
 * Without --csv/--parquet, loads data/seed-recipes.json (or Gemini bootstrap).
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";

const EMBEDDING_DIM = 768;

function l2Normalize(vec: number[]) {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function mockEmbed(text: string) {
  const vec = new Array(EMBEDDING_DIM).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % EMBEDDING_DIM] += (text.charCodeAt(i) % 31) / 31;
  }
  return l2Normalize(vec);
}

async function embedText(text: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return mockEmbed(text);
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const { GEMINI_EMBED_MODEL } = await import("../lib/gemini");
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: GEMINI_EMBED_MODEL });
    const result = await model.embedContent({
      content: { role: "user", parts: [{ text: text.slice(0, 8000) }] },
      outputDimensionality: EMBEDDING_DIM,
    } as Parameters<typeof model.embedContent>[0]);
    return l2Normalize(result.embedding.values);
  } catch (error) {
    console.error("embed failed, mock:", error);
    return mockEmbed(text);
  }
}

function extractAllergens(text: string) {
  const lower = text.toLowerCase();
  const out: string[] = [];
  const map: Array<[string, string[]]> = [
    ["Dairy", ["milk", "cheese", "butter", "cream", "yogurt"]],
    ["Eggs", ["egg"]],
    ["Peanuts", ["peanut"]],
    ["Tree nuts", ["almond", "walnut", "cashew", "pecan"]],
    ["Shellfish", ["shrimp", "crab", "lobster"]],
    ["Fish", ["salmon", "tuna", "cod", " fish"]],
    ["Soy", ["soy", "tofu"]],
    ["Wheat / gluten", ["wheat", "flour", "bread", "pasta"]],
    ["Sesame", ["sesame", "tahini"]],
  ];
  for (const [label, keys] of map) {
    if (keys.some((k) => lower.includes(k))) out.push(label);
  }
  return out;
}

type SeedRecipe = {
  recipe_name: string;
  ingredients: string;
  description: string;
  source: string;
  tags: string[];
};

async function bootstrapWithGemini(): Promise<SeedRecipe[]> {
  const baskets = [
    ["chicken breast", "broccoli", "rice"],
    ["salmon", "asparagus", "lemon"],
    ["ground beef", "tomato", "pasta"],
    ["tofu", "spinach", "soy sauce"],
    ["eggs", "cheddar", "bread"],
    ["shrimp", "garlic", "rice"],
    ["pork chops", "apple", "onion"],
    ["chickpeas", "cucumber", "yogurt"],
  ];

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return baskets.map((items, i) => ({
      recipe_name: `Weeknight ${items[0]} Bowl ${i + 1}`,
      ingredients: items.join("\n") + "\nolive oil\nsalt & pepper",
      description:
        "1. Prep ingredients.\n2. Cook protein.\n3. Add vegetables.\n4. Season and serve.",
      source: "seed",
      tags: items,
    }));
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const { GEMINI_CHAT_MODEL, GEMINI_EMBED_MODEL } = await import("../lib/gemini");
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: GEMINI_CHAT_MODEL,
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
  });

  const prompt = `Generate exactly 40 diverse weeknight grocery recipes suitable for Canadian supermarket flyer cooking.
Use common ingredients (chicken, beef, salmon, tofu, eggs, pasta, rice, vegetables, dairy alternatives).
Output ONLY a JSON array of 40 objects with keys:
Recipe_name, Ingredients (newline-separated string), Instructions (numbered newline-separated string), tags (string array of 3-6 ingredient tags).`;

  const result = await model.generateContent(prompt);
  let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(text) as Array<Record<string, unknown>>;
  return parsed.slice(0, 40).map((row) => ({
    recipe_name: String(row.Recipe_name ?? row.recipe_name ?? "Untitled"),
    ingredients: String(row.Ingredients ?? row.ingredients ?? ""),
    description: String(row.Instructions ?? row.description ?? ""),
    source: "seed",
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  }));
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function normalizeIngredients(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join("\n");
  }

  let text = String(value).trim();
  if (!text) return "";

  if ((text.startsWith("c(") || text.startsWith("[")) && (text.endsWith(")") || text.endsWith("]"))) {
    // R-style c("a", "b") or JSON/python list
    const inner = text.startsWith("c(") ? text.slice(2, -1) : text.slice(1, -1);
    const parts = inner
      .split(",")
      .map((part) => part.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    if (parts.length > 1) return parts.join("\n");
  }

  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const arr = JSON.parse(text.replace(/'/g, '"'));
      if (Array.isArray(arr)) return normalizeIngredients(arr);
    } catch {
      /* keep raw */
    }
  }
  return text;
}

function normalizeInstructions(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .map((item, idx) => {
        const text = String(item).trim();
        if (!text) return "";
        return /^\d+[\.)]/.test(text) ? text : `${idx + 1}. ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  let text = String(value).trim();
  if (!text) return "";

  if ((text.startsWith("c(") || text.startsWith("[")) && (text.endsWith(")") || text.endsWith("]"))) {
    const inner = text.startsWith("c(") ? text.slice(2, -1) : text.slice(1, -1);
    const parts = inner
      .split(",")
      .map((part) => part.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    if (parts.length > 1) return normalizeInstructions(parts);
  }

  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const arr = JSON.parse(text.replace(/'/g, '"'));
      if (Array.isArray(arr)) return normalizeInstructions(arr);
    } catch {
      /* keep raw */
    }
  }

  // Food.com often joins steps as: "Do thing.,Do next thing.,Finish."
  const foodComSteps = text
    .split(/\.,\s*/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
  if (foodComSteps.length > 1) {
    return foodComSteps
      .map((step, idx) => `${idx + 1}. ${step}.`)
      .join("\n");
  }

  if (!/^\d+[\.)]/.test(text.split("\n")[0] ?? "")) {
    return `1. ${text}`;
  }
  return text;
}

function normalizeTags(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith("c(") || text.startsWith("[")) {
    return normalizeIngredients(text).split("\n").filter(Boolean);
  }
  return text.split(/[,|]/).map((t) => t.trim()).filter(Boolean);
}

function getField(row: Record<string, unknown>, ...names: string[]) {
  const lookup = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]));
  for (const name of names) {
    const key = lookup.get(name.toLowerCase());
    if (key != null && row[key] != null && String(row[key]).trim()) return row[key];
  }
  return null;
}

function rowToSeedRecipe(row: Record<string, unknown>, source: string): SeedRecipe | null {
  // Prefer Food.com / Kaggle recipe schema columns when present
  const nameRaw =
    getField(row, "Name", "Title", "recipe_name", "name") ??
    Object.entries(row).find(([k]) => /^name$/i.test(k) || /title/i.test(k))?.[1];

  // CRITICAL: use Parts (names), never Quantities alone
  const partsRaw = getField(row, "RecipeIngredientParts", "ingredients", "Ingredients");
  const qtyRaw = getField(row, "RecipeIngredientQuantities");

  const stepsRaw =
    getField(row, "RecipeInstructions", "Instructions", "Steps", "Directions") ??
    Object.entries(row).find(
      ([k]) => /instruction|steps?|directions/i.test(k) && !/^description$/i.test(k)
    )?.[1];

  const blurb = getField(row, "Description");
  const category = getField(row, "RecipeCategory", "Category");
  const keywords = getField(row, "Keywords", "tags", "Tags");

  const name = nameRaw != null ? String(nameRaw).trim() : "";

  const parts = normalizeIngredients(partsRaw)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const qtys = normalizeIngredients(qtyRaw)
    .split("\n")
    .map((s) => s.trim());

  // Zip quantity + ingredient name when both exist
  let ingredients = "";
  if (parts.length) {
    ingredients = parts
      .map((part, i) => {
        const qty = qtys[i];
        if (qty && !/^null$/i.test(qty) && qty !== "NA") return `${qty} ${part}`;
        return part;
      })
      .join("\n");
  } else {
    // last-resort generic ingredient column, still exclude quantity-only fields
    const fallback = Object.entries(row).find(
      ([k]) => /ingredient/i.test(k) && !/quantit/i.test(k)
    )?.[1];
    ingredients = normalizeIngredients(fallback);
  }

  let description = normalizeInstructions(stepsRaw);
  if (!description && blurb) {
    description = `1. ${String(blurb).trim()}`;
  }

  // Reject quantity-only garbage (digits/fractions with almost no words)
  const ingredientLines = ingredients.split("\n").filter(Boolean);
  const wordy = ingredientLines.filter((l) => /[a-zA-Z]{3,}/.test(l)).length;
  if (!name || wordy < 2) return null;

  const tags = [...normalizeTags(category), ...normalizeTags(keywords)].slice(0, 12);
  if (blurb) {
    const short = String(blurb).trim().slice(0, 180);
    if (short) tags.push(`blurb:${short}`);
  }

  return {
    recipe_name: name.slice(0, 180),
    ingredients,
    description: description || "1. Prepare ingredients.\n2. Cook as directed.\n3. Serve.",
    source,
    tags,
  };
}

function loadFoodComCsv(path: string, limit: number): SeedRecipe[] {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, ""));

  const recipes: SeedRecipe[] = [];
  for (let i = 1; i < lines.length && recipes.length < limit; i++) {
    const cols = parseCsvLine(lines[i]).map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"'));
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      row[header] = cols[idx];
    });
    const recipe = rowToSeedRecipe(row, "foodcom");
    if (recipe) recipes.push(recipe);
  }
  return recipes;
}

async function loadParquet(path: string, limit: number): Promise<SeedRecipe[]> {
  const buffer = readFileSync(path);
  const file = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const rows = (await parquetReadObjects({ file, compressors })) as Record<
    string,
    unknown
  >[];
  console.log(`  Parquet rows available: ${rows.length}; importing up to ${limit}`);

  const recipes: SeedRecipe[] = [];
  for (const row of rows) {
    if (recipes.length >= limit) break;
    const recipe = rowToSeedRecipe(row, "foodcom");
    if (recipe) recipes.push(recipe);
  }

  if (!recipes.length && rows[0]) {
    console.log("  Could not map columns. First row keys:", Object.keys(rows[0]).join(", "));
  }
  return recipes;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  const args = process.argv.slice(2);
  const csvIdx = args.indexOf("--csv");
  const parquetIdx = args.indexOf("--parquet");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 2000 : 2000;
  const csvPath = csvIdx >= 0 ? resolve(args[csvIdx + 1]) : null;
  const parquetPath = parquetIdx >= 0 ? resolve(args[parquetIdx + 1]) : null;

  let recipes: SeedRecipe[];
  if (parquetPath) {
    if (!existsSync(parquetPath)) throw new Error(`Parquet not found: ${parquetPath}`);
    console.log(`Loading recipes from parquet ${parquetPath} (limit ${limit})...`);
    recipes = await loadParquet(parquetPath, limit);
  } else if (csvPath) {
    if (!existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);
    console.log(`Loading Food.com CSV from ${csvPath} (limit ${limit})...`);
    recipes = loadFoodComCsv(csvPath, limit);
  } else {
    const autoParquet = [
      resolve("data/recipes.parquet"),
      resolve("data/RAW_recipes.parquet"),
      resolve("data/foodcom.parquet"),
    ].find((p) => existsSync(p));

    if (autoParquet) {
      console.log(`Auto-detected parquet ${autoParquet} (limit ${limit})...`);
      recipes = await loadParquet(autoParquet, limit);
    } else {
      const localSeed = resolve("data/seed-recipes.json");
      if (existsSync(localSeed)) {
        console.log(`Loading local seed recipes from ${localSeed}...`);
        const rows = JSON.parse(readFileSync(localSeed, "utf8")) as Array<Record<string, unknown>>;
        recipes = rows.map((row) => ({
          recipe_name: String(row.recipe_name),
          ingredients: String(row.ingredients),
          description: String(row.description),
          source: "seed",
          tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
        }));
      } else {
        console.log("Bootstrapping seed recipes via Gemini/mock...");
        try {
          recipes = await bootstrapWithGemini();
        } catch (error) {
          console.error("Gemini bootstrap failed:", error);
          recipes = [
            {
              recipe_name: "Simple Chicken Rice Bowl",
              ingredients: "chicken breast\nrice\nbroccoli\nsoy sauce",
              description:
                "1. Cook rice.\n2. Cook chicken.\n3. Steam broccoli.\n4. Combine with soy sauce.",
              source: "seed",
              tags: ["chicken", "rice"],
            },
          ];
        }
      }
    }
  }

  console.log(`Embedding and upserting ${recipes.length} recipes...`);
  const ws = (await import("ws")).default;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });

  let ok = 0;
  for (const recipe of recipes) {
    if (!recipe.recipe_name || !recipe.ingredients) continue;
    const embedding = await embedText(
      [
        recipe.recipe_name,
        recipe.ingredients,
        recipe.description,
        recipe.tags.filter((t) => !t.startsWith("blurb:")).join(", "),
        recipe.tags.find((t) => t.startsWith("blurb:"))?.replace(/^blurb:/, "") ?? "",
      ]
        .filter(Boolean)
        .join("\n")
    );
    const allergens = extractAllergens(`${recipe.ingredients}\n${recipe.description}`);
    const tags = recipe.tags.filter((t) => !t.startsWith("blurb:")).slice(0, 12);

    // idempotent-ish: skip exact name duplicates
    const { data: existing } = await admin
      .from("recipes")
      .select("id")
      .eq("recipe_name", recipe.recipe_name)
      .maybeSingle();

    if (existing) {
      await admin
        .from("recipes")
        .update({
          ingredients: recipe.ingredients,
          description: recipe.description,
          source: recipe.source,
          tags,
          allergens,
          embedding,
        })
        .eq("id", existing.id);
    } else {
      const { error } = await admin.from("recipes").insert({
        recipe_name: recipe.recipe_name,
        ingredients: recipe.ingredients,
        description: recipe.description,
        source: recipe.source,
        tags,
        allergens,
        embedding,
      });
      if (error) {
        console.error("insert failed", recipe.recipe_name, error.message);
        continue;
      }
    }
    ok += 1;
    if (ok % 10 === 0) console.log(`  ${ok}/${recipes.length}`);
  }

  console.log(`Done. Upserted ${ok} recipes.`);
  // keep hash util available for future dedupe keys
  void createHash;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
