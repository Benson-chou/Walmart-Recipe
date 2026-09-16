"use client";

import { useState, type MouseEvent } from "react";
import { ensureIngredientQuantities } from "@/lib/ingredients";
import type { Recipe } from "@/lib/types";

type RecipeSaveButtonProps = {
  recipe: Recipe;
  loggedIn: boolean;
  username?: string | null;
  initiallySaved?: boolean;
  onSavedChange?: (saved: boolean, recipeId?: string) => void;
  onMessage?: (message: string | null) => void;
  variant?: "icon" | "button";
};

export function RecipeSaveButton({
  recipe,
  loggedIn,
  username,
  initiallySaved = false,
  onSavedChange,
  onMessage,
  variant = "icon",
}: RecipeSaveButtonProps) {
  const [saved, setSaved] = useState(initiallySaved);
  const [busy, setBusy] = useState(false);

  function setMessage(next: string | null) {
    onMessage?.(next);
  }

  async function toggleSave(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
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
          recipe_ingredients: ensureIngredientQuantities(recipe.Ingredients),
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
      onSavedChange?.(
        next,
        typeof data.recipe_id === "string" ? data.recipe_id : recipe.id
      );
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

  if (variant === "button") {
    return (
      <button
        type="button"
        className="ghost-button"
        onClick={toggleSave}
        disabled={busy}
        aria-label={saved ? "Unsave recipe" : "Save recipe"}
      >
        {busy ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
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
  );
}
