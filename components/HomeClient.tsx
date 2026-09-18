"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ItemGrid } from "@/components/ItemGrid";
import { GenerateForm } from "@/components/GenerateForm";
import { RecipeCard } from "@/components/RecipeCard";
import { CookingAnimation } from "@/components/CookingAnimation";
import { APP_NAME } from "@/lib/brand";
import { formatAllergies, parseAllergies } from "@/lib/allergies";
import { filterItemsByAllergies } from "@/lib/allergens";
import { type CookingTierId, DEFAULT_COOKING_TIER } from "@/lib/cooking-tier";
import {
  getMealPlanServerSnapshot,
  getMealPlanSnapshot,
  subscribeMealPlan,
  writeMealPlanHandoff,
} from "@/lib/meal-plan-store";
import { recipePlanKey } from "@/lib/shopping-list";
import type { FlyerItem, Recipe } from "@/lib/types";
import { ZipEditor } from "@/components/ZipEditor";
import {
  fetchFlyerForZip,
  persistZipPreference,
  type FlyerSource,
} from "@/lib/zip-preference";

type HomeClientProps = {
  items: FlyerItem[];
  flyerSource?: FlyerSource;
  loggedIn: boolean;
  username?: string | null;
  location: string;
  allergies: string;
};

function friendlyGenerateError(status: number, message?: string): string {
  if (status === 429) {
    return message || "Too many requests. Wait a moment and try again.";
  }
  if (status === 503) {
    return (
      message ||
      "Recipe AI is temporarily unavailable (high demand or missing configuration). Try again shortly."
    );
  }
  if (status >= 500) {
    return message || "Something went wrong generating recipes. Please try again.";
  }
  return message || "Could not generate recipes.";
}

export function HomeClient({
  items: initialItems,
  flyerSource: initialFlyerSource = "cache",
  loggedIn,
  username,
  location: initialLocation,
  allergies: initialAllergies,
}: HomeClientProps) {
  const [items, setItems] = useState(initialItems);
  const [flyerSource, setFlyerSource] = useState<FlyerSource>(initialFlyerSource);
  const [location, setLocation] = useState(initialLocation);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tier, setTier] = useState<CookingTierId>(DEFAULT_COOKING_TIER);
  const [budget, setBudget] = useState("25");
  const [allergies, setAllergies] = useState(() => parseAllergies(initialAllergies));
  const [styleRequest, setStyleRequest] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [allergySkipped, setAllergySkipped] = useState<string[]>([]);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const mealPlan = useSyncExternalStore(
    subscribeMealPlan,
    getMealPlanSnapshot,
    getMealPlanServerSnapshot
  );

  const selectedList = useMemo(() => Array.from(selected), [selected]);
  const isSeedFlyer = flyerSource === "seed";
  const isEmptyFlyer = items.length === 0;

  function toggleItem(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function selectAll(targetNames?: string[]) {
    const target =
      targetNames && targetNames.length > 0
        ? targetNames
        : items.map((item) => item.item_name);

    if (target.length === 0) {
      setSelected(new Set());
      return;
    }

    const allTargetSelected = target.every((name) => selected.has(name));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allTargetSelected) {
        target.forEach((name) => next.delete(name));
      } else {
        target.forEach((name) => next.add(name));
      }
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function applyLocation(nextRaw: string) {
    setZipError(null);
    setZipBusy(true);
    try {
      const nextZip = await persistZipPreference(nextRaw, { loggedIn });
      setLocation(nextZip);
      setSelected(new Set());
      const flyer = await fetchFlyerForZip(nextZip);
      setItems(flyer.items);
      setFlyerSource(flyer.source);
    } catch (err) {
      setZipError(
        err instanceof Error ? err.message : "Could not update ZIP."
      );
    } finally {
      setZipBusy(false);
    }
  }

  function openMealPlan() {
    const chosen = recipes.filter((recipe) =>
      mealPlan.recipes.some((row) => recipePlanKey(row) === recipePlanKey(recipe))
    );
    if (chosen.length === 0) {
      setError("Check at least one recipe to include in this week's meals.");
      return;
    }
    writeMealPlanHandoff({
      recipes: chosen,
      haveNames: [],
    });
    router.push("/plan");
  }

  function handleGenerate() {
    setError(null);
    setAllergySkipped([]);
    setSystemNotice(null);
    if (isEmptyFlyer) {
      setError("No flyer items available yet. Try another ZIP on the weekly ad, or try again later.");
      return;
    }
    if (selectedList.length === 0) {
      setError("Please select at least one item.");
      return;
    }
    const allergyText = formatAllergies(allergies);
    const safeItems = filterItemsByAllergies(selectedList, allergyText);
    if (safeItems.length === 0) {
      setError("Every selected item conflicts with your allergies. Pick other flyer items.");
      return;
    }
    const budgetNum = Number(budget);
    if (!budget || Number.isNaN(budgetNum) || budgetNum < 0) {
      setError("Enter a valid budget.");
      return;
    }

    const skipped = selectedList.filter((item) => !safeItems.includes(item));

    startTransition(async () => {
      try {
        const res = await fetch("/api/recipes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: safeItems,
            budget: budgetNum,
            allergies: allergyText,
            creativity: tier,
            styleRequest: styleRequest.trim() || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(friendlyGenerateError(res.status, data.message));
          return;
        }
        const nextRecipes: Recipe[] = data.recipes || [];
        setRecipes(nextRecipes);

        if (skipped.length > 0) {
          setAllergySkipped(skipped);
        }
        if (data.notice) {
          setSystemNotice(data.notice);
        }
      } catch {
        setError("Network error — check your connection and try again.");
      }
    });
  }

  return (
    <div className="page-shell">
      <div className="atmosphere" aria-hidden />
      <SiteHeader loggedIn={loggedIn} username={username} />

      <main className="home-main">
        <section className="hero">
          <p className="brand-mark">{APP_NAME}</p>
          <h1>Cook from this week&apos;s Walmart deals</h1>
          <p className="lede">
            Pick weekly ad items for your ZIP, set a budget, and get recipes tailored to what&apos;s on sale nearby.
          </p>
        </section>

        {isEmptyFlyer ? (
          <div className="notice-card notice-card-empty" role="status">
            <div className="notice-icon-wrap" aria-hidden>
              <span className="notice-spark">!</span>
            </div>
            <div className="notice-content">
              <div className="notice-header">
                <span className="notice-badge badge-empty">No flyer deals</span>
                <span className="notice-text">
                  We couldn&apos;t load Walmart deals for ZIP {location}. Try another ZIP on the weekly ad, or wait a few minutes while the flyer cache refreshes.
                </span>
              </div>
            </div>
          </div>
        ) : isSeedFlyer ? (
          <div className="notice-card notice-card-empty" role="status">
            <div className="notice-icon-wrap" aria-hidden>
              <span className="notice-spark">✦</span>
            </div>
            <div className="notice-content">
              <div className="notice-header">
                <span className="notice-badge badge-empty">Sample shelf</span>
                <span className="notice-text">
                  Showing Everyday Low Price staples while live flyer data loads for ZIP {location}.
                  Recipes still work — live deals appear once the cache is refreshed.
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <ItemGrid
          items={items}
          selected={selected}
          onToggle={toggleItem}
          onSelectAll={selectAll}
          onClearAll={clearAll}
          headingAction={
            <ZipEditor
              key={location}
              location={location}
              busy={zipBusy}
              error={zipError}
              onCommit={(zip) => void applyLocation(zip)}
            />
          }
        />

        <GenerateForm
          tier={tier}
          budget={budget}
          allergies={allergies}
          styleRequest={styleRequest}
          error={error}
          loading={pending}
          onTierChange={setTier}
          onBudgetChange={setBudget}
          onAllergiesChange={setAllergies}
          onStyleRequestChange={setStyleRequest}
          onSubmit={handleGenerate}
        />

        {pending && (
          <CookingAnimation
            tier={tier}
            selectedItems={selectedList}
          />
        )}

        {!pending && (allergySkipped.length > 0 || Boolean(systemNotice)) && (
          <div className="notices-container" aria-live="polite">
            {systemNotice ? (
              <div className="notice-card notice-card-system" role="status">
                <div className="notice-icon-wrap" aria-hidden>
                  <span className="notice-spark">✦</span>
                </div>
                <div className="notice-content">
                  <div className="notice-header">
                    <span className="notice-badge badge-system">AI Traffic Status</span>
                    <span className="notice-text">{systemNotice}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="notice-dismiss-btn"
                  onClick={() => setSystemNotice(null)}
                  aria-label="Dismiss message"
                  title="Dismiss message"
                >
                  ✕
                </button>
              </div>
            ) : null}

            {allergySkipped.length > 0 ? (
              <div className="notice-card notice-card-allergy" role="status">
                <div className="notice-icon-wrap" aria-hidden>
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="notice-content">
                  <div className="notice-header">
                    <span className="notice-badge badge-allergy">Allergy Safeguard</span>
                    <span className="notice-text">
                      {allergySkipped.length === 1
                        ? "1 item excluded from recipes to match your allergy profile:"
                        : `${allergySkipped.length} items excluded from recipes to match your allergy profile:`}
                    </span>
                  </div>
                  <div className="notice-chips">
                    {allergySkipped.map((item) => (
                      <span key={item} className="notice-chip">
                        <span className="notice-chip-cross" aria-hidden>
                          ✕
                        </span>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="notice-dismiss-btn"
                  onClick={() => setAllergySkipped([])}
                  aria-label="Dismiss message"
                  title="Dismiss message"
                >
                  ✕
                </button>
              </div>
            ) : null}
          </div>
        )}

        {!pending && recipes.length > 0 ? (
          <section className="recipes-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Your menu</p>
                <h2>Recommended recipes</h2>
              </div>
              <button type="button" className="primary-button" onClick={openMealPlan}>
                Build shopping list
              </button>
            </div>
            <ol className="plan-steps">
              <li>
                Check the box next to a recipe to include it in your shopping list for this week.
              </li>
              <li>
                The heart saves a recipe to your profile
                {loggedIn ? "." : " — tap it to log in or sign up."}
              </li>
              <li>
                Click <strong>Build shopping list</strong> for one list of
                ingredients. Sale items from this week&apos;s ad are tagged on
                the list.
              </li>
            </ol>
            <div className="recipe-list">
              {recipes.map((recipe) => (
                <RecipeCard
                  key={`${recipe.source ?? "recipe"}-${recipe.id ?? recipe.Recipe_name}`}
                  recipe={recipe}
                  loggedIn={loggedIn}
                  username={username}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
