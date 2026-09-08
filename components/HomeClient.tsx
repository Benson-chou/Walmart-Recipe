"use client";

import { useMemo, useState, useTransition } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { ItemGrid } from "@/components/ItemGrid";
import { GenerateForm } from "@/components/GenerateForm";
import { RecipeCard } from "@/components/RecipeCard";
import { APP_NAME } from "@/lib/brand";
import { formatAllergies, parseAllergies } from "@/lib/allergies";
import { filterItemsByAllergies } from "@/lib/allergens";
import { type CookingTierId, DEFAULT_COOKING_TIER } from "@/lib/cooking-tier";
import type { FlyerItem, Recipe } from "@/lib/types";

type HomeClientProps = {
  items: FlyerItem[];
  loggedIn: boolean;
  username?: string | null;
  location: string;
  allergies: string;
};

export function HomeClient({
  items,
  loggedIn,
  username,
  location,
  allergies: initialAllergies,
}: HomeClientProps) {
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

  const selectedList = useMemo(() => Array.from(selected), [selected]);

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

  function handleGenerate() {
    setError(null);
    setAllergySkipped([]);
    setSystemNotice(null);
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
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Could not generate recipes.");
          return;
        }
        setRecipes(data.recipes || []);

        if (skipped.length > 0) {
          setAllergySkipped(skipped);
        }
        if (data.notice) {
          setSystemNotice(data.notice);
        }
      } catch {
        setError("Network error. Try again.");
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
            Pick weekly ad items, set a budget, and get recipes tailored to what&apos;s on sale near you.
          </p>
        </section>

        <ItemGrid
          items={items}
          selected={selected}
          onToggle={toggleItem}
          onSelectAll={selectAll}
          onClearAll={clearAll}
        />

        <GenerateForm
          tier={tier}
          budget={budget}
          allergies={allergies}
          styleRequest={styleRequest}
          location={location}
          error={error}
          loading={pending}
          onTierChange={setTier}
          onBudgetChange={setBudget}
          onAllergiesChange={setAllergies}
          onStyleRequestChange={setStyleRequest}
          onSubmit={handleGenerate}
        />

        {(allergySkipped.length > 0 || Boolean(systemNotice)) && (
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

        {recipes.length > 0 ? (
          <section className="recipes-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Your menu</p>
                <h2>Recommended recipes</h2>
                <p className="lede-tight">
                  Agentic RAG: 2 Food.com catalog matches plus 1 freshly invented recipe grounded in those methods.
                </p>
              </div>
            </div>
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
