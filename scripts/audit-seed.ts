import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("missing env");

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
});

async function main() {
  const { count: total } = await admin
    .from("recipes")
    .select("*", { count: "exact", head: true });

  const { count: withEmb } = await admin
    .from("recipes")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);

  const { count: foodcom } = await admin
    .from("recipes")
    .select("*", { count: "exact", head: true })
    .eq("source", "foodcom");

  const { data: samples } = await admin
    .from("recipes")
    .select("recipe_name, ingredients, description, source, tags, allergens")
    .eq("source", "foodcom")
    .order("created_at", { ascending: false })
    .limit(5);

  let quantityLike = 0;
  let goodParts = 0;
  const { data: check } = await admin
    .from("recipes")
    .select("ingredients")
    .eq("source", "foodcom")
    .limit(100);

  for (const row of check ?? []) {
    const lines = String(row.ingredients).split("\n").filter(Boolean);
    const mostlyQty =
      lines.length > 0 &&
      lines.filter((l) => /^[\d\/.\s]+$/.test(l.trim()) || /^c\(/i.test(l)).length /
        lines.length >
        0.5;
    if (mostlyQty) quantityLike += 1;
    else if (lines.some((l) => /[a-zA-Z]{3,}/.test(l))) goodParts += 1;
  }

  const { data: embRow } = await admin
    .from("recipes")
    .select("recipe_name, embedding")
    .eq("source", "foodcom")
    .not("embedding", "is", null)
    .limit(1)
    .maybeSingle();

  const embDim = Array.isArray(embRow?.embedding) ? embRow.embedding.length : typeof embRow?.embedding;

  console.log(
    JSON.stringify(
      {
        total,
        withEmbeddings: withEmb,
        foodcom,
        quantityLikeInSample100: quantityLike,
        looksLikeIngredientNamesInSample100: goodParts,
        embeddingDim: embDim,
        samples: (samples ?? []).map((s) => ({
          name: s.recipe_name,
          source: s.source,
          tags: (s.tags ?? []).slice(0, 5),
          allergens: s.allergens,
          ingredientsPreview: String(s.ingredients).split("\n").slice(0, 6),
          stepsPreview: String(s.description).split("\n").slice(0, 3),
        })),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
