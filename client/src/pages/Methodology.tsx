import { useRoute, Link } from "wouter";
import { MarketingLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { BreadcrumbsJsonLd } from "@/components/JsonLd";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileSearch,
  Gauge,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import NotFound from "@/pages/not-found";

type TopicKey =
  | "opportunity-score"
  | "data-coverage"
  | "verified-vs-estimates";

interface TopicContent {
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  sections: { heading: string; body: string; bullets?: string[] }[];
  ctaLabel: string;
  ctaHref: string;
  related: { topic: TopicKey; title: string; description: string }[];
}

const TOPICS: Record<TopicKey, TopicContent> = {
  "opportunity-score": {
    title: "Opportunity Score Explained",
    metaTitle:
      "Opportunity Score Explained - How We Rate Properties | Realtors Dashboard",
    metaDescription:
      "Inside our 0-100 Opportunity Score: the inputs, weights, comp methodology, and confidence bands we use to flag underpriced properties in NY, NJ, and CT.",
    intro:
      "The Opportunity Score is a 0-100 rating that estimates how underpriced a property is relative to verified comparable sales and current market context. It is built from public records and verified transactions only - never from listing-derived estimates alone.",
    sections: [
      {
        heading: "What goes into the score",
        body: "Each property is scored against a rolling pool of verified comparable sales filtered by geography, property type, and time window. The model blends four signal families:",
        bullets: [
          "Price trend (30%): current-period median verified sale price versus the prior complete period.",
          "Transaction velocity (25%): qualifying current-period transfers versus the prior period.",
          "Liquidity and comp depth (35% combined): transaction count and reproducible same-geography comp coverage.",
          "Confidence (10%): sample-size tier after identity, arms-length, geography, price, and freshness gates pass.",
        ],
      },
      {
        heading: "How the 0-100 number is produced",
        body: "Market rankings and property opportunity scores are separate products. The market ranking uses the published component weights above and is versioned as up-and-coming-v1.0.0. Property scores use verified comparable transactions and expose their own rule version. A score is not published when its destination has no public property or either comparison period has fewer than five qualifying sales.",
      },
      {
        heading: "Confidence bands",
        body: "Every score is paired with a confidence band that reflects the size and tightness of the comp pool. A score from a thin comp pool (few recent verified trades) is shown with a lower confidence weight so users can discount it appropriately.",
      },
      {
        heading: "What the score is not",
        body: "The Opportunity Score is not an appraisal, not a rent or yield forecast, and not a recommendation to buy. It is a price-position indicator that helps prioritize which properties deserve a deeper read of the comps, sales history, and neighborhood data we publish on every detail page.",
      },
    ],
    ctaLabel: "See top-scored opportunities",
    ctaHref: "/investment-opportunities",
    related: [
      {
        topic: "verified-vs-estimates",
        title: "Verified Sales vs Estimates",
        description:
          "Why we anchor scores to verified transactions instead of automated valuation models.",
      },
      {
        topic: "data-coverage",
        title: "Data Coverage",
        description:
          "Where the underlying data comes from and which markets we currently cover.",
      },
    ],
  },
  "data-coverage": {
    title: "Data Coverage",
    metaTitle:
      "Data Coverage - States, Sources, and Refresh Cadence | Realtors Dashboard",
    metaDescription:
      "What we cover, where the data comes from, and how often it refreshes. Verified NYC condo sales and units, plus Tri-State market aggregates.",
    intro:
      "Realtors Dashboard combines verified public records, official open-data feeds, and reference market data to build a transparent view of every covered property. Here is what is in the platform today and how we keep it current.",
    sections: [
      {
        heading: "Geographic coverage",
        body: "Verified parcel and unit detail pages currently focus on NYC. Non-NYC New York, New Jersey, and Connecticut are not treated as current coverage until each official adapter passes access, rights, identity, freshness, and quality review.",
        bullets: [
          "New York City: 300K+ official condo-unit identities from NYC Open Data; only units with an exact recorded-sale match are published as detail pages.",
          "Non-NYC New York: NYS SalesWeb is cataloged but disabled until automated access and redistribution review is complete; this includes ZIP 10977.",
          "New Jersey: MOD-IV/SR1A is cataloged but disabled until file shape, cadence, parcel identity, and redistribution checks pass.",
          "Connecticut: OPM/municipal data is cataloged but disabled until municipality-level coverage and cadence are measured.",
          "Live listings: unavailable until a licensed MLS/vendor feed and its display/retention rules are supplied.",
        ],
      },
      {
        heading: "Source data",
        body: "We only ingest sources we can attribute. Every detail page links the underlying data so users can verify it themselves.",
        bullets: [
          "NYC Open Data: PLUTO, rolling sales, ACRIS recorded transactions, and condo declarations.",
          "NYS SalesWeb, NJ MOD-IV/SR1A, and Connecticut OPM/municipal resources: planned, fail-closed adapters pending source validation.",
          "FRED MORTGAGE30US: live 30-year mortgage rate series used by the investment calculator.",
          "NYC Geoclient API: address normalization and geocoding for NYC parcels.",
        ],
      },
      {
        heading: "Refresh cadence",
        body: "Every source carries its own watermark, expected publication lag, raw checksum, ingestion time, and dataset version. A candidate release must pass geography, duplicate, sample-size, volume, and freshness gates before one atomic publication pointer moves. Failed runs leave the prior dataset active.",
      },
      {
        heading: "What we do not include",
        body: "We do not publish off-market private listings, MLS-only fields under license restriction, or unverified user-submitted data. Listing-derived AVM estimates are kept separate from verified sale prices on every page so the difference is always visible.",
      },
    ],
    ctaLabel: "Browse the developer API",
    ctaHref: "/developers",
    related: [
      {
        topic: "verified-vs-estimates",
        title: "Verified Sales vs Estimates",
        description:
          "How verified transactions are surfaced separately from automated estimates.",
      },
      {
        topic: "opportunity-score",
        title: "Opportunity Score Explained",
        description:
          "How the verified data is turned into the 0-100 Opportunity Score.",
      },
    ],
  },
  "verified-vs-estimates": {
    title: "Verified Sales vs Estimates",
    metaTitle:
      "Verified Sales vs Estimates - How We Show Both | Realtors Dashboard",
    metaDescription:
      "We separate verified recorded transactions from automated valuation estimates so users can see the difference. Here is exactly how each is sourced, labeled, and used.",
    intro:
      "Most real estate sites blend recorded sale prices and algorithmic estimates into a single number. We do not. Verified sales and estimates serve different purposes, and on every page they are sourced, labeled, and presented separately.",
    sections: [
      {
        heading: "What counts as a verified sale",
        body: "A verified sale is a recorded property transfer drawn from an approved official source and resolved to a canonical property/unit and geography. NYC rolling sales are active. New Jersey, Connecticut, and non-NYC New York are not described as verified current coverage until their disabled source adapters pass review.",
        bullets: [
          "Sourced from named public agencies, never from listing portals.",
          "Includes the recorded sale price, sale date, and parcel identifier.",
          "Filtered to remove obvious non-arms-length transfers (nominal $1 transfers, intra-family quitclaims) before being used as a comp.",
        ],
      },
      {
        heading: "What counts as an estimate",
        body: "An estimate is a model-produced value when a verified recent sale is not available. Estimates are clearly labeled and only used to provide a price band when verified sales are sparse.",
      },
      {
        heading: "How they appear on the site",
        body: "Property and unit detail pages show the most recent verified sale prominently, with the date and source. Any model-produced estimate appears in a separate field with the word 'estimate' and a confidence indicator. Comparable sales tables list verified transactions only.",
      },
      {
        heading: "Why this matters for scoring",
        body: "The Opportunity Score is computed against verified comparable sales, not against estimates. This avoids the circular logic of comparing one estimate to another estimate. When the verified comp pool is too thin to support a score, we say so and lower the confidence band rather than falling back to estimate-vs-estimate math.",
      },
    ],
    ctaLabel: "View a property with full sale history",
    ctaHref: "/investment-opportunities",
    related: [
      {
        topic: "opportunity-score",
        title: "Opportunity Score Explained",
        description: "How verified comps power the 0-100 score.",
      },
      {
        topic: "data-coverage",
        title: "Data Coverage",
        description:
          "Where verified sales come from and how often they refresh.",
      },
    ],
  },
};

const TOPIC_ICONS: Record<TopicKey, React.ComponentType<{ className?: string }>> =
  {
    "opportunity-score": Gauge,
    "data-coverage": Database,
    "verified-vs-estimates": ShieldCheck,
  };

export default function Methodology() {
  const [, params] = useRoute<{ topic: string }>("/methodology/:topic");
  const topic = (params?.topic || "") as TopicKey;
  const content = TOPICS[topic];

  if (!content) return <NotFound />;

  const Icon = TOPIC_ICONS[topic];
  const canonical = `https://realtorsdashboard.com/methodology/${topic}`;

  return (
    <MarketingLayout showBackButton={false}>
      <SEO
        title={content.metaTitle}
        description={content.metaDescription}
        canonicalUrl={canonical}
      />
      <BreadcrumbsJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Methodology", url: "/methodology/opportunity-score" },
          { name: content.title, url: `/methodology/${topic}` },
        ]}
      />

      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <div className="mb-10">
          <div
            className="flex items-center gap-3 mb-4"
            data-testid={`methodology-${topic}-header`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <Badge variant="secondary">Methodology</Badge>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight md:text-4xl mb-4"
            data-testid={`text-methodology-title-${topic}`}
          >
            {content.title}
          </h1>
          <p className="text-lg text-muted-foreground">{content.intro}</p>
          <p className="mt-4 text-sm text-muted-foreground">By the Realtors Dashboard Data Editorial Team · Last reviewed 2026-08-30 · Methodology text-first-market-v1.1.0</p>
        </div>

        <Card className="mt-8">
          <CardHeader><CardTitle>Official sources and corrections</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Current verified detail coverage uses NYC recorded-sale and property-identity sources. Updates are manually triggered, quality-gated, and atomically published.</p>
            <p><a className="underline" href="https://www.nyc.gov/site/finance/property/property-rolling-sales-update.page" target="_blank" rel="noreferrer">NYC rolling sales</a>{" · "}<a className="underline" href="https://a836-acris.nyc.gov/CP/" target="_blank" rel="noreferrer">ACRIS</a>{" · "}<a className="underline" href="https://www.nyc.gov/site/planning/data-maps/open-data/dwn-pluto-mappluto.page" target="_blank" rel="noreferrer">PLUTO</a></p>
            <p>Scores and estimates are research inputs, not appraisals or investment advice. <a className="underline" href="mailto:hello@realtorsdashboard.com?subject=Methodology%20correction">Report a correction</a>.</p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {content.sections.map((section, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-muted-foreground" />
                  {section.heading}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{section.body}</p>
                {section.bullets && section.bullets.length > 0 && (
                  <ul className="space-y-2">
                    {section.bullets.map((item, i) => (
                      <li
                        key={i}
                        className="flex gap-3"
                        data-testid={`bullet-${topic}-${idx}-${i}`}
                      >
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-10">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="font-semibold">Ready to put this into practice?</p>
              <p className="text-sm text-muted-foreground">
                Try it on real properties and see the methodology in action.
              </p>
            </div>
            <Link href={content.ctaHref}>
              <Button data-testid={`button-methodology-cta-${topic}`}>
                {content.ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            Related methodology
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {content.related.map((rel) => {
              const RelIcon = TOPIC_ICONS[rel.topic];
              return (
                <Link key={rel.topic} href={`/methodology/${rel.topic}`}>
                  <Card
                    className="hover-elevate cursor-pointer"
                    data-testid={`card-related-${rel.topic}`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <RelIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold mb-1">{rel.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {rel.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        <Card className="mt-8">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div className="flex items-center gap-3">
              <FileSearch className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Want to compare us with other real estate tools?
              </p>
            </div>
            <Link href="/comparisons">
              <Button
                variant="outline"
                data-testid="button-comparisons-from-methodology"
              >
                See comparisons
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
}
