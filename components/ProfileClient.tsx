"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AllergyMultiSelect } from "@/components/AllergyMultiSelect";
import { SiteHeader } from "@/components/SiteHeader";
import { RecipeCard } from "@/components/RecipeCard";
import type { Profile, Recipe } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/brand";
import { formatAllergies, parseAllergies } from "@/lib/allergies";
import { isSupabaseConfigured } from "@/lib/env";
import { cleanZipCode } from "@/lib/location";

type ProfileClientProps = {
  profile: Profile;
  recipes: Recipe[];
  recommended?: Recipe[];
};

export function ProfileClient({
  profile,
  recipes: initialRecipes,
  recommended: initialRecommended = [],
}: ProfileClientProps) {
  const router = useRouter();
  const [location, setLocation] = useState(profile.preferred_location);
  const [allergies, setAllergies] = useState(() => parseAllergies(profile.allergies));
  const [recipes, setRecipes] = useState(initialRecipes);
  const [recommended, setRecommended] = useState(initialRecommended);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRecipes(initialRecipes);
    setRecommended(initialRecommended);
  }, [initialRecipes, initialRecommended]);

  const refreshRecommendations = useCallback(async () => {
    try {
      const res = await fetch("/api/recipes/recommend", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.recipes)) {
        setRecommended(data.recipes);
      }
    } catch (err) {
      console.error("Failed to refresh recommendations:", err);
    }
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferred_location: cleanZipCode(location),
          allergies: formatAllergies(allergies),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Update failed.");
        return;
      }
      setMessage("Profile updated.");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="page-shell">
      <div className="atmosphere" aria-hidden />
      <SiteHeader loggedIn username={profile.username} />

      <main className="profile-main">
        <section className="hero compact-hero">
          <p className="brand-mark">{APP_NAME}</p>
          <h1>{profile.username}</h1>
          <p className="lede">Update your kitchen prefs and browse saved recipes.</p>
        </section>

        <section className="profile-panel">
          <form className="profile-form" onSubmit={onSave}>
            <label className="field">
              <span>Preferred ZIP code</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </label>
            <div className="field">
              <span>Allergies</span>
              <AllergyMultiSelect value={allergies} onChange={setAllergies} />
            </div>
            {error ? <p className="form-error">{error}</p> : null}
            {message ? <p className="form-success">{message}</p> : null}
            <div className="profile-actions">
              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="ghost-button" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </form>
        </section>

        <section className="recipes-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Bookmarks</p>
              <h2>Saved recipes</h2>
            </div>
          </div>
          {recipes.length === 0 ? (
            <p className="empty-state">No saved recipes yet. Generate some on the home page.</p>
          ) : (
            <div className="recipe-list">
              {recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.Recipe_name}
                  recipe={recipe}
                  loggedIn
                  username={profile.username}
                  initiallySaved
                  onSavedChange={(saved) => {
                    if (!saved) {
                      setRecipes((prev) =>
                        prev.filter((r) => r.Recipe_name !== recipe.Recipe_name)
                      );
                      void refreshRecommendations();
                    }
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <section className="recipes-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">For you</p>
              <h2>You may also like</h2>
            </div>
          </div>
          {recommended.length === 0 ? (
            <p className="empty-state">
              Recommendations appear after the recipe catalog is seeded and you save a few dishes.
            </p>
          ) : (
            <div className="recipe-list">
              {recommended.map((recipe) => (
                <RecipeCard
                  key={`rec-${recipe.id ?? recipe.Recipe_name}`}
                  recipe={recipe}
                  loggedIn
                  username={profile.username}
                  onSavedChange={(saved) => {
                    if (saved) {
                      // Move into bookmarks and refresh personalized suggestions
                      setRecipes((prev) =>
                        prev.some((r) => r.Recipe_name === recipe.Recipe_name)
                          ? prev
                          : [...prev, recipe]
                      );
                      void refreshRecommendations();
                    }
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
