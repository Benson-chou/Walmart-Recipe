import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { embedText, recipeToEmbedText } from "@/lib/embeddings";
import { extractAllergensFromText } from "@/lib/allergens";
import { refreshUserEmbedding } from "@/lib/user-vector";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { message: "Supabase is not configured" },
      { status: 503 }
    );
  }

  try {
    const { recipe_name, recipe_ingredients, recipe_description } =
      await request.json();

    if (!recipe_name || !recipe_ingredients || !recipe_description) {
      return NextResponse.json({ message: "Missing recipe fields" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Please log in to save" }, { status: 401 });
    }

    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .eq("recipe_name", recipe_name)
      .maybeSingle();

    let recipeId = existing?.id;

    if (!recipeId) {
      const embedding = await embedText(
        recipeToEmbedText({
          recipe_name,
          ingredients: recipe_ingredients,
          description: recipe_description,
        })
      );
      const allergens = extractAllergensFromText(
        `${recipe_ingredients}\n${recipe_description}`
      );

      const { data: created, error: createError } = await supabase
        .from("recipes")
        .insert({
          recipe_name,
          ingredients: recipe_ingredients,
          description: recipe_description,
          source: "user",
          allergens,
          embedding,
        })
        .select("id")
        .single();

      if (createError || !created) {
        return NextResponse.json({ message: "Failed to save recipe" }, { status: 500 });
      }
      recipeId = created.id;
    }

    const { error: saveError } = await supabase.from("saved").upsert(
      { user_id: user.id, recipe_id: recipeId },
      { onConflict: "user_id,recipe_id" }
    );

    if (saveError) {
      return NextResponse.json({ message: "Failed to bookmark recipe" }, { status: 500 });
    }

    try {
      await refreshUserEmbedding(user.id);
    } catch (error) {
      console.error("refreshUserEmbedding failed:", error);
    }

    return NextResponse.json({
      message: "Recipe saved successfully",
      recipe_id: recipeId,
    });
  } catch {
    return NextResponse.json({ message: "Server Error" }, { status: 500 });
  }
}
