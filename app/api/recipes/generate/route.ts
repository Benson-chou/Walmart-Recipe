import { NextResponse } from "next/server";
import { filterItemsByAllergies } from "@/lib/allergens";
import { recommendRecipes } from "@/lib/agents/recommend";
import { parseEmbedding } from "@/lib/embeddings";
import { hasGeminiKey, isSupabaseConfigured } from "@/lib/env";
import { getClientKey, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const GENERATE_LIMIT = 8;
const GENERATE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    let userId: string | null = null;
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      } catch {
        // guest
      }
    }

    const limited = rateLimit({
      key: `generate:${getClientKey(request, userId)}`,
      limit: GENERATE_LIMIT,
      windowMs: GENERATE_WINDOW_MS,
    });
    if (!limited.ok) {
      return NextResponse.json(
        {
          message: `Too many recipe requests. Please wait about ${limited.retryAfterSec}s and try again.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(limited.retryAfterSec),
            "X-RateLimit-Limit": String(limited.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    if (!hasGeminiKey()) {
      return NextResponse.json(
        {
          message:
            "Recipe AI is not configured (missing GEMINI_API_KEY). Add the key in your environment and redeploy.",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const items: string[] = Array.isArray(body.items) ? body.items : [];
    const budget = Number(body.budget);
    const allergies = typeof body.allergies === "string" ? body.allergies : "None";
    const rawCreativity = body.tier ?? body.creativity;
    const creativity =
      typeof rawCreativity === "string" || typeof rawCreativity === "number"
        ? rawCreativity
        : "simple";
    const styleRequest =
      typeof body.styleRequest === "string" ? body.styleRequest.slice(0, 400) : undefined;

    if (items.length === 0) {
      return NextResponse.json(
        { message: "Please select at least one item" },
        { status: 400 }
      );
    }

    const safeItems = filterItemsByAllergies(items, allergies);
    if (!safeItems.length) {
      return NextResponse.json(
        { message: "All selected items conflict with your allergies." },
        { status: 400 }
      );
    }
    if (Number.isNaN(budget) || budget < 0) {
      return NextResponse.json({ message: "Invalid budget" }, { status: 400 });
    }

    let userEmbedding: number[] | null = null;
    if (isSupabaseConfigured() && userId) {
      try {
        const supabase = await createClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("embedding")
          .eq("id", userId)
          .maybeSingle();
        userEmbedding = parseEmbedding(profile?.embedding);
      } catch {
        // guest / no profile embedding
      }
    }

    const result = await recommendRecipes({
      items: safeItems,
      budget,
      allergies,
      creativity,
      styleRequest,
      userEmbedding,
    });

    if (!result.recipes.length) {
      if (result.fallbackUsed) {
        return NextResponse.json(
          {
            message:
              "Recipe service is momentarily experiencing high demand and no catalog recipes matched. Please try again in a few moments.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { message: "No allergy-safe recipes found. Try selecting different flyer items." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      recipes: result.recipes.map(({ Recipe_name, Ingredients, Instructions, id, source, score }) => ({
        id,
        Recipe_name,
        Ingredients,
        Instructions,
        source,
        score,
      })),
      notice: result.notice,
      fallbackUsed: result.fallbackUsed,
    });
  } catch (error) {
    console.error("POST /api/recipes/generate error:", error);
    const is503 =
      error instanceof Error &&
      (error.message.includes("503") || error.message.includes("high demand"));
    const is429 =
      error instanceof Error &&
      (error.message.includes("429") || error.message.toLowerCase().includes("quota"));
    return NextResponse.json(
      {
        message: is503
          ? "AI recipe service is temporarily experiencing high demand. Please try again in a few moments."
          : is429
            ? "AI quota is exhausted for now. Please try again later."
            : "An error occurred while generating recipes. Please try again.",
      },
      { status: is503 || is429 ? 503 : 500 }
    );
  }
}
