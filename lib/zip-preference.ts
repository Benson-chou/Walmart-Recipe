import { cleanZipCode, DEFAULT_ZIP, isValidUsZip } from "@/lib/location";
import type { FlyerItem } from "@/lib/types";

export const ZIP_COOKIE = "walmart_zip";
const ZIP_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type FlyerSource = "cache" | "scrape" | "seed" | "db";

export function parseStoredZip(value: string | undefined | null): string | null {
  if (!value) return null;
  let raw = value.trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Cookie values are not always encoded.
  }
  const cleaned = cleanZipCode(raw);
  return isValidUsZip(cleaned) ? cleaned : null;
}

export function resolveZip(
  profileZip?: string | null,
  cookieZip?: string | null
): string {
  return parseStoredZip(profileZip) ?? parseStoredZip(cookieZip) ?? DEFAULT_ZIP;
}

export function readZipCookie(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${ZIP_COOKIE}=`;
  const row = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  if (!row) return null;
  return parseStoredZip(row.slice(prefix.length));
}

export function writeZipCookie(zip: string) {
  if (typeof document === "undefined") return;
  const cleaned = parseStoredZip(zip);
  if (!cleaned) return;
  document.cookie = `${ZIP_COOKIE}=${encodeURIComponent(cleaned)}; Path=/; Max-Age=${ZIP_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export async function persistZipPreference(
  zip: string,
  options: { loggedIn: boolean }
): Promise<string> {
  const cleaned = parseStoredZip(zip);
  if (!cleaned) {
    throw new Error("Enter a valid US ZIP code (e.g. 90210).");
  }

  if (options.loggedIn) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferred_location: cleaned }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(data.message || "Could not save ZIP to your profile.");
    }
  }

  writeZipCookie(cleaned);
  return cleaned;
}

export async function fetchFlyerForZip(zip: string): Promise<{
  items: FlyerItem[];
  source: FlyerSource;
}> {
  const res = await fetch(`/api/items?postal=${encodeURIComponent(zip)}`);
  if (!res.ok) {
    throw new Error("Could not load flyer deals for that ZIP.");
  }
  const data = (await res.json()) as {
    items?: FlyerItem[];
    source?: FlyerSource;
  };
  return {
    items: Array.isArray(data.items) ? data.items : [],
    source: data.source ?? "seed",
  };
}
