import { NextResponse } from "next/server";
import { getCachedOrFreshItems } from "@/lib/flyer-scrape";
import { getLocalFlyerItems } from "@/lib/flyer";
import { isSupabaseConfigured } from "@/lib/env";
import { cleanZipCode } from "@/lib/location";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postal = cleanZipCode(searchParams.get("postal") || searchParams.get("zip") || "");
  const forceRefresh = searchParams.get("refresh") === "1";

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: getLocalFlyerItems(), source: "seed", refreshed: false });
  }

  try {
    const result = await getCachedOrFreshItems({
      postalCode: postal,
      forceRefresh,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ items: getLocalFlyerItems(), source: "seed", refreshed: false });
  }
}
