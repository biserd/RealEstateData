/** Counts displayed on the public homepage, with deliberately distinct grains. */
export interface HomepageStats {
  publishedAt: string;
  saleBackedUnits: number;
  publicProperties: number;
  recordedSaleRows: number;
  publishedMarketSnapshots: number;
  approvedDataFeeds: number;
}
