import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicRecipeToolbar } from "@/components/PublicRecipeToolbar";
import { SiteHeader } from "@/components/SiteHeader";
import { APP_NAME } from "@/lib/brand";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getPublicRecipe,
  instructionSteps,
  isRecipeId,
  recipeMetaDescription,
  splitRecipeLines,
} from "@/lib/recipe-public";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

type RecipePageProps = {
  params: Promise<{ id: string }>;
};

async function getRecipeViewer(recipeId: string) {
  const empty = {
    loggedIn: false,
    username: null as string | null,
    initiallySaved: false,
  };

  if (!isSupabaseConfigured()) return empty;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return empty;

    const [profileRes, savedRes] = await Promise.all([
      supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
      supabase
        .from("saved")
        .select("id")
        .eq("user_id", user.id)
        .eq("recipe_id", recipeId)
        .maybeSingle(),
    ]);

    return {
      loggedIn: true,
      username: profileRes.data?.username ?? user.email ?? "User",
      initiallySaved: Boolean(savedRes.data),
    };
  } catch (error) {
    console.error("getRecipeViewer failed:", error);
    return empty;
  }
}

export async function generateMetadata({
  params,
}: RecipePageProps): Promise<Metadata> {
  const { id } = await params;
  const recipe = await getPublicRecipe(id);
  if (!recipe) {
    return { title: "Recipe not found" };
  }

  const description = recipeMetaDescription(recipe);
  const url = `${getSiteUrl()}/recipe/${id}`;

  return {
    title: recipe.Recipe_name,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: recipe.Recipe_name,
      description,
      url,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: recipe.Recipe_name,
      description,
    },
  };
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { id } = await params;
  if (!isRecipeId(id)) notFound();

  const recipePromise = getPublicRecipe(id);
  const viewerPromise = getRecipeViewer(id);
  const recipe = await recipePromise;
  if (!recipe) notFound();

  const viewer = await viewerPromise;
  const ingredients = splitRecipeLines(recipe.Ingredients);
  const steps = instructionSteps(recipe.Instructions);
  const sourceLabel =
    recipe.source === "generated"
      ? "Fresh · AI"
      : recipe.source === "retrieved"
        ? "From catalog"
        : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.Recipe_name,
    description: recipeMetaDescription(recipe),
    recipeIngredient: ingredients,
    recipeInstructions: steps.map((text, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      text,
    })),
  };

  return (
    <div className="page-shell">
      <div className="atmosphere" aria-hidden />
      <SiteHeader loggedIn={viewer.loggedIn} username={viewer.username} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <main className="recipe-main">
        <article className="recipe-article">
          <header className="recipe-page-hero">
            {sourceLabel ? (
              <span className={`source-badge source-badge-${recipe.source}`}>
                {sourceLabel}
              </span>
            ) : (
              <p className="brand-mark recipe-page-mark">{APP_NAME}</p>
            )}
            <h1>{recipe.Recipe_name}</h1>
            <p className="lede">
              A public recipe you can share — no login required to view.
            </p>
            <PublicRecipeToolbar
              recipe={recipe}
              loggedIn={viewer.loggedIn}
              username={viewer.username}
              initiallySaved={viewer.initiallySaved}
            />
          </header>

          <div className="recipe-page-grid">
            <section>
              <h2>Ingredients</h2>
              <ul className="recipe-page-list">
                {ingredients.map((line, index) => (
                  <li key={`${index}-${line}`}>{line}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2>Instructions</h2>
              <ol className="recipe-page-list">
                {steps.map((step, index) => (
                  <li key={`${index}-${step.slice(0, 24)}`}>{step}</li>
                ))}
              </ol>
            </section>
          </div>
        </article>

        <aside className="recipe-page-cta">
          <p>
            Want more dishes from this week&apos;s Walmart deals?
          </p>
          <div className="recipe-page-cta-actions">
            <Link href="/plan" className="primary-button recipe-page-cta-button">
              Build a shopping list
            </Link>
            <Link href="/home" className="ghost-button recipe-page-cta-button">
              Cook from the flyer
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
