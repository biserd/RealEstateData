import { Link } from "wouter";
import { MarketingLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SEO } from "@/components/SEO";
import { BreadcrumbsJsonLd } from "@/components/JsonLd";
import { ArrowRight, Check, Minus, Scale } from "lucide-react";

interface Comparison {
  vendor: string;
  positioning: string;
  bestFor: string;
  ourEdge: string[];
  rows: { feature: string; us: boolean | string; them: boolean | string }[];
}

const COMPARISONS: Comparison[] = [
  {
    vendor: "Zillow",
    positioning:
      "Consumer search portal with the Zestimate as the headline price.",
    bestFor:
      "Browsing active listings and getting a rough automated estimate of value.",
    ourEdge: [
      "We separate verified recorded sales from automated estimates instead of blending them into a single Zestimate-style number.",
      "Our Opportunity Score is computed against verified comp pools, with confidence bands when the pool is thin.",
      "Detail pages cite the underlying public-record source so users can verify the data themselves.",
    ],
    rows: [
      { feature: "Verified recorded sales (ACRIS / county records)", us: true, them: "Mixed with AVM estimates" },
      { feature: "Proprietary opportunity score with confidence band", us: true, them: false },
      { feature: "Per-unit NYC condo coverage (300K+ units)", us: true, them: "Building-level only" },
      { feature: "Source citation on every data point", us: true, them: false },
      { feature: "Investment calculator (cap rate, cash-on-cash, DSCR)", us: true, them: false },
      { feature: "Free consumer search", us: true, them: true },
    ],
  },
  {
    vendor: "Redfin",
    positioning:
      "Brokerage-driven search portal with an Estimate and direct agent funnel.",
    bestFor:
      "Buyers who want to tour homes through Redfin's in-house agents.",
    ourEdge: [
      "We are not a brokerage. There is no agent funnel and no sell-side conflict of interest in how properties are scored.",
      "Our market intelligence is geography-first (state, city, ZIP, neighborhood) instead of MLS-listing-first.",
      "We publish a full developer API for programmatic access to properties, comps, and market stats.",
    ],
    rows: [
      { feature: "Verified recorded sales separated from estimates", us: true, them: "Blended into Redfin Estimate" },
      { feature: "Proprietary opportunity score", us: true, them: false },
      { feature: "Neighborhood report cards (development, safety, transit, amenities, flood, building health)", us: true, them: "Limited" },
      { feature: "Developer API access (Pro/Premium)", us: true, them: false },
      { feature: "Investment calculator with BRRRR scenario", us: true, them: false },
      { feature: "Free consumer search", us: true, them: true },
    ],
  },
  {
    vendor: "PropStream",
    positioning:
      "Investor lead-generation platform focused on owner skip tracing and list pulling.",
    bestFor:
      "Wholesalers and direct-mail investors building seller lead lists.",
    ourEdge: [
      "We are a market intelligence and screening platform, not a list broker. The product is built around finding deals, not generating cold leads.",
      "Pricing is transparent and starts at a Free tier, with Pro at $29/month - no enterprise sales call required.",
      "AI deal memos cite the verified comps and market stats they were built from, so the analysis is auditable.",
    ],
    rows: [
      { feature: "Transparent self-serve pricing (Free, Pro, Premium)", us: true, them: false },
      { feature: "Verified opportunity scoring with comps", us: true, them: "Limited" },
      { feature: "AI property analysis with citations", us: true, them: false },
      { feature: "Skip tracing and owner contact data", us: false, them: true },
      { feature: "Direct-mail campaign tools", us: false, them: true },
      { feature: "Public API access", us: true, them: "Enterprise only" },
    ],
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <span className="flex items-center gap-1 text-foreground">
        <Check className="h-4 w-4 text-primary" />
        <span className="text-sm">Yes</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Minus className="h-4 w-4" />
        <span className="text-sm">No</span>
      </span>
    );
  }
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

export default function Comparisons() {
  return (
    <MarketingLayout showBackButton={false}>
      <SEO
        title="Realtors Dashboard vs Zillow, Redfin, and PropStream - Honest Comparison"
        description="Side-by-side comparison of Realtors Dashboard with Zillow, Redfin, and PropStream. See where verified data, opportunity scoring, and transparent pricing make a difference."
        canonicalUrl="https://realtorsdashboard.com/comparisons"
      />
      <BreadcrumbsJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Comparisons", url: "/comparisons" },
        ]}
      />

      <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Scale className="h-5 w-5" />
            </div>
            <Badge variant="secondary">Comparisons</Badge>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight md:text-4xl mb-4"
            data-testid="text-comparisons-title"
          >
            How Realtors Dashboard compares
          </h1>
          <p className="text-lg text-muted-foreground">
            We are not for everyone. Here is an honest comparison with the
            tools real estate buyers, investors, and agents most often ask
            about - including the things other tools do better than we do.
          </p>
        </div>

        <div className="space-y-10">
          {COMPARISONS.map((c) => (
            <Card key={c.vendor} data-testid={`card-comparison-${c.vendor.toLowerCase()}`}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-3">
                  Realtors Dashboard vs {c.vendor}
                  <Badge variant="outline">{c.bestFor}</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{c.positioning}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="font-semibold mb-2">Where we differ</p>
                  <ul className="space-y-2">
                    {c.ourEdge.map((edge, i) => (
                      <li
                        key={i}
                        className="flex gap-3 text-sm text-muted-foreground"
                      >
                        <Check className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                        <span>{edge}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Capability</TableHead>
                        <TableHead>Realtors Dashboard</TableHead>
                        <TableHead>{c.vendor}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.rows.map((row, i) => (
                        <TableRow
                          key={i}
                          data-testid={`row-${c.vendor.toLowerCase()}-${i}`}
                        >
                          <TableCell className="text-sm">{row.feature}</TableCell>
                          <TableCell><Cell value={row.us} /></TableCell>
                          <TableCell><Cell value={row.them} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-12">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="font-semibold">Want to see it for yourself?</p>
              <p className="text-sm text-muted-foreground">
                Start free, then upgrade to Pro for $29/month when you are
                ready for AI deal memos, exports, and the developer API.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/pricing">
                <Button data-testid="button-comparisons-pricing">
                  See pricing
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/methodology/opportunity-score">
                <Button variant="outline" data-testid="button-comparisons-methodology">
                  Read the methodology
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
}
