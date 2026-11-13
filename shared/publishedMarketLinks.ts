export type PublishedZipLink = { path: string; label: string };

export type PublishedSaleLink = PublishedZipLink & { price: number; date: string };
