import type { Metadata } from "next";
import { MealPlanClient } from "@/components/MealPlanClient";
import { getLocalFlyerItems } from "@/lib/flyer";
import { getCachedOrFreshItems } from "@/lib/flyer-scrape";
import { isGroceryName } from "@/lib/grocery-categories";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { resolveZip, ZIP_COOKIE } from "@/lib/zip-preference";
import { cookies } from "next/headers";
import type { Recipe } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meal plan",
  description:
    "Turn selected recipes into an aisle-by-aisle buy list of missing ingredients.",
};

function mapSavedRecipe(row: {
  recipe_id?: string;
  recipes?:
    | {
        id?: string;
        recipe_name: string;
        ingredients: string;
        description: string;
        source?: string | null;
      }
    | Array<{
        id?: string;
        recipe_name: string;
        ingredients: string;
        description: string;
        source?: string | null;
      }>
    | null;
}): Recipe | null {
  const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
  if (!recipe) return null;
  return {
    id: recipe.id ?? row.recipe_id,
    Recipe_name: recipe.recipe_name,
    Ingredients: recipe.ingredients,
    Instructions: recipe.description,
    source:
      recipe.source === "generated"
        ? "generated"
        : recipe.source === "retrieved" || recipe.source === "seed"
          ? "retrieved"
          : undefined,
  };
}

export default async function MealPlanPage() {
  const cookieStore = await cookies();
  const cookieZip = cookieStore.get(ZIP_COOKIE)?.value;
  let items = getLocalFlyerItems();
  let loggedIn = false;
  let username: string | null = null;
  let location = resolveZip(null, cookieZip);
  let savedRecipes: Recipe[] = [];

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        loggedIn = true;
        const [{ data: profile }, { data: savedRows }] = await Promise.all([
          supabase
            .from("profiles")
            .select("username, preferred_location")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("saved")
            .select(
              "recipe_id, recipes ( id, recipe_name, ingredients, description, source )"
            )
            .eq("user_id", user.id),
        ]);

        username = profile?.username ?? user.email ?? "User";
        location = resolveZip(profile?.preferred_location, cookieZip);
        savedRecipes = (savedRows || [])
          .map(mapSavedRecipe)
          .filter(Boolean) as Recipe[];
      }

      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const flyer = await getCachedOrFreshItems({ postalCode: location });
        if (flyer.items.length) {
          items = flyer.items;
        }
      } else {
        const withCat = await supabase
          .from("items")
          .select("id, item_name, price, image, sale_story, category")
          .order("item_name");
        const dbItems =
          !withCat.error && withCat.data
            ? withCat.data
            : (
                await supabase
                  .from("items")
                  .select("id, item_name, price, image, sale_story")
                  .order("item_name")
              ).data;
        if (dbItems?.length) {
          items = dbItems
            .filter((row) => isGroceryName(row.item_name))
            .map((row) => ({
              id: row.id,
              item_name: row.item_name,
              price: Number(row.price),
              image: row.image,
              sale_story: row.sale_story,
              category: (row as { category?: string }).category,
            }));
        }
      }
    } catch (error) {
      console.error("MealPlanPage load error:", error);
    }
  }

  return (
    <MealPlanClient
      savedRecipes={savedRecipes}
      flyerItems={items}
      loggedIn={loggedIn}
      username={username}
      location={location}
    />
  );
}
