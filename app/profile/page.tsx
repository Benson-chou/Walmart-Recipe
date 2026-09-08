import { redirect } from "next/navigation";
import { ProfileClient } from "@/components/ProfileClient";
import { recommendForUser } from "@/lib/agents/recommend";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Recipe } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, preferred_location, allergies, embedding")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/signup");
  }

  const { data: savedRows } = await supabase
    .from("saved")
    .select("recipe_id, recipes ( recipe_name, ingredients, description )")
    .eq("user_id", user.id);

  const recipes: Recipe[] = (savedRows || [])
    .map((row) => {
      const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
      if (!recipe) return null;
      return {
        Recipe_name: recipe.recipe_name,
        Ingredients: recipe.ingredients,
        Instructions: recipe.description,
      } satisfies Recipe;
    })
    .filter(Boolean) as Recipe[];

  let recommended: Recipe[] = [];
  try {
    recommended = await recommendForUser({
      userEmbedding: Array.isArray(profile.embedding)
        ? (profile.embedding as number[])
        : null,
      allergies: profile.allergies,
      excludeIds: (savedRows ?? []).map((row) => row.recipe_id).filter(Boolean),
      limit: 6,
    });
  } catch (error) {
    console.error("profile recommendations failed:", error);
  }

  return (
    <ProfileClient
      profile={{
        id: profile.id,
        username: profile.username,
        preferred_location: profile.preferred_location,
        allergies: profile.allergies,
      }}
      recipes={recipes}
      recommended={recommended}
    />
  );
}
