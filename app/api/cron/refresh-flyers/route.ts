import { NextResponse } from "next/server";
import { getCachedOrFreshItems } from "@/lib/flyer-scrape";
import { getCronSecret } from "@/lib/env";
import { DEFAULT_ZIP } from "@/lib/location";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron: refresh default ZIP flyer cache on a schedule.
 * Auth: Authorization: Bearer <CRON_SECRET|SCRAPE_SECRET>
 *
 * Configure in vercel.json. Optionally set CRON_ZIPS=90210,10001,60601
 */
export async function GET(request: Request) {
  const cronSecret = getCronSecret();
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const headerSecret = request.headers.get("x-scrape-secret");

  if (!cronSecret || (bearer !== cronSecret && headerSecret !== cronSecret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const zipList = (process.env.CRON_ZIPS || DEFAULT_ZIP)
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean)
    .slice(0, 5);

  const results: Array<{ zip: string; count: number; source: string }> = [];

  for (const zip of zipList) {
    try {
      const result = await getCachedOrFreshItems({
        postalCode: zip,
        forceRefresh: true,
      });
      results.push({ zip, count: result.items.length, source: result.source });
    } catch (error) {
      console.error(`cron refresh failed for ${zip}:`, error);
      results.push({ zip, count: 0, source: "error" });
    }
  }

  return NextResponse.json({
    message: "Cron flyer refresh complete",
    results,
  });
}
