import {
  CATEGORY_INFO,
  categorizeGroceryItem,
  type GroceryCategory,
} from "@/lib/grocery-categories";
import { parseIngredientLines } from "@/lib/ingredients";
import type { FlyerItem, Recipe } from "@/lib/types";

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const UNICODE_FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join("");

const PREP_NOISE =
  /\b(chopped|diced|minced|sliced|crushed|grated|peeled|seeded|melted|softened|divided|packed|sifted|drained|rinsed|thawed|room temperature|thinly|roughly|coarsely|finely|freshly|optional|for serving|to serve|plus more|and more)\b/gi;

const SIZE_NOISE =
  /\b(extra[- ]large|x-large|xl|large|medium|small|baby)\b/gi;

const QUALITY_NOISE =
  /\b(organic|fresh|dried|frozen|canned|unsalted|salted|low[- ]fat|fat[- ]free|reduced[- ]sodium|low[- ]sodium|boneless|skinless|lean|extra virgin|virgin)\b/gi;

const UNCOUNTABLE = new Set([
  "rice",
  "pasta",
  "salt",
  "pepper",
  "oil",
  "water",
  "flour",
  "sugar",
  "milk",
  "butter",
  "cheese",
  "garlic",
  "ginger",
  "juice",
  "sauce",
  "vinegar",
  "broth",
  "stock",
  "couscous",
  "molasses",
  "asparagus",
  "hummus",
]);

const TYPE_SPECIFIERS = new Set([
  "stock",
  "broth",
  "bouillon",
  "sauce",
  "dressing",
  "paste",
  "juice",
  "milk",
  "cream",
  "yogurt",
  "oil",
  "vinegar",
  "cheese",
  "breast",
  "thigh",
  "wing",
  "wings",
  "ground",
  "fillet",
  "fillets",
  "chop",
  "chops",
  "bell",
  "black",
  "white",
  "cayenne",
  "chili",
  "chilli",
  "coconut",
  "sesame",
  "olive",
  "vegetable",
  "canola",
  "soy",
  "fish",
  "oyster",
  "hot",
  "bbq",
  "barbecue",
  "brown",
  "powdered",
  "powder",
  "green",
  "red",
  "yellow",
  "cheddar",
  "parmesan",
  "mozzarella",
  "feta",
]);

const PROTEIN_CUTS = new Set([
  "breast",
  "thigh",
  "wing",
  "wings",
  "drumstick",
  "drumsticks",
  "fillet",
  "fillets",
  "ground",
  "chop",
  "chops",
  "steak",
]);

const VARIANT_SPECIFIERS = new Set([
  ...PROTEIN_CUTS,
  "green",
  "red",
  "yellow",
  "white",
  "black",
]);

const STOCK_WORDS = new Set(["stock", "broth", "bouillon"]);

const TYPE_SYNONYMS: Record<string, string> = {
  broth: "stock",
  bouillon: "stock",
  chilli: "chili",
  barbecue: "bbq",
  fillets: "fillet",
  wings: "wing",
  chops: "chop",
};

const UNIT_ALIASES: Record<string, string> = {
  cup: "cup",
  cups: "cup",
  c: "cup",
  tbsp: "tbsp",
  tbs: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  "fl oz": "floz",
  floz: "floz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  clove: "clove",
  cloves: "clove",
  slice: "slice",
  slices: "slice",
  can: "can",
  cans: "can",
  bunch: "bunch",
  bunches: "bunch",
  head: "head",
  heads: "head",
  piece: "piece",
  pieces: "piece",
  package: "package",
  packages: "package",
  pkg: "package",
  bag: "bag",
  bags: "bag",
  stick: "stick",
  sticks: "stick",
  sprig: "sprig",
  sprigs: "sprig",
  fillet: "fillet",
  fillets: "fillet",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  handful: "handful",
  dozen: "dozen",
  quart: "quart",
  pint: "pint",
  packet: "packet",
  packets: "packet",
};

const UNIT_PATTERN = Object.keys(UNIT_ALIASES)
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/\s+/g, "\\s+"))
  .join("|");

const UNIT_RE = new RegExp(`^(${UNIT_PATTERN})\\b`, "i");

const AISLE_ORDER: GroceryCategory[] = [
  "produce",
  "meat-seafood",
  "dairy-eggs",
  "pantry",
  "drinks",
];

export const PANTRY_STAPLES = [
  "salt",
  "black pepper",
  "water",
  "olive oil",
  "vegetable oil",
  "canola oil",
] as const;

const PANTRY_COVERS: Record<string, string[]> = {
  salt: ["salt", "kosher salt", "sea salt", "table salt"],
  "black pepper": [
    "pepper",
    "black pepper",
    "ground pepper",
    "ground black pepper",
  ],
  water: ["water", "warm water", "cold water", "hot water", "ice water"],
  "olive oil": ["olive oil", "extra virgin olive oil", "evoo"],
  "vegetable oil": [
    "vegetable oil",
    "canola oil",
    "cooking oil",
    "neutral oil",
    "sunflower oil",
  ],
  "canola oil": ["canola oil", "vegetable oil", "cooking oil", "neutral oil"],
};

export type ParsedIngredient = {
  raw: string;
  quantity: number | null;
  unit: string | null;
  name: string;
  displayName: string;
};

export type ShoppingListItem = {
  key: string;
  name: string;
  display: string;
  quantity: number | null;
  unit: string | null;
  recipes: string[];
  category: GroceryCategory;
  status: "have" | "buy";
  matchedHave?: string;
  deal?: Pick<FlyerItem, "item_name" | "price" | "sale_story">;
};

export type ShoppingListGroup = {
  category: GroceryCategory;
  label: string;
  icon: string;
  items: ShoppingListItem[];
};

export type ShoppingList = {
  recipes: Array<{ name: string; ingredientCount: number }>;
  have: ShoppingListItem[];
  buy: ShoppingListItem[];
  buyByCategory: ShoppingListGroup[];
  estimatedDealTotal: number;
  unmatchedBuyCount: number;
};

export function recipePlanKey(recipe: Recipe) {
  return recipe.id ?? recipe.Recipe_name;
}

export function canonicalizeIngredientName(raw: string): string {
  let text = raw.toLowerCase().trim();
  const stripped = takeLeadingQuantity(text);
  const unitMatch = stripped.rest.match(UNIT_RE);
  if (stripped.quantity != null && unitMatch) {
    text = stripped.rest.slice(unitMatch[0].length).trim().replace(/^of\s+/i, "");
  }

  text = text.replace(/\([^)]*\)/g, " ");
  text = text.split(",")[0] ?? text;
  text = text.replace(PREP_NOISE, " ");
  text = text.replace(SIZE_NOISE, " ");
  text = text.replace(QUALITY_NOISE, " ");
  text = text.replace(/\bto taste\b/g, " ");
  text = text.replace(/\bas needed\b/g, " ");
  text = text.replace(/[^a-z0-9\s/-]/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return "";

  const tokens = text
    .split(" ")
    .map((token) => TYPE_SYNONYMS[token] ?? token)
    .map(singularize)
    .filter((t) => t.length > 1 || t === "oil");
  return tokens.join(" ").trim();
}

export function parseIngredientLine(line: string): ParsedIngredient | null {
  const raw = line.trim();
  if (!raw) return null;

  let rest = raw
    .replace(/^[-•*]\s*/, "")
    .replace(/^\d+[\.)]\s*/, "")
    .trim();

  const { quantity, rest: afterQty } = takeLeadingQuantity(rest);
  rest = afterQty;

  let unit: string | null = null;
  const unitMatch = rest.match(UNIT_RE);
  if (unitMatch) {
    unit = UNIT_ALIASES[unitMatch[1].toLowerCase().replace(/\s+/g, " ")] ?? null;
    rest = rest.slice(unitMatch[0].length).trim();
    rest = rest.replace(/^of\s+/i, "");
  }

  const name = canonicalizeIngredientName(rest);
  if (!name) return null;

  return {
    raw,
    quantity,
    unit,
    name,
    displayName: prettyDisplayName(name),
  };
}

export function ingredientsMatch(a: string, b: string): boolean {
  const na = canonicalizeIngredientName(a);
  const nb = canonicalizeIngredientName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const typesA = typeTokens(na);
  const typesB = typeTokens(nb);
  if (conflictsOnType(typesA, typesB)) return false;
  if (stockVsProteinConflict(na, nb)) return false;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 4 && hasWordSequence(longer, shorter)) {
    return !extraTypeConflict(shorter, longer);
  }

  const tokensA = significantTokens(na);
  const tokensB = significantTokens(nb);
  if (!tokensA.length || !tokensB.length) return false;

  const smaller = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const larger = tokensA.length <= tokensB.length ? tokensB : tokensA;
  const covered = smaller.every((t) => larger.includes(t));
  return covered && smaller.some((t) => t.length >= 4) && !extraTypeConflict(shorter, longer);
}

export function pantryCovers(haveName: string, needName: string): boolean {
  const have = canonicalizeIngredientName(haveName);
  const need = canonicalizeIngredientName(needName);
  const aliases = PANTRY_COVERS[have];
  if (!aliases) return ingredientsMatch(have, need);
  return aliases.some(
    (alias) =>
      canonicalizeIngredientName(alias) === need ||
      ingredientsMatch(alias, needName)
  );
}

export function buildShoppingList(input: {
  recipes: Recipe[];
  assumePantry?: boolean;
  flyerItems?: FlyerItem[];
}): ShoppingList {
  const recipes = input.recipes.filter((r) => r.Recipe_name && r.Ingredients);
  const haveNames =
    input.assumePantry !== false ? [...PANTRY_STAPLES] : [];

  const recipeSummaries = recipes.map((recipe) => {
    const parsed = parseIngredientLines(recipe.Ingredients)
      .map(parseIngredientLine)
      .filter((row): row is ParsedIngredient => Boolean(row));
    return { recipe, parsed };
  });

  const buckets = new Map<
    string,
    { name: string; lines: ParsedIngredient[]; recipes: Set<string> }
  >();

  for (const { recipe, parsed } of recipeSummaries) {
    for (const line of parsed) {
      const existing = buckets.get(line.name);
      if (existing) {
        existing.lines.push(line);
        existing.recipes.add(recipe.Recipe_name);
      } else {
        buckets.set(line.name, {
          name: line.name,
          lines: [line],
          recipes: new Set([recipe.Recipe_name]),
        });
      }
    }
  }

  const unusedHave = [...haveNames];
  const unusedDeals = [...(input.flyerItems ?? [])];
  const have: ShoppingListItem[] = [];
  const buy: ShoppingListItem[] = [];

  for (const bucket of buckets.values()) {
    const merged = mergeQuantities(bucket.lines);
    const category = categorizeGroceryItem(bucket.name);
    const base: ShoppingListItem = {
      key: bucket.name,
      name: bucket.name,
      display: merged.display,
      quantity: merged.quantity,
      unit: merged.unit,
      recipes: [...bucket.recipes],
      category,
      status: "buy",
    };

    const pantryHit = takeMatchingHave(unusedHave, bucket.name);
    if (pantryHit) {
      have.push({
        ...base,
        status: "have",
        matchedHave: pantryHit,
      });
      continue;
    }

    const dealIdx = unusedDeals.findIndex((deal) =>
      ingredientsMatch(bucket.name, deal.item_name)
    );
    if (dealIdx >= 0) {
      const [deal] = unusedDeals.splice(dealIdx, 1);
      buy.push({
        ...base,
        deal: {
          item_name: deal.item_name,
          price: deal.price,
          sale_story: deal.sale_story,
        },
      });
      continue;
    }

    buy.push(base);
  }

  have.sort(compareItems);
  buy.sort(compareItems);

  const buyByCategory = AISLE_ORDER.flatMap((category) => {
    const items = buy.filter((item) => item.category === category);
    if (!items.length) return [];
    return [
      {
        category,
        label: CATEGORY_INFO[category].label,
        icon: CATEGORY_INFO[category].icon,
        items,
      } satisfies ShoppingListGroup,
    ];
  });

  const leftover = buy.filter(
    (item) => !AISLE_ORDER.includes(item.category) || item.category === "all"
  );
  if (leftover.length) {
    buyByCategory.push({
      category: "pantry",
      label: CATEGORY_INFO.pantry.label,
      icon: CATEGORY_INFO.pantry.icon,
      items: leftover,
    });
  }

  const estimatedDealTotal = buy.reduce((sum, item) => {
    const price = item.deal?.price ?? 0;
    return price > 0 ? sum + price : sum;
  }, 0);

  return {
    recipes: recipeSummaries.map(({ recipe, parsed }) => ({
      name: recipe.Recipe_name,
      ingredientCount: parsed.length,
    })),
    have,
    buy,
    buyByCategory,
    estimatedDealTotal,
    unmatchedBuyCount: buy.filter((item) => !item.deal).length,
  };
}

export function formatShoppingListText(list: ShoppingList): string {
  if (list.buy.length === 0) {
    return "Pantry staples cover this plan — nothing extra to buy.";
  }

  return list.buy
    .map((item) => {
      const deal =
        item.deal && item.deal.price > 0
          ? `  (on sale: ${item.deal.item_name} $${item.deal.price.toFixed(2)})`
          : item.deal
            ? `  (on sale: ${item.deal.item_name})`
            : "";
      return `- ${item.display}${deal}`;
    })
    .join("\n");
}

function takeMatchingHave(haveNames: string[], needName: string): string | null {
  const pantryIdx = haveNames.findIndex((have) => pantryCovers(have, needName));
  if (pantryIdx >= 0) {
    const [hit] = haveNames.splice(pantryIdx, 1);
    return prettyHaveLabel(hit);
  }

  const idx = haveNames.findIndex((have) => ingredientsMatch(have, needName));
  if (idx < 0) return null;
  const [hit] = haveNames.splice(idx, 1);
  return hit;
}

function prettyHaveLabel(name: string) {
  if ((PANTRY_STAPLES as readonly string[]).includes(name)) {
    return `pantry · ${prettyDisplayName(name)}`;
  }
  return name;
}

function takeLeadingQuantity(input: string): { quantity: number | null; rest: string } {
  const text = input.trim();
  const mixed = text.match(
    new RegExp(
      `^(\\d+)\\s*([${UNICODE_FRACTION_CHARS}]|\\d+\\/\\d+)\\b`
    )
  );
  if (mixed) {
    const whole = Number(mixed[1]);
    const frac = parseFractionToken(mixed[2]);
    if (frac != null) {
      return {
        quantity: whole + frac,
        rest: text.slice(mixed[0].length).trim(),
      };
    }
  }

  const leading = text.match(
    new RegExp(`^([${UNICODE_FRACTION_CHARS}]|\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)\\b`)
  );
  if (leading) {
    const quantity = parseNumberToken(leading[1]);
    if (quantity != null) {
      return { quantity, rest: text.slice(leading[0].length).trim() };
    }
  }

  return { quantity: null, rest: text };
}

function parseNumberToken(token: string): number | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  if (UNICODE_FRACTIONS[trimmed] != null) return UNICODE_FRACTIONS[trimmed];

  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }
  const frac = trimmed.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);

  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function parseFractionToken(token: string): number | null {
  if (UNICODE_FRACTIONS[token] != null) return UNICODE_FRACTIONS[token];
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return null;
}

function singularize(word: string): string {
  if (UNCOUNTABLE.has(word)) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("sses")) return word;
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
}

function prettyDisplayName(name: string): string {
  return name.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function significantTokens(name: string): string[] {
  return name.split(/\s+/).filter((t) => t.length > 2);
}

function typeTokens(name: string): string[] {
  return name
    .split(/\s+/)
    .map((t) => TYPE_SYNONYMS[t] ?? t)
    .filter((t) => TYPE_SPECIFIERS.has(t));
}

function conflictsOnType(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const shared = a.filter((t) => b.includes(t));
  if (shared.length) return false;

  const aCuts = a.filter((t) => VARIANT_SPECIFIERS.has(t));
  const bCuts = b.filter((t) => VARIANT_SPECIFIERS.has(t));
  const aRest = a.filter((t) => !VARIANT_SPECIFIERS.has(t));
  const bRest = b.filter((t) => !VARIANT_SPECIFIERS.has(t));
  if (aCuts.length && bCuts.length && !aRest.length && !bRest.length) {
    return false;
  }
  return true;
}

function extraTypeConflict(shorter: string, longer: string): boolean {
  const shortTypes = typeTokens(shorter);
  const longTypes = typeTokens(longer);
  return longTypes.some(
    (token) => !shortTypes.includes(token) && !VARIANT_SPECIFIERS.has(token)
  );
}

function stockVsProteinConflict(a: string, b: string): boolean {
  const aStock = a.split(/\s+/).some((t) => STOCK_WORDS.has(t));
  const bStock = b.split(/\s+/).some((t) => STOCK_WORDS.has(t));
  return aStock !== bStock;
}

function hasWordSequence(haystack: string, needle: string): boolean {
  return new RegExp(`(?:^|\\s)${escapeRegExp(needle)}(?:\\s|$)`).test(haystack);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type UnitFamily = "volume" | "weight" | "count" | "other";

function unitFamily(unit: string | null): UnitFamily {
  if (!unit) return "count";
  if (["tsp", "tbsp", "cup", "floz", "ml", "l", "pint", "quart"].includes(unit)) {
    return "volume";
  }
  if (["oz", "lb", "g", "kg"].includes(unit)) return "weight";
  if (
    [
      "clove",
      "slice",
      "can",
      "bunch",
      "head",
      "piece",
      "package",
      "bag",
      "stick",
      "sprig",
      "fillet",
      "pinch",
      "dash",
      "handful",
      "dozen",
      "packet",
    ].includes(unit)
  ) {
    return "count";
  }
  return "other";
}

function toBase(quantity: number, unit: string | null): { family: UnitFamily; value: number; unit: string | null } {
  const family = unitFamily(unit);
  if (family === "volume") {
    const tsp =
      unit === "tsp"
        ? quantity
        : unit === "tbsp"
          ? quantity * 3
          : unit === "cup"
            ? quantity * 48
            : unit === "floz"
              ? quantity * 6
              : unit === "ml"
                ? quantity / 5
                : unit === "l"
                  ? (quantity * 1000) / 5
                  : unit === "pint"
                    ? quantity * 96
                    : unit === "quart"
                      ? quantity * 192
                      : quantity;
    return { family, value: tsp, unit: "tsp" };
  }
  if (family === "weight") {
    const oz =
      unit === "oz"
        ? quantity
        : unit === "lb"
          ? quantity * 16
          : unit === "g"
            ? quantity / 28.3495
            : unit === "kg"
              ? quantity * 35.274
              : quantity;
    return { family, value: oz, unit: "oz" };
  }
  return { family, value: quantity, unit };
}

function fromBase(value: number, family: UnitFamily, fallbackUnit: string | null): {
  quantity: number;
  unit: string | null;
} {
  if (family === "volume") {
    if (value >= 12) {
      return { quantity: roundNice(value / 48), unit: "cup" };
    }
    if (value >= 2.5) {
      return { quantity: roundNice(value / 3), unit: "tbsp" };
    }
    return { quantity: roundNice(value), unit: "tsp" };
  }
  if (family === "weight") {
    if (value >= 12) {
      return { quantity: roundNice(value / 16), unit: "lb" };
    }
    return { quantity: roundNice(value), unit: "oz" };
  }
  return { quantity: roundNice(value), unit: fallbackUnit };
}

function roundNice(value: number): number {
  const rounded = Math.round(value * 4) / 4;
  return Number(rounded.toFixed(2));
}

function mergeQuantities(lines: ParsedIngredient[]): {
  quantity: number | null;
  unit: string | null;
  display: string;
} {
  const displayName = lines[0]?.displayName ?? "";
  const measurable = lines.filter((line) => line.quantity != null);
  if (!measurable.length) {
    return { quantity: null, unit: null, display: displayName };
  }

  const converted = measurable.map((line) => ({
    line,
    ...toBase(line.quantity as number, line.unit),
  }));

  const families = new Set(converted.map((row) => row.family));
  if (families.size === 1) {
    const family = converted[0].family;
    const sum = converted.reduce((total, row) => total + row.value, 0);
    const { quantity, unit } = fromBase(sum, family, measurable[0].unit);
    return {
      quantity,
      unit,
      display: formatAmount(quantity, unit, displayName),
    };
  }

  const parts = converted.map((row) => {
    const { quantity, unit } = fromBase(row.value, row.family, row.line.unit);
    return formatAmount(quantity, unit, "").trim();
  });
  return {
    quantity: null,
    unit: null,
    display: `${parts.join(" + ")} ${displayName}`.trim(),
  };
}

function formatAmount(quantity: number | null, unit: string | null, name: string): string {
  if (quantity == null) return name;
  const pretty = formatNumber(quantity);
  if (!unit) return `${pretty} ${name}`.trim();
  const unitOut = quantity === 1 ? unit : pluralUnit(unit);
  return `${pretty} ${unitOut} ${name}`.trim();
}

function pluralUnit(unit: string): string {
  if (unit === "tsp" || unit === "tbsp" || unit === "oz" || unit === "lb" || unit === "ml" || unit === "g") {
    return unit;
  }
  if (unit === "cup") return "cups";
  if (unit === "clove") return "cloves";
  if (unit === "slice") return "slices";
  if (unit === "can") return "cans";
  if (unit === "bunch") return "bunches";
  if (unit === "head") return "heads";
  if (unit === "piece") return "pieces";
  if (unit === "package") return "packages";
  if (unit === "bag") return "bags";
  if (unit === "stick") return "sticks";
  if (unit === "sprig") return "sprigs";
  if (unit === "fillet") return "fillets";
  return `${unit}s`;
}

function formatNumber(value: number): string {
  const fractions: Array<[number, string]> = [
    [0.125, "⅛"],
    [0.25, "¼"],
    [0.333, "⅓"],
    [0.375, "⅜"],
    [0.5, "½"],
    [0.625, "⅝"],
    [0.666, "⅔"],
    [0.75, "¾"],
    [0.875, "⅞"],
  ];
  const whole = Math.floor(value + 1e-6);
  const frac = value - whole;
  if (Math.abs(frac) < 0.05) return String(whole || 0);
  for (const [amount, glyph] of fractions) {
    if (Math.abs(frac - amount) < 0.05) {
      return whole > 0 ? `${whole}${glyph}` : glyph;
    }
  }
  return Number(value.toFixed(2)).toString();
}

function compareItems(a: ShoppingListItem, b: ShoppingListItem) {
  return a.display.localeCompare(b.display);
}
