import type { HomepageStats } from "../shared/homepageStats";

// Verified against production D1 for the November 11 manual publication.
// Refresh this snapshot with each manually published dataset. The version check
// in storage prevents presenting these counts as current after publication.
export const publishedHomepageSnapshot: HomepageStats & { datasetVersionId: string } = {
  datasetVersionId: "8841c249-c675-4ff8-8fb5-f8c0c8b9b59b",
  publishedAt: "2026-11-11T14:26:07.975000Z",
  saleBackedUnits: 12_093,
  publicProperties: 3_461,
  recordedSaleRows: 62_712,
  publishedMarketSnapshots: 105,
  approvedDataFeeds: 2,
  snapshotStatus: "current",
};
