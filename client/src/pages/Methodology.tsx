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
          "Price vs comps: median $/sqft and median price for tightly matched comparable transactions in the same ZIP and property type.",
          "Recency: trades within the last 12 months are weighted more heavily than older transactions.",
          "Property fit: square footage, bed/bath count, year built, and unit classification narrow the comp pool before pricing is computed.",
          "Market trend: ZIP-level momentum (price appreciation, sales velocity) adjusts the expected price band for the current quarter.",
        ],
      },
      {
        heading: "How the 0-100 number is produced",
        body: "We compute an expected price band from the comp pool, then place the subject property's asking or estimated value inside that band. Properties sitting well below the expected median earn higher scores; properties at or above the median score lower. The exact mapping is monotonic so a higher score always implies a better price-to-comp position.",
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
      "What we cover, where the data comes from, and how often it refreshes. Verified NYC condo sales, statewide property records for NY, NJ, and CT, and ZIP-level market aggregates.",
    intro:
      "Realtors Dashboard combines verified public records, official open-data feeds, and reference market data to build a transparent view of every covered property. Here is what is in the platform today and how we keep it current.",
    sections: [
      {
        heading: "Geographic coverage",
        body: "We currently cover three states with full property records and market aggregates, plus deep unit-level coverage in New York City.",
        bullets: [
          "New York: NYC plus statewide coverage, including 300K+ verified condo unit records from NYC Open Data.",
          "New Jersey: statewide property records with city, ZIP, and county aggregates.",
          "Connecticut: statewide property records with city, ZIP, and county aggregates.",
          "National expansion: additional states are being onboarded; nationwide rollout is in progress.",
        ],
      },
      {
        heading: "Source data",
        body: "We only ingest sources we can attribute. Every detail page links the underlying data so users can verify it themselves.",
        bullets: [
          "NYC Open Data: PLUTO, rolling sales, ACRIS recorded transactions, and condo declarations.",
          "Connecticut Open Data and New Jersey property records: parcel-level data and recorded sales.",
          "Zillow Research: ZIP-level housing market reference series.",
          "FRED MORTGAGE30US: live 30-year mortgage rate series used by the investment calculator.",
          "NYC Geoclient API: address normalization and geocoding for NYC parcels.",
        ],
      },
      {
        heading: "Refresh cadence",
        body: "Sales and market aggregates refresh on a regular ETL schedule. Static reference data (parcel polygons, building footprints) refreshes when the source agencies publish new releases. Mortgage rates refresh daily from FRED.",
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
        body: "A verified sale is a recorded property transfer drawn from official public records. For NYC that means ACRIS recorded deeds and the rolling sales file. For New Jersey and Connecticut that means county and statewide recorded sales feeds.",
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
        </div>

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
