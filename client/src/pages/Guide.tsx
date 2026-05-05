import { useRoute, Link } from "wouter";
import { MarketingLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { JsonLd, BreadcrumbsJsonLd } from "@/components/JsonLd";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  ListChecks,
  Sparkles,
} from "lucide-react";
import NotFound from "@/pages/not-found";
import { getGuide, GUIDES_BY_SLUG } from "@shared/guides";

const SITE_URL = "https://realtorsdashboard.com";

export default function Guide() {
  const [, params] = useRoute<{ slug: string }>("/guides/:slug");
  const slug = params?.slug || "";
  const guide = getGuide(slug);

  if (!guide) return <NotFound />;

  const canonical = `${SITE_URL}/guides/${guide.slug}`;
  const related = guide.relatedSlugs
    .map((s) => GUIDES_BY_SLUG[s])
    .filter(Boolean);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.metaDescription,
    keywords: guide.keyword,
    articleSection: guide.category,
    inLanguage: "en-US",
    datePublished: guide.publishedDate,
    dateModified: guide.updatedDate,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: { "@type": "Organization", name: "Realtors Dashboard" },
    publisher: {
      "@type": "Organization",
      name: "Realtors Dashboard",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/og-image.png` },
    },
    image: `${SITE_URL}/og-image.png`,
  };

  const faqJsonLd =
    guide.faqs && guide.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: guide.faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  return (
    <MarketingLayout showBackButton={false}>
      <SEO
        title={guide.metaTitle}
        description={guide.metaDescription}
        canonicalUrl={canonical}
        ogType="article"
      />
      <JsonLd id={`jsonld-guide-${guide.slug}`} data={articleJsonLd} />
      {faqJsonLd && (
        <JsonLd id={`jsonld-guide-faq-${guide.slug}`} data={faqJsonLd} />
      )}
      <BreadcrumbsJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/guides" },
          { name: guide.title, url: `/guides/${guide.slug}` },
        ]}
      />

      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <div className="mb-10">
          <div
            className="flex flex-wrap items-center gap-2 mb-4"
            data-testid={`guide-${guide.slug}-header`}
          >
            <Badge variant="secondary">Guide</Badge>
            <Badge variant="outline">{guide.category}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {guide.readingMinutes} min read
            </span>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight md:text-4xl mb-4"
            data-testid={`text-guide-title-${guide.slug}`}
          >
            {guide.title}
          </h1>
          <p
            className="text-lg text-muted-foreground"
            data-testid={`text-guide-intro-${guide.slug}`}
          >
            {guide.intro}
          </p>
        </div>

        <div className="space-y-6">
          {guide.sections.map((section, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-muted-foreground" />
                  {section.heading}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p
                  className="text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-muted-foreground/50"
                  dangerouslySetInnerHTML={{ __html: section.body }}
                />
                {section.bullets && section.bullets.length > 0 && (
                  <ul className="space-y-2">
                    {section.bullets.map((item, i) => (
                      <li
                        key={i}
                        className="flex gap-3"
                        data-testid={`bullet-guide-${guide.slug}-${idx}-${i}`}
                      >
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
                        <span
                          className="text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-muted-foreground/50"
                          dangerouslySetInnerHTML={{ __html: item }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {guide.faqs && guide.faqs.length > 0 && (
          <div className="mt-10">
            <h2 className="text-2xl font-bold tracking-tight mb-4">
              Frequently asked
            </h2>
            <div className="space-y-4">
              {guide.faqs.map((faq, i) => (
                <Card
                  key={i}
                  data-testid={`faq-guide-${guide.slug}-${i}`}
                >
                  <CardHeader>
                    <CardTitle className="text-base">{faq.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Card className="mt-10">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="font-semibold">Put this guide into practice</p>
              <p className="text-sm text-muted-foreground">
                Try it on real properties and verified data on the platform.
              </p>
            </div>
            <Link href={guide.productLink.href}>
              <Button data-testid={`button-guide-cta-${guide.slug}`}>
                {guide.productLink.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              Related guides
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {related.map((rel) => (
                <Link key={rel.slug} href={`/guides/${rel.slug}`}>
                  <Card
                    className="hover-elevate cursor-pointer h-full"
                    data-testid={`card-related-guide-${rel.slug}`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold mb-1">{rel.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {rel.metaDescription}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 text-center">
          <Link href="/guides">
            <Button
              variant="outline"
              data-testid="button-back-to-guides-index"
            >
              See all guides
            </Button>
          </Link>
        </div>
      </div>
    </MarketingLayout>
  );
}
