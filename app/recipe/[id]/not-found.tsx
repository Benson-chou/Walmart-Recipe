import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { APP_NAME } from "@/lib/brand";

export default function RecipeNotFound() {
  return (
    <div className="page-shell">
      <div className="atmosphere" aria-hidden />
      <SiteHeader />
      <main className="recipe-main">
        <section className="recipe-article">
          <p className="brand-mark recipe-page-mark">{APP_NAME}</p>
          <h1>Recipe not found</h1>
          <p className="lede">
            This share link is invalid or the recipe is no longer in the catalog.
          </p>
          <div className="recipe-page-toolbar">
            <Link href="/home" className="primary-button recipe-page-cta-button">
              Back to the flyer
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
