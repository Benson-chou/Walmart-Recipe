"use client";

import { useMemo, useState, useTransition } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { ItemGrid } from "@/components/ItemGrid";
import { GenerateForm } from "@/components/GenerateForm";
import { RecipeCard } from "@/components/RecipeCard";
import { formatAllergies, parseAllergies } from "@/lib/allergies";
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
  const [creativity, setCreativity] = useState(3);
  const [budget, setBudget] = useState("25");
  const [allergies, setAllergies] = useState(() => parseAllergies(initialAllergies));
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState<string | null>(null);
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

  function selectAll() {
    const allSelected = items.every((item) => selected.has(item.item_name));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((item) => item.item_name)));
    }
  }

  function handleGenerate() {
    setError(null);
    if (selectedList.length === 0) {
      setError("Please select at least one item.");
      return;
    }
    const budgetNum = Number(budget);
    if (!budget || Number.isNaN(budgetNum) || budgetNum < 0) {
      setError("Enter a valid budget.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/recipes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: selectedList,
            budget: budgetNum,
            allergies: formatAllergies(allergies),
            creativity,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Could not generate recipes.");
          return;
        }
        setRecipes(data.recipes || []);
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
          <p className="brand-mark">Loblaws Recipe</p>
          <h1>Cook from this week&apos;s discounts</h1>
          <p className="lede">
            Pick flyer items, set a budget, and get recipes tailored to what&apos;s on sale.
          </p>
        </section>

        <ItemGrid
          items={items}
          selected={selected}
          onToggle={toggleItem}
          onSelectAll={selectAll}
        />

        <GenerateForm
          creativity={creativity}
          budget={budget}
          allergies={allergies}
          location={location}
          error={error}
          loading={pending}
          onCreativityChange={setCreativity}
          onBudgetChange={setBudget}
          onAllergiesChange={setAllergies}
          onSubmit={handleGenerate}
        />

        {recipes.length > 0 ? (
          <section className="recipes-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Your menu</p>
                <h2>Generated recipes</h2>
              </div>
            </div>
            <div className="recipe-list">
              {recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.Recipe_name}
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
