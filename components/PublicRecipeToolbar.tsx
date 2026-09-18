"use client";

import { AddToMealPlanButton } from "@/components/AddToMealPlanButton";
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
  if (!recipe.id) return null;

  return (
    <div className="recipe-page-toolbar-wrap">
      <div className="recipe-page-toolbar">
        <ShareRecipeButton recipeId={recipe.id} recipeName={recipe.Recipe_name} />
        <AddToMealPlanButton recipe={recipe} navigate variant="button" />
        <RecipeSaveButton
          recipe={recipe}
          loggedIn={loggedIn}
          username={username}
          initiallySaved={initiallySaved}
          variant="button"
        />
      </div>
    </div>
  );
}
