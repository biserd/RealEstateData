import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building, Clock, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BuildingSale {
  id: string;
  unitBbl?: string | null;
  salePrice: number;
  saleDate: string;
  rawAddress: string | null;
  rawAptNumber: string | null;
}

interface BuildingSalesResponse {
  baseBbl: string;
  sales: BuildingSale[];
  count: number;
}

interface UnitSalesResponse {
  unitBbl: string;
  sales: BuildingSale[];
  count: number;
}

interface BuildingSalesHistoryProps {
  bbl: string | null | undefined;
  isCondoUnit?: boolean;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

function extractUnitNumber(rawAddress: string | null, rawAptNumber: string | null): string {
  if (rawAptNumber) return rawAptNumber;
  if (!rawAddress) return "-";
  const match = rawAddress.match(/,\s*([^,]+)$/);
  return match ? match[1].trim() : "-";
}

export function BuildingSalesHistory({ bbl, isCondoUnit = false }: BuildingSalesHistoryProps) {
  const { data: buildingSales, isLoading: buildingLoading } = useQuery<BuildingSalesResponse>({
    queryKey: ["/api/buildings", bbl, "sales"],
    queryFn: async () => {
      const res = await fetch(`/api/buildings/${bbl}/sales?limit=20`);
      if (!res.ok) throw new Error("Failed to fetch building sales");
      return res.json();
    },
    enabled: !!bbl,
  });

  const { data: unitSales, isLoading: unitLoading } = useQuery<UnitSalesResponse>({
    queryKey: ["/api/units", bbl, "sales"],
    queryFn: async () => {
      const res = await fetch(`/api/units/${bbl}/sales`);
      if (!res.ok) throw new Error("Failed to fetch unit sales");
      return res.json();
    },
    enabled: !!bbl && isCondoUnit,
  });

  const isLoading = buildingLoading || (isCondoUnit && unitLoading);
  const sales = buildingSales?.sales || [];
  const unitHistory = unitSales?.sales || [];

  if (!bbl) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">
            Sales history not available for this property.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const avgPrice = sales.length > 0
    ? sales.reduce((sum, s) => sum + s.salePrice, 0) / sales.length
    : 0;

  const recentSales = sales.slice(0, 5);
  const oldestInRecent = recentSales[recentSales.length - 1];
  const newestInRecent = recentSales[0];
  const priceChange = oldestInRecent && newestInRecent && sales.length >= 2
    ? ((newestInRecent.salePrice - oldestInRecent.salePrice) / oldestInRecent.salePrice) * 100
    : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Building Sales</p>
              <p className="text-2xl font-bold" data-testid="text-building-sales-count">
                {buildingSales?.count || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Sale Price</p>
              <p className="text-2xl font-bold" data-testid="text-avg-sale-price">
                {avgPrice > 0 ? formatPrice(avgPrice) : "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${
              priceChange !== null && priceChange >= 0 
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" 
                : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            }`}>
              {priceChange !== null && priceChange >= 0 ? (
                <TrendingUp className="h-6 w-6" />
              ) : (
                <TrendingDown className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price Trend</p>
              <p className={`text-2xl font-bold ${
                priceChange !== null && priceChange >= 0 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-red-600 dark:text-red-400"
              }`} data-testid="text-price-trend">
                {priceChange !== null ? `${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(1)}%` : "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isCondoUnit && unitHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              This Unit's Sale History
              <Badge variant="secondary">{unitHistory.length} sale{unitHistory.length !== 1 ? "s" : ""}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead className="hidden md:table-cell">Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unitHistory.map((sale) => (
                  <TableRow key={sale.id} data-testid={`row-unit-sale-${sale.id}`}>
                    <TableCell className="font-medium">{formatDate(sale.saleDate)}</TableCell>
                    <TableCell>{formatPrice(sale.salePrice)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {sale.rawAddress || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Recent Building Sales
            <Badge variant="secondary">{sales.length} shown</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead className="hidden md:table-cell">Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id} data-testid={`row-building-sale-${sale.id}`}>
                    <TableCell>
                      <Badge variant="outline">
                        {extractUnitNumber(sale.rawAddress, sale.rawAptNumber)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatDate(sale.saleDate)}</TableCell>
                    <TableCell>{formatPrice(sale.salePrice)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground truncate max-w-[200px]">
                      {sale.rawAddress || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No sales history available for this building.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
