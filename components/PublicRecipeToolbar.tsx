"use client";

import { useState } from "react";
import { RecipeSaveButton } from "@/components/RecipeSaveButton";
import { ShareRecipeButton } from "@/components/ShareRecipeButton";
import type { Recipe } from "@/lib/types";

type PublicRecipeToolbarProps = {
  recipe: Recipe;
  loggedIn: boolean;
  username?: string | null;
  initiallySaved?: boolean;
};

export function PublicRecipeToolbar({
  recipe,
  loggedIn,
  username,
  initiallySaved,
}: PublicRecipeToolbarProps) {
  const [message, setMessage] = useState<string | null>(null);

  if (!recipe.id) return null;

  return (
    <div className="recipe-page-toolbar-wrap">
      <div className="recipe-page-toolbar">
        <ShareRecipeButton recipeId={recipe.id} recipeName={recipe.Recipe_name} />
        <RecipeSaveButton
          recipe={recipe}
          loggedIn={loggedIn}
          username={username}
          initiallySaved={initiallySaved}
          onMessage={setMessage}
          variant="button"
        />
      </div>
      {message ? (
        <p className="form-error recipe-save-error" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
