import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Database, FileText, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import type { CoverageMatrix, DataSource } from "@shared/schema";

interface PlatformStats {
  properties: number;
  sales: number;
  marketAggregates: number;
  comps: number;
  aiChats: number;
  dataSources: number;
}

interface EtlStatus {
  lastRun: string | null;
  status: "not_configured" | string;
  recordsProcessed: number | null;
  errors: number | null;
  message?: string;
}

function formatDate(value: Date | string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "Not measured";
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

export default function AdminConsole() {
  const { user } = useAuth();
  const { data: stats, isLoading: loadingStats, isError: statsError } = useQuery<PlatformStats>({
    queryKey: ["/api/stats/platform"],
  });
  const { data: dataSources, isLoading: loadingSources, isError: sourcesError } = useQuery<DataSource[]>({
    queryKey: ["/api/admin/data-sources"],
    enabled: user?.role === "admin",
  });
  const { data: coverage, isLoading: loadingCoverage, isError: coverageError } = useQuery<CoverageMatrix[]>({
    queryKey: ["/api/admin/coverage"],
    enabled: user?.role === "admin",
  });
  const { data: etlStatus, isLoading: loadingEtl, isError: etlError } = useQuery<EtlStatus>({
    queryKey: ["/api/admin/etl-status"],
    enabled: user?.role === "admin",
  });

  if (user?.role !== "admin") {
    return (
      <AppLayout>
        <div className="mx-auto max-w-5xl px-4 py-8">
          <Card><CardContent className="py-16 text-center">
            <AlertCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Access denied</h1>
            <p className="mt-2 text-muted-foreground">An administrator account is required.</p>
          </CardContent></Card>
        </div>
      </AppLayout>
    );
  }

  const loading = loadingStats || loadingSources || loadingCoverage || loadingEtl;
  const hasError = statsError || sourcesError || coverageError || etlError;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Admin data status</h1>
          <p className="mt-1 text-muted-foreground">Only persisted database facts are shown. Missing telemetry is labeled explicitly.</p>
        </div>

        {loading && <LoadingState type="skeleton-cards" count={4} />}
        {hasError && (
          <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent className="flex gap-3 py-4 text-sm"><AlertCircle className="h-5 w-5 shrink-0" />Some admin facts could not be loaded. Values are not estimated.</CardContent>
          </Card>
        )}

        {!loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Published properties", stats?.properties],
              ["Recorded sales", stats?.sales],
              ["Market aggregates", stats?.marketAggregates],
              ["Comparable records", stats?.comps],
            ].map(([label, value]) => (
              <Card key={String(label)}><CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString() : "Unavailable"}</p>
              </CardContent></Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Pipeline telemetry</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <div><p className="text-muted-foreground">Status</p><p className="font-medium">{etlStatus?.status === "not_configured" ? "Not configured" : etlStatus?.status || "Unavailable"}</p></div>
            <div><p className="text-muted-foreground">Last recorded run</p><p className="font-medium">{formatDate(etlStatus?.lastRun || null)}</p></div>
            <div><p className="text-muted-foreground">Last recorded volume</p><p className="font-medium">{etlStatus?.recordsProcessed === null || etlStatus?.recordsProcessed === undefined ? "Not recorded" : etlStatus.recordsProcessed.toLocaleString()}</p></div>
            {etlStatus?.message && <p className="sm:col-span-3 text-muted-foreground">{etlStatus.message}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" />Configured data sources</CardTitle></CardHeader>
          <CardContent>
            {dataSources?.length ? (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Source</th><th>Cadence</th><th>Last refresh</th><th className="text-right">Records</th><th className="text-right">State</th></tr></thead>
                <tbody>{dataSources.map((source) => <tr key={source.id} className="border-b last:border-0">
                  <td className="py-3"><p className="font-medium">{source.name}</p><p className="text-xs text-muted-foreground">{source.description || source.type}</p></td>
                  <td>{source.refreshCadence || "Not configured"}</td><td>{formatDate(source.lastRefresh)}</td>
                  <td className="text-right tabular-nums">{source.recordCount?.toLocaleString() || "Not recorded"}</td>
                  <td className="text-right"><Badge variant={source.isActive ? "default" : "secondary"}>{source.isActive ? "Active" : "Inactive"}</Badge></td>
                </tr>)}</tbody>
              </table></div>
            ) : <p className="text-sm text-muted-foreground">No persisted data-source catalog entries are available.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Coverage and quality facts</CardTitle></CardHeader>
          <CardContent>
            {coverage?.length ? <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Geography</th><th>Coverage</th><th>Freshness SLA</th><th>Sqft</th><th>Year built</th><th>Last sale</th><th>Confidence</th></tr></thead>
              <tbody>{coverage.map((row) => <tr key={row.id} className="border-b last:border-0">
                <td className="py-3 font-medium">{[row.zipCode, row.county, row.state].filter(Boolean).join(", ")}</td><td>{row.coverageLevel}</td><td>{row.freshnessSla ? `${row.freshnessSla} days` : "Not set"}</td>
                <td>{formatPercent(row.sqftCompleteness)}</td><td>{formatPercent(row.yearBuiltCompleteness)}</td><td>{formatPercent(row.lastSaleCompleteness)}</td><td>{formatPercent(row.confidenceScore)}</td>
              </tr>)}</tbody>
            </table></div> : <p className="text-sm text-muted-foreground">No persisted coverage measurements are available.</p>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
