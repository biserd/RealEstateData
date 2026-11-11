import assert from "node:assert/strict";
import test from "node:test";
import { BASE_GUIDES } from "../../shared/guides";
import { googlebotAllows } from "../seo-audit-live";
import { editorial, validateUpdate } from "../seo-editorial";

const date = "2026-11-11";
const title = {
  kind: "title", slug: BASE_GUIDES[0].slug, date,
  title: "How to research recorded NYC condo sales",
  metaTitle: "Researching recorded NYC condo sales",
};

test("automated editorial output can only change validated published targets", () => {
  const edits = editorial.parse([title]);
  assert.deepEqual(validateUpdate([], edits, date), edits);
  assert.equal(editorial.safeParse([{ ...title, slug: "up-and-coming-zip-codes-nj-ct" }]).success, false);
  assert.equal(editorial.safeParse([{ ...title, title: "<iframe>Invalid markup</iframe>" }]).success, false);
  assert.equal(editorial.safeParse([{ ...title, extra: "unexpected content" }]).success, false);
  assert.equal(editorial.safeParse([title, title]).success, false);
  assert.throws(() => validateUpdate(edits, [], date));
  assert.throws(() => validateUpdate([], edits, "2026-11-12"));
});

test("Googlebot rules override the wildcard group and honor the longest matching path", () => {
  const rules = "User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\nDisallow: /private*\nAllow: /private/public$";
  assert.equal(googlebotAllows(rules, "/guides"), true);
  assert.equal(googlebotAllows(rules, "/private/info"), false);
  assert.equal(googlebotAllows(rules, "/private/public"), true);
  assert.equal(googlebotAllows(rules, "/private/public/archive"), false);
});
