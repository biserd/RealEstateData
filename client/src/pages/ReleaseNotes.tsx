import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MarketingHeader } from "@/components/MarketingHeader";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { 
  Sparkles, 
  Zap, 
  Bug, 
  Shield,
  Code,
  TrendingUp,
  Building2,
  CreditCard,
  Key
} from "lucide-react";

interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  description: string;
  type: "major" | "minor" | "patch";
  changes: {
    type: "feature" | "improvement" | "fix" | "security";
    title: string;
    description?: string;
  }[];
}

const releaseNotes: ReleaseNote[] = [
  {
    version: "1.3.0",
    date: "December 2025",
    title: "Developer API & Settings",
    description: "Introducing API access for Pro subscribers and new account settings.",
    type: "major",
    changes: [
      {
        type: "feature",
        title: "Developer API Access",
        description: "Pro subscribers can now generate API keys to programmatically access property data, market statistics, and opportunity scores.",
      },
      {
        type: "feature",
        title: "API Documentation",
        description: "Comprehensive developer documentation with code examples in cURL, JavaScript, and Python.",
      },
      {
        type: "feature",
        title: "Settings Page",
        description: "New account settings page with API key management for Pro users.",
      },
      {
        type: "feature",
        title: "Rate Limiting",
        description: "Secure rate limiting with 10 req/sec burst and 10,000 daily quota for API access.",
      },
      {
        type: "improvement",
        title: "Navigation Updates",
        description: "Added API and Developer links to header and footer for easier access.",
      },
    ],
  },
  {
    version: "1.2.0",
    date: "November 2025",
    title: "Stripe Subscriptions & Pro Features",
    description: "Monetization with Stripe and premium feature gating.",
    type: "major",
    changes: [
      {
        type: "feature",
        title: "Pro Subscription",
        description: "Upgrade to Pro for $29/month or $290/year for unlimited access to all features.",
      },
      {
        type: "feature",
        title: "Stripe Integration",
        description: "Secure payment processing with Stripe Checkout and customer portal.",
      },
      {
        type: "feature",
        title: "Feature Gating",
        description: "Pro-only features include AI assistant, Deal Memo generator, exports, and unlimited watchlists.",
      },
      {
        type: "improvement",
        title: "Pricing Page",
        description: "Clear comparison of Free vs Pro tiers with transparent pricing.",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "October 2025",
    title: "Up and Coming ZIPs & Enhanced Analytics",
    description: "New trending neighborhoods feature and improved market analytics.",
    type: "minor",
    changes: [
      {
        type: "feature",
        title: "Up and Coming ZIPs",
        description: "Identify trending neighborhoods with our proprietary trend score algorithm.",
      },
      {
        type: "feature",
        title: "Enhanced Opportunity Scoring",
        description: "Improved 0-100 scoring with transparent breakdown of mispricing, confidence, and risk.",
      },
      {
        type: "improvement",
        title: "Market Explorer Filters",
        description: "Added more filtering options including property type, beds, baths, and year built.",
      },
      {
        type: "fix",
        title: "Price Formatting",
        description: "Fixed price display formatting for properties over $10M.",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "September 2025",
    title: "Initial Launch",
    description: "Realtors Dashboard launches with core market intelligence features.",
    type: "major",
    changes: [
      {
        type: "feature",
        title: "Market Explorer",
        description: "View pricing bands (P25/P50/P75) for any ZIP, city, or neighborhood.",
      },
      {
        type: "feature",
        title: "Opportunity Screener",
        description: "Find underpriced properties with opportunity scoring.",
      },
      {
        type: "feature",
        title: "Property Details",
        description: "Comprehensive property information with comparable sales and market context.",
      },
      {
        type: "feature",
        title: "Watchlists",
        description: "Save and monitor properties of interest.",
      },
      {
        type: "feature",
        title: "AI Assistant",
        description: "Grounded AI insights backed by real data with citations.",
      },
      {
        type: "security",
        title: "Secure Authentication",
        description: "Username/password authentication with bcrypt password hashing.",
      },
    ],
  },
];

const changeTypeConfig = {
  feature: { icon: Sparkles, label: "New Feature", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  improvement: { icon: Zap, label: "Improvement", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  fix: { icon: Bug, label: "Bug Fix", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  security: { icon: Shield, label: "Security", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

const versionTypeConfig = {
  major: "destructive",
  minor: "default",
  patch: "secondary",
} as const;

export default function ReleaseNotes() {
  return (
    <>
      <SEO 
        title="Release Notes - Product Updates & New Features"
        description="Stay up to date with the latest Realtors Dashboard features, improvements, and bug fixes. See what's new in our real estate intelligence platform."
      />
      <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="py-12 md:py-16">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <div className="mb-12 text-center">
            <Badge variant="outline" className="mb-4">Changelog</Badge>
            <h1 className="text-4xl font-bold tracking-tight mb-4" data-testid="text-release-notes-title">
              Release Notes
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Stay up to date with the latest features, improvements, and fixes to Realtors Dashboard.
            </p>
          </div>

          <div className="space-y-8">
            {releaseNotes.map((release, index) => (
              <Card key={release.version} className={index === 0 ? "border-primary/50" : ""}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={versionTypeConfig[release.type]}>
                      v{release.version}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{release.date}</span>
                    {index === 0 && <Badge variant="outline">Latest</Badge>}
                  </div>
                  <CardTitle className="text-xl">{release.title}</CardTitle>
                  <CardDescription>{release.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {release.changes.map((change, changeIndex) => {
                      const config = changeTypeConfig[change.type];
                      const Icon = config.icon;
                      return (
                        <li key={changeIndex} className="flex gap-3">
                          <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded ${config.className}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{change.title}</p>
                            {change.description && (
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {change.description}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator className="my-12" />

          <div className="text-center">
            <p className="text-muted-foreground">
              Have a feature request or found a bug?{" "}
              <a href="/contact" className="text-primary hover:underline">
                Let us know
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
      </div>
    </>
  );
}
