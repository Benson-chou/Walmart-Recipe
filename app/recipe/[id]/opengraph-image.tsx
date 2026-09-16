import { ImageResponse } from "next/og";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { getPublicRecipe, splitRecipeLines } from "@/lib/recipe-public";

export const alt = "Shared recipe";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getPublicRecipe(id);
  const title = recipe?.Recipe_name ?? "Recipe not found";
  const preview = recipe
    ? splitRecipeLines(recipe.Ingredients).slice(0, 3).join("  ·  ")
    : APP_TAGLINE;
  const titleSize = title.length > 52 ? 46 : title.length > 32 ? 56 : 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(155deg, #0071ce 0%, #004f9a 58%, #161616 100%)",
          padding: 64,
          color: "white",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, fontWeight: 600, opacity: 0.92 }}>
          {APP_NAME}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.15,
              maxWidth: 1040,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              opacity: 0.88,
              maxWidth: 980,
              lineHeight: 1.35,
            }}
          >
            {preview}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, opacity: 0.82 }}>
          {"Cook from this week's Walmart deals"}
        </div>
      </div>
    ),
    { ...size }
  );
}
