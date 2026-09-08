/** Default ZIP when the user has not set a location (Beverly Hills, CA — Flipp sample). */
export const DEFAULT_ZIP = "90210";

export const FLYER_LOCALE = "en-us";
export const FLYER_MERCHANT = "walmart";
/** Flipp merchant id for Walmart US weekly ads. */
export const FLYER_MERCHANT_ID = 2175;

/** 5-digit ZIP or ZIP+4 (e.g. 90210 or 90210-1234). */
export const US_ZIP_PATTERN = /^\d{5}(?:-\d{4})?$/;

export function cleanZipCode(zip: string): string {
  const trimmed = zip.trim();
  if (!trimmed) return DEFAULT_ZIP;
  const digits = trimmed.replace(/\s+/g, "");
  if (/^\d{5}\d{4}$/.test(digits)) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

export function isValidUsZip(zip: string): boolean {
  return US_ZIP_PATTERN.test(cleanZipCode(zip));
}
