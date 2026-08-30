import { Target, BarChart3, Users, Shield, MapPin, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingLayout } from "@/components/layouts";
import { SEO } from "@/components/SEO";

export default function About() {
  const values = [
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Transparency",
      description: "Every score and insight comes with a clear explanation. No black boxes, just data you can trust.",
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Accuracy",
      description: "We source data from official records and validate it rigorously. Quality over quantity, always.",
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Accessibility",
      description: "Professional-grade market intelligence shouldn't require a Wall Street budget or data science degree.",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Speed",
      description: "In real estate, timing is everything. Our platform delivers insights in seconds, not days.",
    },
  ];

  const coverage = [
    { state: "New York City", description: "Active official rolling-sales and condominium-identity sources" },
    { state: "Non-NYC NY & New Jersey", description: "Source adapters remain disabled until access, identity, and rights validation passes" },
    { state: "Connecticut", description: "Municipality-level coverage remains disabled until cadence and quality are measured" },
  ];

  return (
    <MarketingLayout>
      <SEO
        title="About Realtors Dashboard - Real Estate Intelligence Platform"
        description="Learn about Realtors Dashboard's source-backed data, transparent scoring, freshness rules, and published coverage."
        canonicalUrl="https://realtorsdashboard.com/about"
      />
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight mb-4 md:text-4xl">
            About Realtors Dashboard
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            We publish source-backed NYC recorded-sales research with clear coverage, freshness, scoring rules, and limitations. Optional AI summaries never replace the underlying record.
          </p>
        </div>
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <h2 className="text-2xl font-bold tracking-tight mb-8">Our Mission</h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Real estate is the largest asset class in the world, yet most buyers and investors 
                operate with incomplete information. Institutional players have access to sophisticated 
                analytics while public records remain fragmented and difficult to compare.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Realtors Dashboard combines named public data, reproducible analysis, and manually validated publication gates. Scores remain research inputs—not appraisals or investment recommendations.
              </p>
            </div>
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-4 text-primary">
                <BarChart3 className="h-16 w-16" />
                <TrendingUp className="h-12 w-12" />
                <MapPin className="h-14 w-14" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <h2 className="text-2xl font-bold tracking-tight mb-8">Our Values</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value) => (
            <Card key={value.title} className="hover-elevate">
              <CardContent className="pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  {value.icon}
                </div>
                <h3 className="font-semibold mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <h2 className="text-2xl font-bold tracking-tight mb-8">Coverage Area</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl">
            Verified detail coverage is currently limited to published NYC recorded-sale data. Other regions remain unavailable unless their source, identity, rights, freshness, and quality checks pass.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {coverage.map((item) => (
              <Card key={item.state}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{item.state}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <h2 className="text-2xl font-bold tracking-tight mb-8">Data Sources</h2>
        <div className="max-w-3xl">
          <p className="text-muted-foreground leading-relaxed mb-4">
            Our data comes from authoritative public sources, including:
          </p>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span><strong>NYC Open Data:</strong> PLUTO property records, rolling sales, ACRIS transactions, and HPD violations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span><strong>NYC Department of Finance:</strong> Rolling sales and ACRIS recorded transactions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span><strong>NYC Department of City Planning:</strong> PLUTO parcel attributes and canonical property context</span>
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Data changes only after a manually triggered candidate import passes source, geography, price, duplication, freshness, and completeness checks. Failed runs leave the prior publication active.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
