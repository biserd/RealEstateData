import { Link } from "wouter";
import { MarketingLayout } from "@/components/layouts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { JsonLd, BreadcrumbsJsonLd } from "@/components/JsonLd";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { GUIDES } from "@shared/guides";

const SITE_URL = "https://realtorsdashboard.com";

const PAGE_TITLE = "Guides - Realtors Dashboard";
const PAGE_DESCRIPTION =
  "Investor playbooks, concept explainers, market reports, and developer guides for NYC and tri-state real estate. Built on verified sales and the Opportunity Score methodology.";

export default function Guides() {
  const canonical = `${SITE_URL}/guides`;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Realtors Dashboard Guides",
    itemListElement: GUIDES.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/guides/${g.slug}`,
      name: g.title,
    })),
  };

  const categories = Array.from(new Set(GUIDES.map((g) => g.category)));

  return (
    <MarketingLayout showBackButton={false}>
      <SEO
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonicalUrl={canonical}
      />
      <JsonLd id="jsonld-guides-index" data={itemListJsonLd} />
      <BreadcrumbsJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/guides" },
        ]}
      />

      <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <Badge variant="secondary">Guides</Badge>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight md:text-4xl mb-4"
            data-testid="text-guides-index-title"
          >
            Real estate guides for investors, agents, and developers
          </h1>
          <p className="text-lg text-muted-foreground">
            Practical guides built on verified ACRIS sales, the Opportunity
            Score methodology, and the data we publish across NY, NJ, and CT.
            No fluff, no recycled SEO copy - just the workflows we use
            ourselves.
          </p>
        </div>

        {categories.map((cat) => {
          const inCat = GUIDES.filter((g) => g.category === cat);
          return (
            <div key={cat} className="mb-10">
              <h2
                className="text-xl font-semibold mb-4"
                data-testid={`text-guides-category-${cat
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`}
              >
                {cat}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {inCat.map((g) => (
                  <Link key={g.slug} href={`/guides/${g.slug}`}>
                    <Card
                      className="hover-elevate cursor-pointer h-full"
                      data-testid={`card-guide-${g.slug}`}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <Badge variant="outline">{g.category}</Badge>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /> {g.readingMinutes} min
                          </span>
                        </div>
                        <p
                          className="font-semibold mb-2"
                          data-testid={`text-guide-card-title-${g.slug}`}
                        >
                          {g.title}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                          {g.metaDescription}
                        </p>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                          Read guide
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </MarketingLayout>
  );
}
