import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  BarChart3,
  FileText,
  Map,
  Settings,
  Download,
  Search
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppLayout } from "@/components/layouts";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { DataSource, CoverageMatrix as CoverageMatrixType } from "@shared/schema";

export default function AdminConsole() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const { data: dataSources, isLoading: loadingDataSources } = useQuery<DataSource[]>({
    queryKey: ["/api/admin/data-sources"],
  });

  const handleExportCoverage = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/export/admin-data", {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "admin-data-export.json";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: "Admin data exported successfully.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Unable to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const { data: coverageMatrix, isLoading: loadingCoverage } = useQuery<CoverageMatrixType[]>({
    queryKey: ["/api/admin/coverage"],
  });

  const { data: etlStatus } = useQuery<{
    lastRun: string;
    status: string;
    recordsProcessed: number;
    errors: number;
  }>({
    queryKey: ["/api/admin/etl-status"],
  });

  const qualityMetrics = {
    sqftCompleteness: 87,
    yearBuiltCompleteness: 92,
    lastSaleCompleteness: 78,
    overallScore: 85,
  };

  if (user?.role !== "admin") {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-semibold">Access Denied</h2>
              <p className="text-muted-foreground">
                You don't have permission to access the admin console.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Admin Console</h1>
          <p className="text-muted-foreground">
            Manage data sources, coverage, and system health
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ETL Status</p>
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  Healthy
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Properties</p>
                <p className="text-lg font-semibold">1.2M</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Map className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ZIPs Covered</p>
                <p className="text-lg font-semibold">2,847</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data Quality</p>
                <p className="text-lg font-semibold">{qualityMetrics.overallScore}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="catalog" className="space-y-6">
          <TabsList>
            <TabsTrigger value="catalog" data-testid="tab-catalog">
              <FileText className="mr-2 h-4 w-4" />
              Data Catalog
            </TabsTrigger>
            <TabsTrigger value="coverage" data-testid="tab-coverage">
              <Map className="mr-2 h-4 w-4" />
              Coverage Matrix
            </TabsTrigger>
            <TabsTrigger value="quality" data-testid="tab-quality">
              <BarChart3 className="mr-2 h-4 w-4" />
              Data Quality
            </TabsTrigger>
            <TabsTrigger value="etl" data-testid="tab-etl">
              <RefreshCw className="mr-2 h-4 w-4" />
              ETL Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Data Sources</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search sources..."
                      className="pl-9 w-64"
                      data-testid="input-search-sources"
                    />
                  </div>
                  <Button variant="outline" data-testid="button-add-source">
                    Add Source
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDataSources ? (
                  <LoadingState type="skeleton-list" count={5} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Refresh</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Records</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        {
                          name: "NYC Property Records",
                          type: "public",
                          refresh: "Daily",
                          lastUpdated: "2 hours ago",
                          records: "890K",
                          status: "active",
                        },
                        {
                          name: "NJ Property Tax",
                          type: "public",
                          refresh: "Weekly",
                          lastUpdated: "3 days ago",
                          records: "245K",
                          status: "active",
                        },
                        {
                          name: "CT Assessor Data",
                          type: "public",
                          refresh: "Weekly",
                          lastUpdated: "5 days ago",
                          records: "180K",
                          status: "active",
                        },
                        {
                          name: "ACRIS Transactions",
                          type: "public",
                          refresh: "Daily",
                          lastUpdated: "1 hour ago",
                          records: "1.2M",
                          status: "active",
                        },
                        {
                          name: "NYC DOB Permits",
                          type: "public",
                          refresh: "Daily",
                          lastUpdated: "4 hours ago",
                          records: "450K",
                          status: "active",
                        },
                      ].map((source) => (
                        <TableRow key={source.name}>
                          <TableCell className="font-medium">{source.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{source.type}</Badge>
                          </TableCell>
                          <TableCell>{source.refresh}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {source.lastUpdated}
                          </TableCell>
                          <TableCell className="tabular-nums">{source.records}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <div className="h-2 w-2 rounded-full bg-emerald-500" />
                              Active
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coverage">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Coverage by State</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={handleExportCoverage}
                  disabled={isExporting}
                  data-testid="button-export-coverage"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? "Exporting..." : "Export"}
                </Button>
              </CardHeader>
              <CardContent>
                {loadingCoverage ? (
                  <LoadingState type="skeleton-list" count={3} />
                ) : (
                  <div className="space-y-6">
                    {[
                      {
                        state: "New York",
                        level: "AltSignals",
                        freshness: 1,
                        sqft: 92,
                        yearBuilt: 95,
                        lastSale: 88,
                        confidence: 0.91,
                      },
                      {
                        state: "New Jersey",
                        level: "Comps",
                        freshness: 7,
                        sqft: 85,
                        yearBuilt: 88,
                        lastSale: 75,
                        confidence: 0.78,
                      },
                      {
                        state: "Connecticut",
                        level: "SalesHistory",
                        freshness: 7,
                        sqft: 78,
                        yearBuilt: 82,
                        lastSale: 68,
                        confidence: 0.72,
                      },
                    ].map((row) => (
                      <div key={row.state} className="rounded-lg border p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{row.state}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline">{row.level}</Badge>
                              <span>Freshness: {row.freshness} days</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">
                              {(row.confidence * 100).toFixed(0)}%
                            </p>
                            <p className="text-sm text-muted-foreground">Confidence</p>
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <div className="mb-1 flex justify-between text-sm">
                              <span className="text-muted-foreground">Sqft Completeness</span>
                              <span className="font-medium">{row.sqft}%</span>
                            </div>
                            <Progress value={row.sqft} className="h-2" />
                          </div>
                          <div>
                            <div className="mb-1 flex justify-between text-sm">
                              <span className="text-muted-foreground">Year Built</span>
                              <span className="font-medium">{row.yearBuilt}%</span>
                            </div>
                            <Progress value={row.yearBuilt} className="h-2" />
                          </div>
                          <div>
                            <div className="mb-1 flex justify-between text-sm">
                              <span className="text-muted-foreground">Last Sale</span>
                              <span className="font-medium">{row.lastSale}%</span>
                            </div>
                            <Progress value={row.lastSale} className="h-2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Field Completeness</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { field: "Square Footage", value: 87 },
                    { field: "Year Built", value: 92 },
                    { field: "Last Sale Price", value: 78 },
                    { field: "Last Sale Date", value: 76 },
                    { field: "Property Type", value: 98 },
                    { field: "Beds/Baths", value: 85 },
                  ].map((metric) => (
                    <div key={metric.field}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">{metric.field}</span>
                        <span className="font-medium">{metric.value}%</span>
                      </div>
                      <Progress
                        value={metric.value}
                        className={`h-2 ${
                          metric.value >= 85
                            ? "[&>div]:bg-emerald-500"
                            : metric.value >= 70
                              ? "[&>div]:bg-amber-500"
                              : "[&>div]:bg-red-500"
                        }`}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Quality Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      {
                        type: "Missing sqft",
                        count: 156432,
                        severity: "warning",
                      },
                      {
                        type: "Missing last sale",
                        count: 234891,
                        severity: "warning",
                      },
                      {
                        type: "Outlier prices (>3 std)",
                        count: 1247,
                        severity: "error",
                      },
                      {
                        type: "Duplicate records",
                        count: 892,
                        severity: "error",
                      },
                      {
                        type: "Invalid year built",
                        count: 3421,
                        severity: "warning",
                      },
                    ].map((issue) => (
                      <div
                        key={issue.type}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <AlertCircle
                            className={`h-5 w-5 ${
                              issue.severity === "error"
                                ? "text-red-500"
                                : "text-amber-500"
                            }`}
                          />
                          <span>{issue.type}</span>
                        </div>
                        <Badge variant="outline" className="tabular-nums">
                          {issue.count.toLocaleString()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="etl">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent ETL Runs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      {
                        job: "Daily Aggregates",
                        time: "Today, 6:00 AM",
                        duration: "12m 34s",
                        status: "success",
                        records: 45823,
                      },
                      {
                        job: "NYC Property Sync",
                        time: "Today, 5:30 AM",
                        duration: "8m 12s",
                        status: "success",
                        records: 12456,
                      },
                      {
                        job: "Opportunity Scoring",
                        time: "Today, 4:00 AM",
                        duration: "45m 23s",
                        status: "success",
                        records: 890234,
                      },
                      {
                        job: "Comps Computation",
                        time: "Yesterday, 11:00 PM",
                        duration: "1h 23m",
                        status: "success",
                        records: 234567,
                      },
                      {
                        job: "NJ Data Refresh",
                        time: "Yesterday, 6:00 AM",
                        duration: "15m 45s",
                        status: "warning",
                        records: 34521,
                      },
                    ].map((run, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">{run.job}</p>
                          <p className="text-sm text-muted-foreground">
                            {run.time} • {run.duration}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground tabular-nums">
                            {run.records.toLocaleString()} records
                          </span>
                          <div
                            className={`flex items-center gap-1 ${
                              run.status === "success"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : run.status === "warning"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {run.status === "success" ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <AlertCircle className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Scheduled Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      {
                        job: "Daily Aggregates",
                        schedule: "Every day at 6:00 AM",
                        nextRun: "Tomorrow, 6:00 AM",
                        enabled: true,
                      },
                      {
                        job: "NYC Property Sync",
                        schedule: "Every day at 5:30 AM",
                        nextRun: "Tomorrow, 5:30 AM",
                        enabled: true,
                      },
                      {
                        job: "Opportunity Scoring",
                        schedule: "Every day at 4:00 AM",
                        nextRun: "Tomorrow, 4:00 AM",
                        enabled: true,
                      },
                      {
                        job: "Weekly NJ Refresh",
                        schedule: "Every Sunday at 6:00 AM",
                        nextRun: "Sunday, 6:00 AM",
                        enabled: true,
                      },
                      {
                        job: "Weekly CT Refresh",
                        schedule: "Every Sunday at 8:00 AM",
                        nextRun: "Sunday, 8:00 AM",
                        enabled: true,
                      },
                    ].map((job, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">{job.job}</p>
                          <p className="text-sm text-muted-foreground">{job.schedule}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {job.nextRun}
                          </div>
                          <div
                            className={`h-2 w-2 rounded-full ${
                              job.enabled ? "bg-emerald-500" : "bg-muted"
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
