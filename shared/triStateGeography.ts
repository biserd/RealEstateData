export type TriStateCode = "NY" | "NJ" | "CT";

export function normalizeZipCode(value: string | null | undefined): string | null {
  const zip = String(value || "").trim().slice(0, 5);
  return /^\d{5}$/.test(zip) ? zip : null;
}

/**
 * Conservative ZIP-to-state fallback for the application's NY/NJ/CT scope.
 * Canonical database geography remains authoritative; this helper is used only
 * when an exact ZIP has no published rows from which to derive its state.
 */
export function inferTriStateFromZip(value: string | null | undefined): TriStateCode | null {
  const zip = normalizeZipCode(value);
  if (!zip) return null;

  if (zip === "00501" || zip === "00544" || zip === "06390") return "NY";
  const prefix = Number(zip.slice(0, 3));
  if (prefix >= 60 && prefix <= 69) return "CT";
  if (prefix >= 70 && prefix <= 89) return "NJ";
  if (prefix >= 100 && prefix <= 149) return "NY";
  return null;
}

export function stateName(code: string | null | undefined): string {
  if (code === "NY") return "New York";
  if (code === "NJ") return "New Jersey";
  if (code === "CT") return "Connecticut";
  return code || "Tri-State area";
}
