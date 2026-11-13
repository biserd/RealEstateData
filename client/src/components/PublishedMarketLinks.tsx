import { useQuery } from "@tanstack/react-query";
import type { PublishedSaleLink, PublishedZipLink } from "@shared/publishedMarketLinks";

const price = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
});

export function PublishedZipReports() {
  const { data } = useQuery<PublishedZipLink[]>({
    queryKey: ["/api/browse/published-zips"],
  });
  if (!data?.length) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-semibold">Published NYC ZIP reports</h2>
      <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {data.map(({ path, label }) => (
          <li key={path}><a className="underline underline-offset-2" href={path}>{label}</a></li>
        ))}
      </ul>
    </section>
  );
}

function SaleRows({ records }: { records: PublishedSaleLink[] }) {
  return (
    <ul className="mt-3 divide-y text-sm">
      {records.map((record) => (
        <li key={record.path} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
          <a className="underline underline-offset-2" href={record.path}>{record.label}</a>
          <span className="text-muted-foreground">{price.format(record.price)} · {record.date}</span>
        </li>
      ))}
    </ul>
  );
}

export function PublishedZipSales({ zip }: { zip: string }) {
  const { data } = useQuery<PublishedSaleLink[]>({
    queryKey: ["/api/browse/published-sales", zip],
  });
  if (!data?.length) return null;
  const remaining = data.length - 12;
  return (
    <section className="my-8">
      <h2 className="mb-2 text-xl font-semibold">Published sales in ZIP {zip}</h2>
      <p className="text-sm text-muted-foreground">Most recent verified sale per property or condo unit.</p>
      <SaleRows records={data.slice(0, 12)} />
      {remaining > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium">Show {remaining} more records</summary>
          <SaleRows records={data.slice(12)} />
        </details>
      )}
      <a className="mt-4 inline-block text-sm underline underline-offset-2" href="/browse/ny">
        Browse all published NYC ZIP reports
      </a>
    </section>
  );
}
