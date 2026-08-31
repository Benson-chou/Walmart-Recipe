import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { message: "Supabase is not configured" },
      { status: 503 }
    );
  }

  try {
    const { recipe_name } = await request.json();
    if (!recipe_name) {
      return NextResponse.json({ message: "Missing recipe name" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Please log in" }, { status: 401 });
    }

    const { data: recipe } = await supabase
      .from("recipes")
      .select("id")
      .eq("recipe_name", recipe_name)
      .maybeSingle();

    if (!recipe) {
      return NextResponse.json({ message: "Recipe not found" }, { status: 404 });
    }

    await supabase
      .from("saved")
      .delete()
      .eq("user_id", user.id)
      .eq("recipe_id", recipe.id);

    const { data: stillSaved } = await supabase
      .from("saved")
      .select("id")
      .eq("recipe_id", recipe.id)
      .limit(1);

    if (!stillSaved || stillSaved.length === 0) {
      await supabase.from("recipes").delete().eq("id", recipe.id);
    }

    return NextResponse.json({ message: "Recipe deleted successfully" });
  } catch {
    return NextResponse.json({ message: "Server Error" }, { status: 500 });
  }
}
