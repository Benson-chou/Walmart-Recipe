import { NextResponse } from "next/server";
import { getCachedOrFreshItems } from "@/lib/flyer-scrape";
import { cleanZipCode } from "@/lib/location";

export async function POST(request: Request) {
  const secret = process.env.SCRAPE_SECRET;
  const header = request.headers.get("x-scrape-secret");
  if (!secret || header !== secret) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const postal = cleanZipCode(String(body.zip || body.postal || ""));
    const result = await getCachedOrFreshItems({
      postalCode: postal,
      forceRefresh: true,
    });
    return NextResponse.json({
      message: "Flyer refreshed",
      count: result.items.length,
      source: result.source,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Scrape failed" }, { status: 500 });
  }
}
