import type { HomepageStats } from "../shared/homepageStats";

// Verified against production D1 for the October 24 manual publication.
// Refresh this snapshot with each manually published dataset. The version check
// in storage prevents presenting these counts as current after publication.
export const publishedHomepageSnapshot: HomepageStats & { datasetVersionId: string } = {
  datasetVersionId: "f02859ed-2743-439d-afbb-bb7f8eb7429b",
  publishedAt: "2026-10-24T23:59:30.363000Z",
  saleBackedUnits: 12_186,
  publicProperties: 3_436,
  recordedSaleRows: 62_343,
  publishedMarketSnapshots: 105,
  approvedDataFeeds: 2,
  snapshotStatus: "current",
};
