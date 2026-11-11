import { z } from "zod";
import { BASE_GUIDES } from "../shared/guides";

export const SITE = "https://realtorsdashboard.com";

export const VENDORS = {
  zillow: { label: "Zillow Zestimate methodology", url: "https://www.zillow.com/zestimate/" },
  redfin: { label: "Redfin Estimate methodology", url: "https://www.redfin.com/redfin-estimate" },
  propstream: { label: "PropStream product features", url: "https://www.propstream.com/propstream-features" },
} as const;

export type Vendor = keyof typeof VENDORS;
export const METHODOLOGY = { label: "Realtors Dashboard methodology", url: SITE + "/methodology/data-coverage" };
export const PUBLIC_RECORDS = {
  label: "NYC Department of Finance rolling sales",
  url: "https://www.nyc.gov/site/finance/property/property-rolling-sales-update.page",
};
const ALLOWED_SOURCES = [METHODOLOGY, PUBLIC_RECORDS, ...Object.values(VENDORS)];

const plain = (min: number, max: number) =>
  z.string().trim().min(min).max(max).refine((value) => !/[<>$\x00-\x1f]/.test(value));
const title = plain(18, 85);
const metaTitle = plain(20, 62);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(90);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => Number.isFinite(Date.parse(value)));
const source = z.object({ label: plain(4, 120), url: z.string().url() }).strict()
  .refine((entry) => ALLOWED_SOURCES.some((allowed) => entry.url === allowed.url && entry.label === allowed.label));
const section = z.object({ heading: plain(10, 95), body: plain(250, 1000) }).strict();

const entry = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("title"), slug, date, title, metaTitle }).strict(),
  z.object({
    kind: z.literal("refresh"), slug, date, sections: z.array(section).min(1).max(2),
    sources: z.array(source).min(1).max(2),
  }).strict(),
  z.object({
    kind: z.literal("comparison"), slug, date, title, metaTitle,
    metaDescription: plain(70, 158), keyword: plain(8, 100), intro: plain(100, 500),
    sections: z.array(section).min(3).max(4), sources: z.array(source).length(2),
    relatedSlug: slug,
  }).strict(),
]);

const baseSlugs = new Set(BASE_GUIDES.map((guide) => guide.slug));

export const editorial = z.array(entry).max(64).superRefine((entries, context) => {
  const seen = new Set<string>();
  for (const [index, edit] of entries.entries()) {
    const key = edit.kind + ":" + edit.slug;
    const comparison = edit.kind === "comparison";
    const vendor = comparison && Object.keys(VENDORS).find((name) => edit.slug === "realtors-dashboard-vs-" + name);
    const valid = comparison
      ? vendor && baseSlugs.has(edit.relatedSlug) && edit.sources.some((item) => item.url === VENDORS[vendor as Vendor].url)
        && edit.sources.some((item) => item.url === METHODOLOGY.url)
      : baseSlugs.has(edit.slug);
    if (!valid || seen.has(key)) {
      context.addIssue({ code: "custom", path: [index], message: "Unapproved or duplicate editorial target" });
    }
    seen.add(key);
  }
});

export type Edit = z.infer<typeof entry>;

export function validateUpdate(previous: Edit[], next: Edit[], today: string) {
  const key = (edit: Edit) => edit.kind + ":" + edit.slug;
  const after = new Map(next.map((edit) => [key(edit), edit]));
  if (previous.some((edit) => !after.has(key(edit)))) throw new Error("An existing editorial entry was removed");
  const before = new Map(previous.map((edit) => [key(edit), JSON.stringify(edit)]));
  const edits = next.filter((edit) => before.get(key(edit)) !== JSON.stringify(edit));
  if (edits.some((edit) => edit.date !== today || (edit.kind === "comparison" && before.has(key(edit))))
      || new Set(edits.map((edit) => edit.kind)).size !== edits.length) {
    throw new Error("Editorial update exceeds the daily limits");
  }
  return edits;
}
