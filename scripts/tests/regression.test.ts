import assert from "node:assert/strict";
import test from "node:test";
import { canonicalRedirectTarget, isDatabaseBackedPagePath } from "../../server/entityPagePolicy";
import {
  buildNycBbl,
  classifyUnitType,
  normalizeUnitDesignation,
  parseMoney,
  saleFingerprint,
} from "../lib/real-estate-normalization";

test("database-backed URL policy recognizes only supported entity pages", () => {
  assert.equal(isDatabaseBackedPagePath("/unit/example-123"), true);
  assert.equal(isDatabaseBackedPagePath("/properties/abc"), true);
  assert.equal(isDatabaseBackedPagePath("/building/1012345678"), true);
  assert.equal(isDatabaseBackedPagePath("/unit/"), false);
  assert.equal(isDatabaseBackedPagePath("/guides/example"), false);
});

test("legacy entity URLs redirect only when the canonical path differs", () => {
  assert.equal(canonicalRedirectTarget("/unit/1012345678", "/unit/canonical-1012345678"), "/unit/canonical-1012345678");
  assert.equal(canonicalRedirectTarget("/unit/canonical-1012345678", "/unit/canonical-1012345678"), null);
});

test("NYC identifiers are normalized without inventing data", () => {
  assert.equal(buildNycBbl("Manhattan", "1515", "1552"), "1015151552");
  assert.equal(buildNycBbl("unknown", "1515", "1552"), null);
  assert.equal(normalizeUnitDesignation("Unit e4a"), "E4A");
});

test("source values are validated and deterministic", () => {
  assert.equal(parseMoney("$1,250,000.00"), 1_250_000);
  assert.equal(parseMoney("$0"), null);
  assert.equal(classifyUnitType("Parking Space P2"), "parking");
  assert.equal(classifyUnitType("4A"), "residential");

  const input = {
    saleDate: new Date("2026-07-01T00:00:00.000Z"),
    salePrice: 1_250_000,
    borough: "Manhattan",
    block: "1515",
    lot: "1552",
    address: "120 East 87 Street",
    unit: "E4A",
  };
  assert.equal(saleFingerprint(input), saleFingerprint(input));
});
