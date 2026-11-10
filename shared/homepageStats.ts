/** Counts displayed on the public homepage, with deliberately distinct grains. */
export interface HomepageStats {
  publishedAt: string;
  snapshotStatus?: "current" | "last_known";
  saleBackedUnits: number;
  publicProperties: number;
  recordedSaleRows: number;
  publishedMarketSnapshots: number;
  approvedDataFeeds: number;
}
