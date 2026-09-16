"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RecipeSaveButton } from "@/components/RecipeSaveButton";
import { ShareRecipeButton, recipePath } from "@/components/ShareRecipeButton";
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
  const [recipeId, setRecipeId] = useState(recipe.id);
  const [message, setMessage] = useState<string | null>(null);

  const ingredients = useMemo(
    () => ensureIngredientQuantities(recipe.Ingredients),
    [recipe.Ingredients]
  );

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
          <h3>
            {recipeId ? (
              <Link
                href={recipePath(recipeId)}
                className="recipe-title-link"
                onClick={(e) => e.stopPropagation()}
              >
                {recipe.Recipe_name}
              </Link>
            ) : (
              recipe.Recipe_name
            )}
          </h3>
        </div>
        <div className="recipe-actions">
          <RecipeSaveButton
            recipe={recipe}
            loggedIn={loggedIn}
            username={username}
            initiallySaved={initiallySaved}
            onMessage={setMessage}
            onSavedChange={(saved, id) => {
              if (id) setRecipeId(id);
              onSavedChange?.(saved);
            }}
          />
          {recipeId ? (
            <ShareRecipeButton
              recipeId={recipeId}
              recipeName={recipe.Recipe_name}
              variant="icon"
            />
          ) : null}
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
