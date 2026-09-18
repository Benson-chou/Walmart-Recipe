import type { Recipe } from "@/lib/types";
import { recipePlanKey } from "@/lib/shopping-list";

const HANDOFF_KEY = "walmart-recipe:meal-plan-handoff:v1";
const PLAN_KEY = "walmart-recipe:meal-plan:v2";
const MAX_RECIPES = 24;

export type MealPlanState = {
  v: 2;
  recipes: Recipe[];
  haveNames: string[];
  assumePantry: boolean;
  checkedBuyKeys: string[];
};

export type MealPlanHandoff = {
  recipes: Recipe[];
  haveNames: string[];
};

export const EMPTY_MEAL_PLAN: MealPlanState = {
  v: 2,
  recipes: [],
  haveNames: [],
  assumePantry: true,
  checkedBuyKeys: [],
};

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null | undefined;
let cachedPlan: MealPlanState = EMPTY_MEAL_PLAN;

function canUseStorage() {
  return typeof window !== "undefined";
}

function emit() {
  for (const listener of listeners) listener();
}

function compactRecipe(recipe: Recipe): Recipe {
  return {
    id: recipe.id,
    Recipe_name: recipe.Recipe_name,
    Ingredients: recipe.Ingredients,
    Instructions: recipe.Instructions,
    source: recipe.source,
  };
}

function mergeRecipes(primary: Recipe[], extra: Recipe[]): Recipe[] {
  const byKey = new Map<string, Recipe>();
  for (const recipe of [...primary, ...extra]) {
    if (!recipe?.Recipe_name) continue;
    const key = recipePlanKey(recipe);
    if (!byKey.has(key)) byKey.set(key, compactRecipe(recipe));
  }
  return [...byKey.values()].slice(0, MAX_RECIPES);
}

function uniqueNames(names: string[]) {
  return [...new Set(names.filter(Boolean))];
}

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parsePlan(raw: string | null): MealPlanState {
  if (!raw) return EMPTY_MEAL_PLAN;
  try {
    const stored = JSON.parse(raw) as MealPlanState;
    if (!stored || stored.v !== 2 || !Array.isArray(stored.recipes)) {
      return EMPTY_MEAL_PLAN;
    }
    return {
      v: 2,
      recipes: mergeRecipes(stored.recipes, []),
      haveNames: Array.isArray(stored.haveNames) ? stored.haveNames : [],
      assumePantry: stored.assumePantry !== false,
      checkedBuyKeys: Array.isArray(stored.checkedBuyKeys)
        ? stored.checkedBuyKeys
        : [],
    };
  } catch {
    return EMPTY_MEAL_PLAN;
  }
}

export function subscribeMealPlan(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMealPlanSnapshot(): MealPlanState {
  if (!canUseStorage()) return EMPTY_MEAL_PLAN;
  const raw = localStorage.getItem(PLAN_KEY);
  if (raw === cachedRaw) return cachedPlan;
  cachedRaw = raw;
  cachedPlan = parsePlan(raw);
  return cachedPlan;
}

export function getMealPlanServerSnapshot() {
  return EMPTY_MEAL_PLAN;
}

export function consumeMealPlanHandoff(): MealPlanHandoff | null {
  if (!canUseStorage()) return null;
  const payload = readJson<MealPlanHandoff>(sessionStorage, HANDOFF_KEY);
  sessionStorage.removeItem(HANDOFF_KEY);
  if (!payload || !Array.isArray(payload.recipes)) return null;
  return {
    recipes: payload.recipes.filter((r) => r?.Recipe_name && r?.Ingredients),
    haveNames: Array.isArray(payload.haveNames) ? payload.haveNames : [],
  };
}

export function writeMealPlanHandoff(handoff: MealPlanHandoff) {
  if (!canUseStorage()) return;
  sessionStorage.setItem(
    HANDOFF_KEY,
    JSON.stringify({
      recipes: mergeRecipes(handoff.recipes, []),
      haveNames: uniqueNames(handoff.haveNames),
    } satisfies MealPlanHandoff)
  );
}

export function applyMealPlanHandoff() {
  const handoff = consumeMealPlanHandoff();
  if (!handoff) return;
  if (!handoff.recipes.length && !handoff.haveNames.length) return;
  const current = getMealPlanSnapshot();
  writeMealPlan({
    ...current,
    recipes: handoff.recipes.length
      ? mergeRecipes(handoff.recipes, [])
      : current.recipes,
    haveNames: handoff.haveNames.length
      ? uniqueNames(handoff.haveNames)
      : current.haveNames,
  });
}

export function writeMealPlan(next: MealPlanState) {
  if (!canUseStorage()) return;
  const payload: MealPlanState = {
    v: 2,
    recipes: mergeRecipes(next.recipes, []),
    haveNames: uniqueNames(next.haveNames),
    assumePantry: next.assumePantry !== false,
    checkedBuyKeys: [...new Set(next.checkedBuyKeys.filter(Boolean))],
  };
  const raw = JSON.stringify(payload);
  localStorage.setItem(PLAN_KEY, raw);
  cachedRaw = raw;
  cachedPlan = payload;
  emit();
}

export function addRecipesToMealPlan(recipes: Recipe[]) {
  const current = getMealPlanSnapshot();
  writeMealPlan({
    ...current,
    recipes: mergeRecipes(current.recipes, recipes),
  });
}

export function removeRecipesFromMealPlan(recipes: Recipe[]) {
  const keys = new Set(recipes.map(recipePlanKey));
  const current = getMealPlanSnapshot();
  writeMealPlan({
    ...current,
    recipes: current.recipes.filter((recipe) => !keys.has(recipePlanKey(recipe))),
  });
}

export function clearMealPlan() {
  writeMealPlan({ ...EMPTY_MEAL_PLAN });
}

export function mealPlanRecipeCount() {
  return getMealPlanSnapshot().recipes.length;
}
