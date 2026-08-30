import { FormEvent, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Database,
  Gauge,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { MarketingLayout } from "@/components/layouts";
import { SEO } from "@/components/SEO";
import { JsonLd } from "@/components/JsonLd";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DataEnvelope, DataFreshness } from "@shared/dataEnvelope";
import type { MarketAggregate, Property, Sale, UpAndComingZip } from "@shared/schema";

const SITE_URL = "https://realtorsdashboard.com";

const toolDefinitions = [
  {
    href: "/tools/nyc-zip-market-snapshot",
    title: "NYC ZIP Market Snapshot",
    description: "Check recorded-sale pricing, transaction count, price range, and recent verified transfers for an eligible ZIP.",
    icon: BarChart3,
  },
  {
    href: "/tools/nyc-price-per-square-foot",
    title: "NYC Price per Square Foot Benchmark",
    description: "Compare a property price and size with the published recorded-sale benchmark for an eligible NYC ZIP.",
    icon: Calculator,
  },
  {
    href: "/tools/nyc-neighborhood-momentum",
    title: "NYC Neighborhood Momentum Checker",
    description: "Find an eligible ZIP's current rank, recorded-price trend, transaction depth, and momentum classification.",
    icon: Gauge,
  },
] as const;

function currency(value: number | null | undefined, maximumFractionDigits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value);
}

function integer(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-US").format(value);
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not available";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function dateLabel(value: string | Date | null | undefined) {
  if (!value) return "Not reported";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not reported";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function preferredAggregate(records: MarketAggregate[]) {
  return records.find((record) => !record.propertyType && !record.bedsBand && !record.bathsBand && !record.yearBuiltBand && !record.sizeBand)
    ?? records[0];
}

async function fetchEnvelope<T>(url: string): Promise<DataEnvelope<T>> {
  const response = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.json() as Promise<DataEnvelope<T>>;
}

function FreshnessPanel({ freshness, observed }: { freshness: DataFreshness; observed: number }) {
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4" data-testid="tool-freshness">
      <div><span className="block text-muted-foreground">Source through</span><strong>{dateLabel(freshness.sourceDate)}</strong></div>
      <div><span className="block text-muted-foreground">Published</span><strong>{dateLabel(freshness.publishedAt)}</strong></div>
      <div><span className="block text-muted-foreground">Dataset version</span><strong className="break-all">{freshness.datasetVersion || "Not reported"}</strong></div>
      <div><span className="block text-muted-foreground">Observed sample</span><strong>{integer(observed)}</strong></div>
    </div>
  );
}

function ToolIntro({ title, description, icon: Icon }: { title: string; description: string; icon: typeof Search }) {
  return (
    <div className="max-w-3xl">
      <Badge variant="secondary" className="mb-4">Free NYC data tool</Badge>
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-7 w-7" /></div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      </div>
      <p className="text-lg text-muted-foreground">{description}</p>
    </div>
  );
}

function ZipForm({
  initialZip,
  buttonLabel,
  onSubmit,
  children,
}: {
  initialZip: string;
  buttonLabel: string;
  onSubmit: (zip: string) => void;
  children?: ReactNode;
}) {
  const [zip, setZip] = useState(initialZip);
  const [validation, setValidation] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = zip.trim();
    if (!/^\d{5}$/.test(normalized)) {
      setValidation("Enter a five-digit ZIP code.");
      return;
    }
    setValidation(null);
    onSubmit(normalized);
  };

  return (
    <form onSubmit={submit} className="mt-8 rounded-xl border bg-card p-5 shadow-sm" data-testid="tool-zip-form">
      <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-2">
          <Label htmlFor="tool-zip">NYC ZIP code</Label>
          <Input
            id="tool-zip"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={zip}
            onChange={(event) => setZip(event.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="Example: 10001"
            aria-describedby={validation ? "tool-zip-error" : undefined}
            data-testid="input-tool-zip"
          />
          {validation ? <p id="tool-zip-error" className="text-sm text-destructive">{validation}</p> : null}
        </div>
        <Button type="submit" size="lg" data-testid="button-run-tool">
          <Search className="mr-2 h-4 w-4" />{buttonLabel}
        </Button>
      </div>
      {children}
    </form>
  );
}

function CoverageGap({ zip, reason }: { zip: string; reason?: string | null }) {
  return (
    <Alert className="mt-8" data-testid="tool-coverage-gap">
      <ShieldCheck className="h-4 w-4" />
      <AlertTitle>No exact published result for ZIP {zip}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{reason || "This ZIP does not currently pass the published-data coverage and quality gates."}</p>
        <p>We will not substitute state-wide or unrelated data and label it as ZIP-specific.</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/up-and-coming"><Button variant="outline" size="sm">Browse eligible ZIPs</Button></Link>
          <Link href="/methodology/data-coverage"><Button variant="ghost" size="sm">Read coverage methodology</Button></Link>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function ToolDisclosure() {
  return (
    <section className="mt-12 rounded-xl border bg-muted/20 p-6">
      <h2 className="text-xl font-semibold">What this tool does—and does not do</h2>
      <div className="mt-4 grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
        <p><strong className="text-foreground">Recorded data:</strong> Results use the current manually published NYC recorded-sales snapshot, not live listings.</p>
        <p><strong className="text-foreground">Exact geography:</strong> A ZIP result appears only when the API reports an exact match. Broader fallbacks are rejected.</p>
        <p><strong className="text-foreground">Research only:</strong> Benchmarks and momentum scores are not appraisals, predictions, offers, or financial advice.</p>
      </div>
    </section>
  );
}

function ToolsHub() {
  return (
    <MarketingLayout>
      <SEO
        title="Free NYC Real Estate Data Tools"
        description="Free text-first tools for NYC ZIP recorded-sale snapshots, price-per-square-foot benchmarks, and neighborhood momentum checks."
        canonicalUrl={`${SITE_URL}/tools`}
      />
      <JsonLd id="tools-hub-jsonld" data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Free NYC Real Estate Data Tools",
        itemListElement: toolDefinitions.map((tool, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: tool.title,
          url: `${SITE_URL}${tool.href}`,
        })),
      }} />
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-4"><Sparkles className="mr-1 h-3.5 w-3.5" />No signup required</Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Free NYC real estate data tools</h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Answer a focused market question with the current published recorded-sales dataset—without a map, opaque estimate, or hidden geographic fallback.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {toolDefinitions.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card key={tool.href} className="flex h-full flex-col" data-testid={`card-tool-${tool.href.split("/").pop()}`}>
                <CardHeader>
                  <div className="mb-3 w-fit rounded-lg bg-primary/10 p-3 text-primary"><Icon className="h-6 w-6" /></div>
                  <CardTitle>{tool.title}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Link href={tool.href}><Button className="w-full">Open free tool<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <ToolDisclosure />
      </div>
    </MarketingLayout>
  );
}

function useInitialZip() {
  const search = useSearch();
  const value = new URLSearchParams(search).get("zip") || "";
  return /^\d{5}$/.test(value) ? value : "";
}

function setToolUrl(path: string, zip: string) {
  window.history.replaceState(null, "", `${path}?zip=${encodeURIComponent(zip)}`);
}

function ZipSnapshot() {
  const initialZip = useInitialZip();
  const [zip, setZip] = useState(initialZip);
  const aggregateQuery = useQuery<DataEnvelope<MarketAggregate>>({
    queryKey: ["tool", "zip-snapshot", zip, "aggregate"],
    queryFn: () => fetchEnvelope(`/api/market/aggregates?geoType=zip&geoId=${encodeURIComponent(zip)}&envelope=1`),
    enabled: Boolean(zip),
    retry: 2,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2_000),
  });
  const salesQuery = useQuery<DataEnvelope<Sale & { property: Property }>>({
    queryKey: ["tool", "zip-snapshot", zip, "sales"],
    queryFn: () => fetchEnvelope(`/api/market/recent-sales?geoType=zip&geoId=${encodeURIComponent(zip)}&limit=5&envelope=1`),
    enabled: Boolean(zip),
    retry: 2,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2_000),
  });
  const aggregate = aggregateQuery.data ? preferredAggregate(aggregateQuery.data.records) : undefined;
  const exact = aggregateQuery.data?.matchMode === "exact" && Boolean(aggregate);
  const run = (nextZip: string) => { setZip(nextZip); setToolUrl("/tools/nyc-zip-market-snapshot", nextZip); };

  return (
    <MarketingLayout>
      <SEO title="NYC ZIP Market Snapshot Tool" description="Check exact published NYC ZIP recorded-sale prices, price per square foot, transaction count, range, and data freshness." canonicalUrl={`${SITE_URL}/tools/nyc-zip-market-snapshot`} />
      <JsonLd id="zip-snapshot-jsonld" data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "NYC ZIP Market Snapshot", applicationCategory: "BusinessApplication", operatingSystem: "Web", url: `${SITE_URL}/tools/nyc-zip-market-snapshot`, isAccessibleForFree: true }} />
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
        <ToolIntro icon={BarChart3} title="NYC ZIP Market Snapshot" description="Enter a ZIP to see the exact published recorded-sale benchmark, sample depth, price distribution, trend, and recent transfers." />
        <ZipForm initialZip={initialZip} buttonLabel="Get snapshot" onSubmit={run} />
        {aggregateQuery.isLoading && zip ? <p className="mt-8 text-muted-foreground">Loading the current published snapshot…</p> : null}
        {aggregateQuery.isError && zip ? <Alert variant="destructive" className="mt-8"><AlertTitle>Snapshot temporarily unavailable</AlertTitle><AlertDescription>The market snapshot request failed after multiple attempts. Please try again.</AlertDescription></Alert> : null}
        {aggregateQuery.data && !exact ? <CoverageGap zip={zip} reason={aggregateQuery.data.fallbackReason} /> : null}
        {exact && aggregateQuery.data && aggregate ? (
          <section className="mt-8 space-y-6" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-2xl font-semibold">ZIP {zip} recorded-sale snapshot</h2><p className="text-sm text-muted-foreground">Exact geography match · {aggregate.geoName}</p></div>
              <Badge variant={aggregateQuery.data.freshness.stale ? "destructive" : "secondary"}>{aggregateQuery.data.freshness.stale ? "Stale snapshot" : "Current publication"}</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Median recorded price" value={currency(aggregate.medianPrice)} />
              <Metric label="Median recorded $/sq ft" value={currency(aggregate.medianPricePerSqft)} />
              <Metric label="Recorded transactions" value={integer(aggregate.transactionCount)} />
              <Metric label="6-month recorded trend" value={percent(aggregate.trend6m)} trend={aggregate.trend6m} />
            </div>
            <Card><CardHeader><CardTitle>Recorded price range</CardTitle><CardDescription>The 25th-to-75th percentile range in this published aggregate.</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{currency(aggregate.p25Price)} – {currency(aggregate.p75Price)}</CardContent></Card>
            <FreshnessPanel freshness={aggregateQuery.data.freshness} observed={aggregate.transactionCount ?? aggregateQuery.data.coverage.observedSampleSize} />
            <Card>
              <CardHeader><CardTitle>Recent verified transfers</CardTitle><CardDescription>Up to five exact-ZIP records from the same publication.</CardDescription></CardHeader>
              <CardContent>
                {salesQuery.isLoading ? <p className="text-muted-foreground">Loading recent transfers…</p> : salesQuery.isError ? <p className="text-muted-foreground">The recent-transfer sample is temporarily unavailable. The market snapshot above is still valid.</p> : salesQuery.data?.matchMode === "exact" && salesQuery.data.records.length ? (
                  <div className="divide-y">
                    {salesQuery.data.records.map((sale) => (
                      <div key={sale.id} className="grid gap-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-6">
                        <div><strong>{sale.property.address}{sale.property.unit ? `, ${sale.property.unit}` : ""}</strong><p className="text-sm text-muted-foreground">{sale.property.propertyType}</p></div>
                        <span>{dateLabel(sale.saleDate)}</span><strong>{currency(sale.salePrice)}</strong>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-muted-foreground">No exact-ZIP transfer sample is included in the current publication. The aggregate above remains available.</p>}
              </CardContent>
            </Card>
            <div className="flex flex-wrap gap-3"><Link href={`/neighborhood/${zip}?geoType=zip`}><Button>Open full ZIP report<ArrowRight className="ml-2 h-4 w-4" /></Button></Link><Link href="/methodology/data-coverage"><Button variant="outline">Review sources and coverage</Button></Link></div>
          </section>
        ) : null}
        <ToolDisclosure />
      </div>
    </MarketingLayout>
  );
}

function Metric({ label, value, trend }: { label: string; value: string; trend?: number | null }) {
  const TrendIcon = trend === undefined || trend === null ? null : trend >= 0 ? TrendingUp : TrendingDown;
  return <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 flex items-center gap-2 text-2xl font-semibold">{TrendIcon ? <TrendIcon className="h-5 w-5 text-primary" /> : null}{value}</p></CardContent></Card>;
}

function PpsfBenchmark() {
  const initialZip = useInitialZip();
  const [zip, setZip] = useState(initialZip);
  const [price, setPrice] = useState("");
  const [sqft, setSqft] = useState("");
  const [submitted, setSubmitted] = useState<{ price: number; sqft: number } | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const query = useQuery<DataEnvelope<MarketAggregate>>({
    queryKey: ["tool", "ppsf", zip],
    queryFn: () => fetchEnvelope(`/api/market/aggregates?geoType=zip&geoId=${encodeURIComponent(zip)}&envelope=1`),
    enabled: Boolean(zip && submitted),
    retry: 2,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2_000),
  });
  const aggregate = query.data ? preferredAggregate(query.data.records) : undefined;
  const exact = query.data?.matchMode === "exact" && Boolean(aggregate);
  const subjectPpsf = submitted ? submitted.price / submitted.sqft : null;
  const difference = subjectPpsf && aggregate?.medianPricePerSqft ? ((subjectPpsf / aggregate.medianPricePerSqft) - 1) * 100 : null;
  const positioning = difference === null ? "Comparison unavailable" : difference < -10 ? "Below the published median" : difference > 10 ? "Above the published median" : "Within 10% of the published median";

  const run = (nextZip: string) => {
    const parsedPrice = Number(price.replace(/[$,\s]/g, ""));
    const parsedSqft = Number(sqft.replace(/[,\s]/g, ""));
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0 || !Number.isFinite(parsedSqft) || parsedSqft <= 0) {
      setInputError("Enter a positive property price and square footage.");
      return;
    }
    setInputError(null); setZip(nextZip); setSubmitted({ price: parsedPrice, sqft: parsedSqft }); setToolUrl("/tools/nyc-price-per-square-foot", nextZip);
  };

  return (
    <MarketingLayout>
      <SEO title="NYC Price per Square Foot Benchmark" description="Calculate a property's price per square foot and compare it with an exact published NYC ZIP recorded-sale benchmark." canonicalUrl={`${SITE_URL}/tools/nyc-price-per-square-foot`} />
      <JsonLd id="ppsf-jsonld" data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "NYC Price per Square Foot Benchmark", applicationCategory: "FinanceApplication", operatingSystem: "Web", url: `${SITE_URL}/tools/nyc-price-per-square-foot`, isAccessibleForFree: true }} />
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
        <ToolIntro icon={Calculator} title="NYC Price per Square Foot Benchmark" description="Calculate your subject property's price per square foot and compare it with the current exact-ZIP recorded-sale median and interquartile range." />
        <ZipForm initialZip={initialZip} buttonLabel="Compare $/sq ft" onSubmit={run}>
          <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="tool-price">Property price</Label><Input id="tool-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$850,000" /></div>
            <div className="space-y-2"><Label htmlFor="tool-sqft">Interior square feet</Label><Input id="tool-sqft" inputMode="decimal" value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="900" /></div>
          </div>
          {inputError ? <p className="mt-3 text-sm text-destructive">{inputError}</p> : null}
        </ZipForm>
        {query.isLoading ? <p className="mt-8 text-muted-foreground">Loading the exact ZIP benchmark…</p> : null}
        {query.isError ? <Alert variant="destructive" className="mt-8"><AlertTitle>Benchmark temporarily unavailable</AlertTitle><AlertDescription>Please try again.</AlertDescription></Alert> : null}
        {query.data && !exact ? <CoverageGap zip={zip} reason={query.data.fallbackReason} /> : null}
        {exact && query.data && aggregate && submitted && subjectPpsf ? (
          <section className="mt-8 space-y-6" aria-live="polite">
            <div><h2 className="text-2xl font-semibold">ZIP {zip} benchmark result</h2><p className="text-muted-foreground">{positioning}</p></div>
            <div className="grid gap-4 md:grid-cols-3"><Metric label="Your calculated $/sq ft" value={currency(subjectPpsf)} /><Metric label="ZIP median recorded $/sq ft" value={currency(aggregate.medianPricePerSqft)} /><Metric label="Difference from median" value={percent(difference)} trend={difference} /></div>
            <Card><CardHeader><CardTitle>Published $/sq ft range</CardTitle><CardDescription>25th to 75th percentile for exact-ZIP recorded sales when the current publication includes both bounds.</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold">{aggregate.p25PricePerSqft !== null && aggregate.p75PricePerSqft !== null ? `${currency(aggregate.p25PricePerSqft)} – ${currency(aggregate.p75PricePerSqft)}` : "Range not included in this publication"}</div><p className="mt-3 text-sm text-muted-foreground">This comparison does not adjust for condition, floor, views, building quality, common charges, property type, or other value drivers.</p></CardContent></Card>
            <FreshnessPanel freshness={query.data.freshness} observed={aggregate.transactionCount ?? query.data.coverage.observedSampleSize} />
            <Link href={`/neighborhood/${zip}?geoType=zip`}><Button>Research ZIP {zip}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </section>
        ) : null}
        <ToolDisclosure />
      </div>
    </MarketingLayout>
  );
}

function MomentumChecker() {
  const initialZip = useInitialZip();
  const [zip, setZip] = useState(initialZip);
  const query = useQuery<DataEnvelope<UpAndComingZip>>({
    queryKey: ["tool", "momentum-rankings"],
    queryFn: () => fetchEnvelope("/api/market/trending-zips?limit=100&envelope=1"),
    retry: 2,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2_000),
  });
  const result = useMemo(() => query.data?.records.find((record) => record.zipCode === zip), [query.data, zip]);
  const rank = result && query.data ? query.data.records.findIndex((record) => record.zipCode === zip) + 1 : null;
  const suggestions = query.data?.records.slice(0, 3) || [];
  const run = (nextZip: string) => { setZip(nextZip); setToolUrl("/tools/nyc-neighborhood-momentum", nextZip); };

  return (
    <MarketingLayout>
      <SEO title="NYC Neighborhood Momentum Checker" description="Check an eligible NYC ZIP's current recorded-sale trend score, rank, transaction depth, and momentum classification." canonicalUrl={`${SITE_URL}/tools/nyc-neighborhood-momentum`} />
      <JsonLd id="momentum-jsonld" data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "NYC Neighborhood Momentum Checker", applicationCategory: "BusinessApplication", operatingSystem: "Web", url: `${SITE_URL}/tools/nyc-neighborhood-momentum`, isAccessibleForFree: true }} />
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
        <ToolIntro icon={Gauge} title="NYC Neighborhood Momentum Checker" description="Check whether an eligible ZIP is accelerating, steady, or decelerating in the current published ranking—and see the underlying recorded-sale signals." />
        <ZipForm initialZip={initialZip} buttonLabel="Check momentum" onSubmit={run} />
        {query.isLoading ? <p className="mt-8 text-muted-foreground">Loading the current published ranking…</p> : null}
        {query.isError ? <Alert variant="destructive" className="mt-8"><AlertTitle>Ranking temporarily unavailable</AlertTitle><AlertDescription>Please try again.</AlertDescription></Alert> : null}
        {zip && query.data && !result ? (
          <Alert className="mt-8"><Database className="h-4 w-4" /><AlertTitle>ZIP {zip} is not in the eligible ranking</AlertTitle><AlertDescription><p className="mb-3">The current publication does not contain a qualified momentum result for that ZIP. No substitute geography has been shown.</p>{suggestions.length ? <div className="flex flex-wrap gap-2">{suggestions.map((item) => <Button key={item.zipCode} variant="outline" size="sm" onClick={() => run(item.zipCode)}>Try {item.zipCode}</Button>)}</div> : null}</AlertDescription></Alert>
        ) : null}
        {result && query.data ? (
          <section className="mt-8 space-y-6" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">{result.city}, {result.state} {result.zipCode}</h2><p className="text-muted-foreground">Rank #{rank} of {query.data.records.length} eligible ZIPs in this publication</p></div><Badge className="capitalize">{result.momentum}</Badge></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Composite trend score" value={`${result.trendScore.toFixed(1)} / 100`} /><Metric label="6-month recorded trend" value={percent(result.trend6m)} trend={result.trend6m} /><Metric label="Recorded transactions" value={integer(result.transactionCount)} /><Metric label="Median recorded price" value={currency(result.medianPrice)} /></div>
            <Card><CardHeader><CardTitle>How to read this result</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p><strong className="text-foreground">Momentum:</strong> {result.momentum} describes the direction of the ranking inputs in the current snapshot; it is not a forecast.</p><p><strong className="text-foreground">Composite score:</strong> The ranking combines recorded-price trends, transaction velocity, liquidity, comparable-sale depth, and confidence.</p><p><strong className="text-foreground">Coverage:</strong> This tool ranks only ZIPs that pass the current sample and publication gates, so rank is not a comparison with every NYC ZIP.</p></CardContent></Card>
            <FreshnessPanel freshness={query.data.freshness} observed={query.data.coverage.observedSampleSize} />
            <div className="flex flex-wrap gap-3"><Link href={`/neighborhood/${zip}?geoType=zip`}><Button>Open ZIP report<ArrowRight className="ml-2 h-4 w-4" /></Button></Link><Link href="/up-and-coming"><Button variant="outline">View the full ranking</Button></Link></div>
          </section>
        ) : null}
        <ToolDisclosure />
      </div>
    </MarketingLayout>
  );
}

export default function Tools() {
  const [location] = useLocation();
  if (location === "/tools/nyc-zip-market-snapshot") return <ZipSnapshot />;
  if (location === "/tools/nyc-price-per-square-foot") return <PpsfBenchmark />;
  if (location === "/tools/nyc-neighborhood-momentum") return <MomentumChecker />;
  return <ToolsHub />;
}
