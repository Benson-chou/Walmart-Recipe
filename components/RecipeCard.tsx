"use client";

import { useMemo, useState } from "react";
import { ensureIngredientQuantities } from "@/lib/ingredients";
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

  const ingredients = useMemo(
    () => ensureIngredientQuantities(recipe.Ingredients),
    [recipe.Ingredients]
  );

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
          recipe_ingredients: ingredients,
          recipe_description: recipe.Instructions,
          username,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const action = saved ? "unsave" : "save";
        setMessage(
          data.message ||
            (res.status >= 500
              ? `Could not ${action} this recipe right now. Please try again.`
              : `Unable to ${action} recipe.`)
        );
        return;
      }
      const next = !saved;
      setSaved(next);
      setMessage(null);
      onSavedChange?.(next);
    } catch {
      setMessage(
        saved
          ? "Network error — could not unsave. Check your connection."
          : "Network error — could not save. Check your connection."
      );
    } finally {
      setBusy(false);
    }
  }

  const sourceLabel =
    recipe.source === "generated"
      ? "Fresh · AI"
      : recipe.source === "retrieved"
        ? "From catalog"
        : null;

  function toggleExpanded() {
    setExpanded((v) => !v);
  }

  return (
    <article
      className={`recipe-card ${expanded ? "expanded" : ""} ${
        recipe.source ? `source-${recipe.source}` : ""
      }`}
    >
      <div
        className="recipe-top recipe-top-toggle"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${recipe.Recipe_name}` : `Expand ${recipe.Recipe_name}`}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <div className="recipe-title-block">
          {sourceLabel ? (
            <span className={`source-badge source-badge-${recipe.source}`}>
              {sourceLabel}
            </span>
          ) : null}
          <h3>{recipe.Recipe_name}</h3>
        </div>
        <div className="recipe-actions">
          <button
            type="button"
            className="icon-button"
            onClick={(e) => {
              e.stopPropagation();
              void toggleSave();
            }}
            disabled={busy}
            aria-label={saved ? "Unsave recipe" : "Save recipe"}
            title={saved ? "Unsave" : "Save"}
          >
            {saved ? "♥" : "♡"}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {message ? (
        <p className="form-error recipe-save-error" role="alert">
          {message}
        </p>
      ) : null}

      {expanded ? (
        <div className="recipe-body">
          <div>
            <h4>Ingredients</h4>
            <pre>{ingredients}</pre>
          </div>
          <div>
            <h4>Instructions</h4>
            <pre>{recipe.Instructions}</pre>
          </div>
        </div>
      ) : (
        <p
          className="recipe-preview recipe-preview-toggle"
          role="button"
          tabIndex={0}
          onClick={toggleExpanded}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleExpanded();
            }
          }}
        >
          {ingredients.split("\n").slice(0, 3).join(" · ")}
        </p>
      )}
    </article>
  );
}
