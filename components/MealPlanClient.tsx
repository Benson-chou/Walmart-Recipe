"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ShoppingListPanel } from "@/components/ShoppingListPanel";
import { APP_NAME } from "@/lib/brand";
import {
  addRecipesToMealPlan,
  applyMealPlanHandoff,
  clearMealPlan,
  getMealPlanServerSnapshot,
  getMealPlanSnapshot,
  subscribeMealPlan,
  writeMealPlan,
} from "@/lib/meal-plan-store";
import {
  buildShoppingList,
  formatShoppingListText,
  recipePlanKey,
} from "@/lib/shopping-list";
import { ZipEditor } from "@/components/ZipEditor";
import { fetchFlyerForZip, persistZipPreference } from "@/lib/zip-preference";
import type { FlyerItem, Recipe } from "@/lib/types";

type MealPlanClientProps = {
  savedRecipes: Recipe[];
  flyerItems: FlyerItem[];
  loggedIn: boolean;
  username?: string | null;
  location: string;
};

export function MealPlanClient({
  savedRecipes,
  flyerItems: initialFlyerItems,
  loggedIn,
  username,
  location: initialLocation,
}: MealPlanClientProps) {
  const plan = useSyncExternalStore(
    subscribeMealPlan,
    getMealPlanSnapshot,
    getMealPlanServerSnapshot
  );
  const [flyerItems, setFlyerItems] = useState(initialFlyerItems);
  const [location, setLocation] = useState(initialLocation);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [excludedKeys, setExcludedKeys] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    applyMealPlanHandoff();
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  const activeRecipes = useMemo(() => {
    const excluded = new Set(excludedKeys);
    return plan.recipes.filter(
      (recipe) => !excluded.has(recipePlanKey(recipe))
    );
  }, [plan.recipes, excludedKeys]);

  const list = useMemo(
    () =>
      buildShoppingList({
        recipes: activeRecipes,
        assumePantry: plan.assumePantry,
        flyerItems,
      }),
    [activeRecipes, plan.assumePantry, flyerItems]
  );

  const checkedSet = useMemo(
    () => new Set(plan.checkedBuyKeys),
    [plan.checkedBuyKeys]
  );

  const savedAvailable = useMemo(() => {
    const inPlan = new Set(plan.recipes.map(recipePlanKey));
    return savedRecipes.filter((recipe) => !inPlan.has(recipePlanKey(recipe)));
  }, [savedRecipes, plan.recipes]);

  function addRecipe(recipe: Recipe) {
    addRecipesToMealPlan([recipe]);
    setExcludedKeys((prev) =>
      prev.filter((key) => key !== recipePlanKey(recipe))
    );
  }

  function removeRecipe(recipe: Recipe) {
    const key = recipePlanKey(recipe);
    writeMealPlan({
      ...plan,
      recipes: plan.recipes.filter((row) => recipePlanKey(row) !== key),
    });
    setExcludedKeys((prev) => prev.filter((item) => item !== key));
  }

  function toggleIncluded(recipe: Recipe) {
    const key = recipePlanKey(recipe);
    setExcludedKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }

  function toggleBuyItem(key: string) {
    writeMealPlan({
      ...plan,
      checkedBuyKeys: plan.checkedBuyKeys.includes(key)
        ? plan.checkedBuyKeys.filter((item) => item !== key)
        : [...plan.checkedBuyKeys, key],
    });
  }

  async function copyList() {
    const text = formatShoppingListText(list);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function addAllSaved() {
    addRecipesToMealPlan(savedAvailable);
    setShowSaved(false);
  }

  async function applyLocation(nextRaw: string) {
    setZipError(null);
    setZipBusy(true);
    try {
      const nextZip = await persistZipPreference(nextRaw, { loggedIn });
      setLocation(nextZip);
      const flyer = await fetchFlyerForZip(nextZip);
      setFlyerItems(flyer.items);
    } catch (err) {
      setZipError(
        err instanceof Error ? err.message : "Could not update ZIP."
      );
    } finally {
      setZipBusy(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="atmosphere" aria-hidden />
      <SiteHeader loggedIn={loggedIn} username={username} />

      <main className="profile-main plan-main">
        <section className="hero compact-hero">
          <p className="brand-mark">{APP_NAME}</p>
          <h1>Meal plan</h1>
          <p className="lede">
            Check recipes for the week and copy one shopping list
            {location ? ` for ZIP ${location}` : ""}.
          </p>
          <ZipEditor
            key={location}
            location={location}
            busy={zipBusy}
            error={zipError}
            onCommit={(zip) => void applyLocation(zip)}
          />
          <ol className="plan-steps">
            <li>Add recipes from Home, or from your saved list below.</li>
            <li>
              Sale items from this week&apos;s ad stay on the list so you can
              grab them with everything else.
            </li>
            <li>Copy the list or check items off as you shop.</li>
          </ol>
        </section>

        <div className="plan-layout">
          <div className="plan-sidebar">
            <section className="plan-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">This week</p>
                  <h2>Recipes</h2>
                </div>
                {plan.recipes.length > 0 ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => clearMealPlan()}
                  >
                    Clear all
                  </button>
                ) : null}
              </div>

              {plan.recipes.length === 0 ? (
                <p className="empty-state">
                  No recipes in this plan yet. Generate a menu on the{" "}
                  <Link href="/home">home page</Link>
                  {loggedIn ? ", or add a saved recipe below." : "."}
                </p>
              ) : (
                <ul className="plan-recipe-list">
                  {plan.recipes.map((recipe) => {
                    const key = recipePlanKey(recipe);
                    const included = !excludedKeys.includes(key);
                    return (
                      <li key={key} className="plan-recipe-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={() => toggleIncluded(recipe)}
                          />
                          <span>
                            <span className="plan-recipe-name">
                              {recipe.Recipe_name}
                            </span>
                            <span className="plan-buy-meta">
                              {
                                recipe.Ingredients.split("\n").filter(Boolean)
                                  .length
                              }{" "}
                              ingredients
                            </span>
                          </span>
                        </label>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => removeRecipe(recipe)}
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {loggedIn && savedAvailable.length > 0 ? (
                <div className="plan-saved-block">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setShowSaved((v) => !v)}
                  >
                    {showSaved
                      ? "Hide saved recipes"
                      : `Add from saved (${savedAvailable.length})`}
                  </button>
                  {showSaved ? (
                    <ul className="plan-saved-list">
                      {savedAvailable.map((recipe) => (
                        <li key={recipePlanKey(recipe)}>
                          <span>{recipe.Recipe_name}</span>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => addRecipe(recipe)}
                          >
                            Add
                          </button>
                        </li>
                      ))}
                      {savedAvailable.length > 1 ? (
                        <li className="plan-saved-all">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={addAllSaved}
                          >
                            Add all saved
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {loggedIn && savedRecipes.length === 0 ? (
                <p className="plan-buy-meta">
                  Save recipes from Home or your profile to reuse them here.
                </p>
              ) : null}
            </section>
          </div>

          <ShoppingListPanel
            list={list}
            checkedKeys={checkedSet}
            onToggleItem={toggleBuyItem}
            onCopy={() => void copyList()}
            copied={copied}
            recipeCount={activeRecipes.length}
            assumePantry={plan.assumePantry}
            onAssumePantryChange={(value) =>
              writeMealPlan({ ...plan, assumePantry: value })
            }
          />
        </div>
      </main>
    </div>
  );
}
