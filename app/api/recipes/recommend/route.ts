import { NextResponse } from "next/server";
import { recommendForUser } from "@/lib/agents/recommend";
import { parseEmbedding } from "@/lib/embeddings";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ message: "Supabase is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("allergies, embedding")
    .eq("id", user.id)
    .maybeSingle();

  const { data: saved } = await supabase
    .from("saved")
    .select("recipe_id")
    .eq("user_id", user.id);

  const recipes = await recommendForUser({
    userEmbedding: parseEmbedding(profile?.embedding),
    allergies: profile?.allergies ?? "None",
    excludeIds: (saved ?? []).map((row) => row.recipe_id),
    limit: 6,
  });

  return NextResponse.json(
    { recipes },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
