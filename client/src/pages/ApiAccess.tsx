import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketingHeader } from "@/components/MarketingHeader";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { 
  Code, 
  Zap, 
  Shield, 
  BarChart3, 
  Database, 
  ArrowRight, 
  Check,
  Building2,
  TrendingUp,
  MapPin
} from "lucide-react";

export default function ApiAccess() {
  const benefits = [
    {
      icon: <Database className="h-6 w-6" />,
      title: "Real Estate Data at Scale",
      description: "Access 199,500+ properties, market statistics, and comparable sales data across NY, NJ, and CT.",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Lightning Fast",
      description: "RESTful JSON API with sub-100ms response times. Built for high-volume integrations.",
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with API key authentication and rate limiting protection.",
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Market Intelligence",
      description: "Pricing percentiles, opportunity scores, and trend data updated daily.",
    },
  ];

  const endpoints = [
    {
      method: "GET",
      path: "/api/external/properties",
      description: "Search and filter properties with pagination",
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      method: "GET",
      path: "/api/external/market-stats",
      description: "Market statistics by geography (ZIP, city, county)",
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      method: "GET",
      path: "/api/external/comps/:id",
      description: "Comparable properties for valuation analysis",
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      method: "GET",
      path: "/api/external/up-and-coming",
      description: "Trending ZIP codes with momentum scores",
      icon: <TrendingUp className="h-4 w-4" />,
    },
  ];

  const useCases = [
    {
      title: "Build Investment Tools",
      description: "Power your investment analysis platform with real-time property data and opportunity scores.",
    },
    {
      title: "Integrate with CRM",
      description: "Enrich your real estate CRM with market data, pricing percentiles, and property details.",
    },
    {
      title: "Custom Dashboards",
      description: "Create internal dashboards and reports with our comprehensive market statistics.",
    },
    {
      title: "Automated Alerts",
      description: "Build custom notification systems when properties match your investment criteria.",
    },
  ];

  const pricingFeatures = [
    "10 requests per second burst rate",
    "10,000 requests per day quota",
    "All property and market endpoints",
    "Comparable sales data",
    "Trending ZIP code analysis",
    "Full developer documentation",
    "Rate limit headers for monitoring",
    "Secure API key management",
  ];

  return (
    <>
      <SEO 
        title="Developer API - Real Estate Data for Your Applications"
        description="Access 199,500+ properties via REST API. Get property data, market statistics, opportunity scores, and comparable sales for NY, NJ, and CT."
      />
      <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main>
        <section className="relative overflow-hidden py-20 md:py-28">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
          <div className="relative mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="outline" className="mb-4">Developer API</Badge>
              <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl" data-testid="text-api-access-title">
                Build with Real Estate{" "}
                <span className="text-primary">Intelligence</span>
              </h1>
              <p className="mb-8 text-lg text-muted-foreground md:text-xl">
                Integrate property data, market statistics, and opportunity scores directly into your applications. 
                Everything you need to power real estate analytics at scale.
              </p>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link href="/pricing">
                  <Button size="lg" className="h-12 px-8" data-testid="button-get-api-access">
                    Get API Access
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/developers">
                  <Button variant="outline" size="lg" className="h-12 px-8" data-testid="button-view-docs">
                    <Code className="mr-2 h-4 w-4" />
                    View Documentation
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30 py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight">Why Developers Choose Us</h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                Built for developers who need reliable, fast, and comprehensive real estate data.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {benefits.map((benefit) => (
                <Card key={benefit.title} className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {benefit.icon}
                    </div>
                    <h3 className="mb-2 font-semibold">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight">Available Endpoints</h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                RESTful API with comprehensive coverage of properties, markets, and analytics.
              </p>
            </div>
            <div className="mx-auto max-w-3xl space-y-4">
              {endpoints.map((endpoint) => (
                <div
                  key={endpoint.path}
                  className="flex items-center gap-4 rounded-lg border p-4 hover-elevate"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {endpoint.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{endpoint.method}</Badge>
                      <code className="text-sm font-mono">{endpoint.path}</code>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{endpoint.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href="/developers">
                <Button variant="outline" data-testid="button-full-docs">
                  See Full Documentation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30 py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight">What You Can Build</h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                From investment platforms to CRM integrations, our API powers it all.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {useCases.map((useCase) => (
                <Card key={useCase.title}>
                  <CardHeader>
                    <CardTitle className="text-lg">{useCase.title}</CardTitle>
                    <CardDescription>{useCase.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto max-w-xl">
              <Card className="border-primary/50">
                <CardHeader className="text-center">
                  <Badge className="mx-auto mb-2 w-fit">Pro Plan</Badge>
                  <CardTitle className="text-3xl">API Access Included</CardTitle>
                  <CardDescription>
                    Full API access is included with your Pro subscription
                  </CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">$29</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {pricingFeatures.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/pricing">
                    <Button className="w-full" size="lg" data-testid="button-upgrade-pro">
                      Upgrade to Pro
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-16">
          <div className="mx-auto max-w-7xl px-4 text-center md:px-6">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">
              Ready to Get Started?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-muted-foreground">
              Generate your API key in seconds and start building with real estate intelligence.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/developers">
                <Button size="lg" variant="outline" data-testid="button-read-docs">
                  <Code className="mr-2 h-4 w-4" />
                  Read the Docs
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" data-testid="button-get-started">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      </div>
    </>
  );
}
