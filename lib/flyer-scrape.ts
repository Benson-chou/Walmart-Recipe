import { getLocalFlyerItems } from "@/lib/flyer";
import {
  cleanZipCode,
  FLYER_LOCALE,
  FLYER_MERCHANT,
  FLYER_MERCHANT_ID,
} from "@/lib/location";
import {
  isGroceryName,
  resolveGroceryCategory,
  categorizeGroceryItem,
} from "@/lib/grocery-categories";
import type { FlyerItem } from "@/lib/types";

export type ScrapedFlyerItem = FlyerItem & {
  external_id?: string;
  valid_from?: string | null;
  valid_to?: string | null;
};

type FlippItem = {
  id?: number | string;
  name?: string;
  sale_story?: string | null;
  clean_image_url?: string | null;
  image_url?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  current_price?: number | string | null;
  _L1?: string | null;
  _L2?: string | null;
  merchant_id?: number | string | null;
  merchant_name?: string | null;
};

function isGroceryItem(item: FlippItem): boolean {
  // 1. Strict merchant match: discard items from other nearby stores (e.g. JCPenney, Macy's)
  if (item.merchant_id != null && Number(item.merchant_id) !== FLYER_MERCHANT_ID) {
    return false;
  }
  if (item.merchant_name && !/walmart/i.test(item.merchant_name)) {
    return false;
  }

  // 2. Reject non-food merchandise (diamonds, jewelry, diapers, tires, electronics, etc.)
  if (!item.name || !isGroceryName(item.name)) return false;

  // 3. Price sanity cap: grocery weekly ad items are never > $200 (rejects $1,399 jewelry/hardware).
  // Promotional ad deals without upfront unit prices (e.g. "Buy 2 get 2 FREE", "Buy 1 get 1 50% off") have price <= 0.
  const price = item.current_price != null ? Number(item.current_price) : 0;
  if (Number.isNaN(price) || price < 0 || price > 200) {
    return false;
  }

  // 4. Reject non-food L1 categories even if mislabeled by syndication
  const l1 = item._L1 ?? "";
  const l2 = item._L2 ?? "";
  if (
    /apparel|jewelry|clothing|home|garden|beauty|health|electronics|automotive|sports|toy|baby/i.test(
      l1
    )
  ) {
    return false;
  }

  if (/food,\s*beverages/i.test(l1)) return true;
  return /food|beverage/i.test(l2);
}

export async function fetchFlippItems(zipCode: string): Promise<ScrapedFlyerItem[]> {
  const zip = cleanZipCode(zipCode);
  const url = `https://backflipp.wishabi.com/flipp/items/search?locale=${FLYER_LOCALE}&postal_code=${encodeURIComponent(zip)}&q=${encodeURIComponent(FLYER_MERCHANT)}&merchant_id=${FLYER_MERCHANT_ID}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "walmart-recipe/1.0",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Flipp request failed: ${res.status}`);
  }

  const payload = await res.json();
  const raw: FlippItem[] =
    Array.isArray(payload.items) && payload.items.length
      ? payload.items
      : Array.isArray(payload.related_items)
        ? payload.related_items
        : [];

  const mapped: ScrapedFlyerItem[] = [];
  for (const item of raw) {
    const rawPrice = item.current_price != null ? Number(item.current_price) : 0;
    const price = Number.isNaN(rawPrice) ? 0 : Math.max(0, rawPrice);
    if (!item.name) continue;
    if (!isGroceryItem(item)) continue;

    const category = resolveGroceryCategory(String(item.name), item._L2);

    mapped.push({
      item_name: String(item.name),
      price,
      image: String(item.clean_image_url || item.image_url || ""),
      sale_story: String(item.sale_story || ""),
      category,
      external_id: item.id != null ? String(item.id) : undefined,
      valid_from: item.valid_from ?? null,
      valid_to: item.valid_to ?? null,
    });
  }

  return mapped;
}

export function isFlyerFresh(
  fetchedAt: string | null | undefined,
  validTo: string | null | undefined,
  maxAgeHours = 18
): boolean {
  if (validTo) {
    const end = new Date(validTo).getTime();
    if (!Number.isNaN(end) && end < Date.now()) return false;
  }
  if (!fetchedAt) return false;
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs < maxAgeHours * 60 * 60 * 1000;
}

export async function getCachedOrFreshItems(input: {
  postalCode: string;
  forceRefresh?: boolean;
}): Promise<{ items: FlyerItem[]; source: "cache" | "scrape" | "seed"; refreshed: boolean }> {
  const postal = cleanZipCode(input.postalCode);

  const { createAdminClient } = await import("@/lib/supabase/admin");
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { items: getLocalFlyerItems(), source: "seed", refreshed: false };
  }

  type CachedRow = {
    id: string;
    item_name: string;
    price: number;
    image: string;
    sale_story: string;
    fetched_at?: string;
    valid_to?: string;
    external_id?: string;
    category?: string | null;
  };

  let cached: CachedRow[] | null = null;
  const withCat = await admin
    .from("items")
    .select("id, item_name, price, image, sale_story, fetched_at, valid_to, external_id, category")
    .eq("postal_code", postal)
    .order("item_name");

  if (!withCat.error && withCat.data) {
    cached = withCat.data as unknown as CachedRow[];
  } else {
    const withoutCat = await admin
      .from("items")
      .select("id, item_name, price, image, sale_story, fetched_at, valid_to, external_id")
      .eq("postal_code", postal)
      .order("item_name");
    cached = (withoutCat.data as unknown as CachedRow[]) ?? null;
  }

  const newest = cached?.[0]?.fetched_at as string | undefined;
  const validTo = cached?.[0]?.valid_to as string | undefined;
  const fresh = Boolean(cached?.length) && isFlyerFresh(newest, validTo);

  if (!input.forceRefresh && fresh && cached) {
    const validItems = cached.filter((row) => isGroceryName(row.item_name));
    return {
      items: validItems.map((row) => ({
        id: row.id,
        item_name: row.item_name,
        price: Number(row.price),
        image: row.image,
        sale_story: row.sale_story,
        category: row.category ?? categorizeGroceryItem(row.item_name),
      })),
      source: "cache",
      refreshed: false,
    };
  }

  try {
    const scraped = await fetchFlippItems(postal);
    if (!scraped.length) {
      if (cached?.length) {
        const validItems = cached.filter((row) => isGroceryName(row.item_name));
        return {
          items: validItems.map((row) => ({
            id: row.id,
            item_name: row.item_name,
            price: Number(row.price),
            image: row.image,
            sale_story: row.sale_story,
            category: row.category ?? categorizeGroceryItem(row.item_name),
          })),
          source: "cache",
          refreshed: false,
        };
      }
      return { items: getLocalFlyerItems(), source: "seed", refreshed: false };
    }

    await admin.from("items").delete().eq("postal_code", postal);

    const now = new Date().toISOString();
    const rowsWithCat = scraped.map((item) => ({
      postal_code: postal,
      external_id: item.external_id ?? null,
      item_name: item.item_name,
      price: item.price,
      image: item.image,
      sale_story: item.sale_story,
      category: item.category ?? resolveGroceryCategory(item.item_name),
      valid_from: item.valid_from,
      valid_to: item.valid_to,
      fetched_at: now,
    }));

    const { error: insertErr } = await admin.from("items").insert(rowsWithCat);
    if (insertErr) {
      // If table doesn't have category column yet, fall back to insert without it
      const rowsWithoutCat = rowsWithCat.map(({ category: _, ...rest }) => rest);
      await admin.from("items").insert(rowsWithoutCat);
    }

    return {
      items: scraped.map((item, index) => ({
        id: item.external_id ?? `scraped-${index}`,
        item_name: item.item_name,
        price: item.price,
        image: item.image,
        sale_story: item.sale_story,
        category: item.category ?? resolveGroceryCategory(item.item_name),
      })),
      source: "scrape",
      refreshed: true,
    };
  } catch (error) {
    console.error("Flyer scrape failed:", error);
    if (cached?.length) {
      const validItems = cached.filter((row) => isGroceryName(row.item_name));
      return {
        items: validItems.map((row) => ({
          id: row.id,
          item_name: row.item_name,
          price: Number(row.price),
          image: row.image,
          sale_story: row.sale_story,
          category: row.category ?? categorizeGroceryItem(row.item_name),
        })),
        source: "cache",
        refreshed: false,
      };
    }
    return { items: getLocalFlyerItems(), source: "seed", refreshed: false };
  }
}
