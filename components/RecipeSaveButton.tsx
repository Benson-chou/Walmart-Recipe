"use client";

import { useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { ActionTooltip, useAnchoredPopup } from "@/components/ActionTooltip";
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [saved, setSaved] = useState(initiallySaved);
  const [busy, setBusy] = useState(false);
  const [popupText, setPopupText] = useState("Log in to save");
  const loginPopup = useAnchoredPopup(buttonRef, { interactive: true });
  const statusPopup = useAnchoredPopup(buttonRef, { autoHideMs: 1800 });

  function setMessage(next: string | null) {
    onMessage?.(next);
  }

  async function toggleSave(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!loggedIn) {
      setPopupText("Log in to save");
      loginPopup.show();
      return;
    }
    setBusy(true);
    setMessage(null);
    loginPopup.hide();
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
        const text =
          data.message ||
          (res.status >= 500
            ? `Could not ${action} this recipe right now.`
            : `Unable to ${action} recipe.`);
        setPopupText(text);
        statusPopup.show();
        setMessage(text);
        return;
      }
      const next = !saved;
      setSaved(next);
      onSavedChange?.(
        next,
        typeof data.recipe_id === "string" ? data.recipe_id : recipe.id
      );
    } catch {
      const text = saved
        ? "Network error — could not unsave."
        : "Network error — could not save.";
      setPopupText(text);
      statusPopup.show();
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  const button =
    variant === "button" ? (
      <button
        ref={buttonRef}
        type="button"
        className="ghost-button"
        onClick={toggleSave}
        disabled={busy}
        aria-label={saved ? "Unsave recipe" : "Save recipe"}
      >
        {busy ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
    ) : (
      <button
        ref={buttonRef}
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

  return (
    <>
      {button}
      <ActionTooltip
        open={loginPopup.open}
        anchor={loginPopup.anchor}
        interactive
      >
        <div className="action-tooltip-login">
          <p>Log in to save recipes</p>
          <div className="action-tooltip-login-actions">
            <Link href="/login" onClick={(e) => e.stopPropagation()}>
              Log in
            </Link>
            <Link href="/signup" onClick={(e) => e.stopPropagation()}>
              Sign up
            </Link>
          </div>
        </div>
      </ActionTooltip>
      <ActionTooltip open={statusPopup.open} anchor={statusPopup.anchor}>
        {popupText}
      </ActionTooltip>
    </>
  );
}
