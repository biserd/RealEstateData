const BOROUGH_CODES: Record<string, string> = {
  "1": "1",
  manhattan: "1",
  "new york": "1",
  "2": "2",
  bronx: "2",
  "3": "3",
  brooklyn: "3",
  kings: "3",
  "4": "4",
  queens: "4",
  "5": "5",
  "staten island": "5",
  richmond: "5",
};

export function normalizeBoroughCode(value: unknown): string | null {
  const key = String(value ?? "").trim().toLowerCase();
  return BOROUGH_CODES[key] ?? null;
}

export function buildNycBbl(
  borough: unknown,
  block: unknown,
  lot: unknown,
): string | null {
  const boro = normalizeBoroughCode(borough);
  const blockDigits = String(block ?? "").replace(/\D/g, "");
  const lotDigits = String(lot ?? "").replace(/\D/g, "");
  if (!boro || !blockDigits || !lotDigits) return null;
  if (blockDigits.length > 5 || lotDigits.length > 4) return null;
  return `${boro}${blockDigits.padStart(5, "0")}${lotDigits.padStart(4, "0")}`;
}

export function parseMoney(value: unknown): number | null {
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded >= 50_000 && rounded <= 100_000_000 ? rounded : null;
}

export function normalizeUnitDesignation(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/^UNIT\s+/i, "");
  return normalized || null;
}

export function classifyUnitType(value: unknown): "residential" | "parking" | "storage" | "commercial" | "other" {
  const unit = String(value ?? "").trim().toLowerCase();
  if (/park|garage|space/.test(unit)) return "parking";
  if (/storage|locker/.test(unit)) return "storage";
  if (/commercial|retail|office|store/.test(unit)) return "commercial";
  if (!unit) return "other";
  return "residential";
}

export function buildUnitSlug(input: {
  unitBbl: string;
  buildingAddress?: string | null;
  unitDesignation?: string | null;
  borough?: string | null;
}): string {
  const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
  const parts = [
    input.buildingAddress ? clean(input.buildingAddress).slice(0, 60) : null,
    `unit-${clean(input.unitDesignation || input.unitBbl.slice(-4))}`,
    input.borough ? clean(input.borough).replace(/-/g, "") : null,
    input.unitBbl.slice(-9),
  ];
  return parts.filter(Boolean).join("-");
}

export function saleFingerprint(input: {
  saleDate: Date;
  salePrice: number;
  borough?: unknown;
  block?: unknown;
  lot?: unknown;
  address?: unknown;
  unit?: unknown;
}): string {
  const date = input.saleDate.toISOString().slice(0, 10);
  const address = String(input.address ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const unit = normalizeUnitDesignation(input.unit) ?? "";
  return [
    date,
    input.salePrice,
    normalizeBoroughCode(input.borough) ?? "",
    String(input.block ?? "").replace(/\D/g, ""),
    String(input.lot ?? "").replace(/\D/g, ""),
    address,
    unit,
  ].join("|");
}
