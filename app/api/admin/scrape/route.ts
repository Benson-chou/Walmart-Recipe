import { NextResponse } from "next/server";
import { getCachedOrFreshItems } from "@/lib/flyer-scrape";
import { getCronSecret, getScrapeSecret, isProduction } from "@/lib/env";
import { cleanZipCode, DEFAULT_ZIP } from "@/lib/location";

function authorize(request: Request): boolean {
  const scrapeSecret = getScrapeSecret();
  const cronSecret = getCronSecret();
  const headerSecret = request.headers.get("x-scrape-secret");
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (scrapeSecret && headerSecret === scrapeSecret) return true;
  if (cronSecret && bearer === cronSecret) return true;
  return false;
}

/**
 * Manual flyer refresh. Requires x-scrape-secret or Bearer CRON_SECRET.
 */
export async function POST(request: Request) {
  if (!authorize(request)) {
    const hint =
      isProduction() && !getScrapeSecret()
        ? "SCRAPE_SECRET is missing or still set to a placeholder"
        : "Unauthorized";
    return NextResponse.json({ message: hint }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const postal = cleanZipCode(String(body.zip || body.postal || DEFAULT_ZIP));
    const result = await getCachedOrFreshItems({
      postalCode: postal,
      forceRefresh: true,
    });
    return NextResponse.json({
      message: "Flyer refreshed",
      zip: postal,
      count: result.items.length,
      source: result.source,
    });
  } catch (error) {
    console.error("admin scrape failed:", error);
    return NextResponse.json({ message: "Scrape failed" }, { status: 500 });
  }
}
