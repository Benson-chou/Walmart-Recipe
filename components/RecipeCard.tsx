"use client";

import { useState } from "react";
import type { Recipe } from "@/lib/types";

type RecipeCardProps = {
  recipe: Recipe;
  loggedIn: boolean;
  username?: string | null;
  initiallySaved?: boolean;
  onSavedChange?: (saved: boolean) => void;
};

export function RecipeCard({
  recipe,
  loggedIn,
  username,
  initiallySaved = false,
  onSavedChange,
}: RecipeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(initiallySaved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggleSave() {
    if (!loggedIn) {
      setMessage("Log in to save recipes.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const endpoint = saved ? "/api/recipes/delete" : "/api/recipes/save";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_name: recipe.Recipe_name,
          recipe_ingredients: recipe.Ingredients,
          recipe_description: recipe.Instructions,
          username,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || "Something went wrong.");
        return;
      }
      const next = !saved;
      setSaved(next);
      onSavedChange?.(next);
    } catch {
      setMessage("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`recipe-card ${expanded ? "expanded" : ""}`}>
      <div className="recipe-top">
        <h3>{recipe.Recipe_name}</h3>
        <div className="recipe-actions">
          <button
            type="button"
            className="icon-button"
            onClick={toggleSave}
            disabled={busy}
            aria-label={saved ? "Unsave recipe" : "Save recipe"}
            title={saved ? "Unsave" : "Save"}
          >
            {saved ? "♥" : "♡"}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {message ? <p className="form-error">{message}</p> : null}

      {expanded ? (
        <div className="recipe-body">
          <div>
            <h4>Ingredients</h4>
            <pre>{recipe.Ingredients}</pre>
          </div>
          <div>
            <h4>Instructions</h4>
            <pre>{recipe.Instructions}</pre>
          </div>
        </div>
      ) : (
        <p className="recipe-preview">
          {recipe.Ingredients.split("\n").slice(0, 3).join(" · ")}
        </p>
      )}
    </article>
  );
}
