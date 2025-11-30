import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Home as HomeIcon, Bell, ArrowRight, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { MarketStatsCard } from "@/components/MarketStatsCard";
import { PropertyCard } from "@/components/PropertyCard";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import type { Property, MarketAggregate, Notification } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();

  const { data: topOpportunities, isLoading: loadingOpportunities } = useQuery<Property[]>({
    queryKey: ["/api/properties/top-opportunities"],
  });

  const { data: marketStats, isLoading: loadingStats } = useQuery<MarketAggregate[]>({
    queryKey: ["/api/market/overview"],
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  const quickActions = [
    {
      icon: <BarChart3 className="h-5 w-5" />,
      label: "Market Explorer",
      description: "Analyze pricing by ZIP, city, or neighborhood",
      href: "/explore",
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      label: "Opportunity Screener",
      description: "Find underpriced properties with filters",
      href: "/screener",
    },
    {
      icon: <HomeIcon className="h-5 w-5" />,
      label: "My Watchlists",
      description: "Track saved properties and markets",
      href: "/watchlists",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl" data-testid="text-welcome">
            Welcome back, {user?.firstName || "there"}
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening in the Tri-State real estate market
          </p>
        </div>

        {unreadCount > 0 && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">You have {unreadCount} new alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Properties matching your criteria have updates
                  </p>
                </div>
              </div>
              <Link href="/watchlists">
                <Button variant="outline" data-testid="button-view-alerts">
                  View Alerts
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="h-full hover-elevate cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {action.icon}
                  </div>
                  <div>
                    <p className="font-semibold">{action.label}</p>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Market Overview</h2>
            <Link href="/explore">
              <Button variant="ghost" size="sm" data-testid="link-explore-markets">
                Explore Markets
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loadingStats ? (
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <LoadingState type="spinner" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              <MarketStatsCard
                label="NYC Median"
                value="$725K"
                trend={2.3}
                trendLabel="vs 3mo ago"
                icon={<MapPin className="h-5 w-5" />}
              />
              <MarketStatsCard
                label="Long Island Median"
                value="$595K"
                trend={1.8}
                trendLabel="vs 3mo ago"
                icon={<MapPin className="h-5 w-5" />}
              />
              <MarketStatsCard
                label="NJ Median"
                value="$485K"
                trend={-0.5}
                trendLabel="vs 3mo ago"
                icon={<MapPin className="h-5 w-5" />}
              />
              <MarketStatsCard
                label="CT Median"
                value="$395K"
                trend={1.2}
                trendLabel="vs 3mo ago"
                icon={<MapPin className="h-5 w-5" />}
              />
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Top Opportunities</h2>
              <p className="text-sm text-muted-foreground">
                Highest scoring properties in your coverage areas
              </p>
            </div>
            <Link href="/screener">
              <Button variant="ghost" size="sm" data-testid="link-view-all-opportunities">
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loadingOpportunities ? (
            <LoadingState type="skeleton-cards" count={3} />
          ) : topOpportunities && topOpportunities.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {topOpportunities.slice(0, 6).map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 font-semibold">No opportunities yet</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Use the screener to find properties that match your criteria
                </p>
                <Link href="/screener">
                  <Button data-testid="button-go-to-screener">
                    Open Screener
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
