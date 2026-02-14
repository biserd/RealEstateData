import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, DollarSign, TrendingUp, Percent, Building2, PiggyBank, BarChart3, ArrowRight, Lock, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layouts";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/UpgradePrompt";
import { Link } from "wouter";

interface CalculatorInputs {
  purchasePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  loanTermYears: number;
  monthlyRent: number;
  vacancyRate: number;
  propertyTaxRate: number;
  insuranceAnnual: number;
  maintenancePercent: number;
  managementPercent: number;
  closingCostPercent: number;
  appreciationRate: number;
}

interface CalculatorResults {
  downPayment: number;
  loanAmount: number;
  monthlyMortgage: number;
  monthlyExpenses: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  annualNOI: number;
  capRate: number;
  cashOnCashReturn: number;
  grossRentMultiplier: number;
  debtServiceCoverageRatio: number;
  breakEvenOccupancy: number;
  totalCashNeeded: number;
  fiveYearEquity: number;
  fiveYearROI: number;
  monthlyExpenseBreakdown: {
    mortgage: number;
    propertyTax: number;
    insurance: number;
    maintenance: number;
    management: number;
    vacancy: number;
  };
}

function calculateResults(inputs: CalculatorInputs): CalculatorResults {
  const downPayment = inputs.purchasePrice * (inputs.downPaymentPercent / 100);
  const loanAmount = inputs.purchasePrice - downPayment;
  const closingCosts = inputs.purchasePrice * (inputs.closingCostPercent / 100);
  const totalCashNeeded = downPayment + closingCosts;

  const monthlyRate = inputs.interestRate / 100 / 12;
  const numPayments = inputs.loanTermYears * 12;
  const monthlyMortgage = monthlyRate > 0 && loanAmount > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : 0;

  const monthlyPropertyTax = (inputs.purchasePrice * (inputs.propertyTaxRate / 100)) / 12;
  const monthlyInsurance = inputs.insuranceAnnual / 12;
  const monthlyMaintenance = (inputs.purchasePrice * (inputs.maintenancePercent / 100)) / 12;
  const monthlyManagement = inputs.monthlyRent * (inputs.managementPercent / 100);
  const monthlyVacancy = inputs.monthlyRent * (inputs.vacancyRate / 100);

  const monthlyExpenses = monthlyMortgage + monthlyPropertyTax + monthlyInsurance + monthlyMaintenance + monthlyManagement + monthlyVacancy;
  const effectiveRent = inputs.monthlyRent * (1 - inputs.vacancyRate / 100);
  const monthlyCashFlow = effectiveRent - monthlyExpenses + monthlyVacancy;
  const annualCashFlow = monthlyCashFlow * 12;

  const annualGrossRent = inputs.monthlyRent * 12;
  const annualEffectiveRent = effectiveRent * 12;
  const annualOperatingExpenses = (monthlyPropertyTax + monthlyInsurance + monthlyMaintenance + monthlyManagement) * 12;
  const annualNOI = annualEffectiveRent - annualOperatingExpenses;

  const capRate = inputs.purchasePrice > 0 ? (annualNOI / inputs.purchasePrice) * 100 : 0;
  const cashOnCashReturn = totalCashNeeded > 0 ? (annualCashFlow / totalCashNeeded) * 100 : 0;
  const grossRentMultiplier = annualGrossRent > 0 ? inputs.purchasePrice / annualGrossRent : 0;
  const debtServiceCoverageRatio = monthlyMortgage > 0 ? annualNOI / (monthlyMortgage * 12) : 999;
  const breakEvenOccupancy = annualGrossRent > 0 ? ((annualOperatingExpenses + monthlyMortgage * 12) / annualGrossRent) * 100 : 0;

  const fiveYearAppreciation = inputs.purchasePrice * Math.pow(1 + inputs.appreciationRate / 100, 5) - inputs.purchasePrice;
  const fiveYearCashFlow = annualCashFlow * 5;
  const fiveYearEquity = fiveYearAppreciation + downPayment;
  const fiveYearROI = totalCashNeeded > 0 ? ((fiveYearCashFlow + fiveYearAppreciation) / totalCashNeeded) * 100 : 0;

  return {
    downPayment,
    loanAmount,
    monthlyMortgage,
    monthlyExpenses,
    monthlyCashFlow,
    annualCashFlow,
    annualNOI,
    capRate,
    cashOnCashReturn,
    grossRentMultiplier,
    debtServiceCoverageRatio,
    breakEvenOccupancy,
    totalCashNeeded,
    fiveYearEquity,
    fiveYearROI,
    monthlyExpenseBreakdown: {
      mortgage: monthlyMortgage,
      propertyTax: monthlyPropertyTax,
      insurance: monthlyInsurance,
      maintenance: monthlyMaintenance,
      management: monthlyManagement,
      vacancy: monthlyVacancy,
    },
  };
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function MetricCard({ label, value, description, positive, icon }: {
  label: string;
  value: string;
  description?: string;
  positive?: boolean | null;
  icon: typeof DollarSign;
}) {
  const Icon = icon;
  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">{label}</p>
            <p className={`text-xl font-bold tabular-nums mt-1 ${positive === true ? "text-emerald-600 dark:text-emerald-400" : positive === false ? "text-red-600 dark:text-red-400" : ""}`} data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
              {value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InputField({ label, value, onChange, prefix, suffix, tooltip, min, max, step, type = "number" }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  tooltip?: string;
  min?: number;
  max?: number;
  step?: number;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label className="text-sm">{label}</Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>
        )}
        <Input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          min={min}
          max={max}
          step={step || 1}
          className={`${prefix ? "pl-7" : ""} ${suffix ? "pr-8" : ""}`}
          data-testid={`input-${label.toLowerCase().replace(/\s+/g, "-")}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export default function InvestmentCalculator() {
  const { isPro, isFree } = useSubscription();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const [inputs, setInputs] = useState<CalculatorInputs>({
    purchasePrice: 500000,
    downPaymentPercent: 20,
    interestRate: 6.5,
    loanTermYears: 30,
    monthlyRent: 3000,
    vacancyRate: 5,
    propertyTaxRate: 1.2,
    insuranceAnnual: 2400,
    maintenancePercent: 1,
    managementPercent: 8,
    closingCostPercent: 3,
    appreciationRate: 3,
  });

  const updateInput = (key: keyof CalculatorInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const results = useMemo(() => calculateResults(inputs), [inputs]);

  const { data: marketContext } = useQuery<{ medianPrice: number; medianPricePerSqft: number; trend3m: number } | null>({
    queryKey: ["/api/market/overview"],
    queryFn: async () => {
      if (!isPro) return null;
      const res = await fetch("/api/market/overview", { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || data.length === 0) return null;
      const ny = data.find((s: any) => s.geoId === "NY");
      return ny ? { medianPrice: ny.medianPrice, medianPricePerSqft: ny.medianPricePerSqft, trend3m: ny.trend3m } : null;
    },
    enabled: isPro,
  });

  const expenseBreakdown = results.monthlyExpenseBreakdown;
  const totalMonthlyExpense = Object.values(expenseBreakdown).reduce((sum, v) => sum + v, 0);

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl" data-testid="text-page-title">Investment Calculator</h1>
              <p className="text-muted-foreground">
                Analyze returns for any rental property investment
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* Input Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Property Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InputField
                  label="Purchase Price"
                  value={inputs.purchasePrice}
                  onChange={(v) => updateInput("purchasePrice", v)}
                  prefix="$"
                  tooltip="Total acquisition price of the property"
                />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-sm">Down Payment</Label>
                    <span className="text-sm font-medium tabular-nums">{inputs.downPaymentPercent}% ({formatCurrency(inputs.purchasePrice * inputs.downPaymentPercent / 100)})</span>
                  </div>
                  <Slider
                    value={[inputs.downPaymentPercent]}
                    onValueChange={([v]) => updateInput("downPaymentPercent", v)}
                    min={0}
                    max={100}
                    step={5}
                    data-testid="slider-down-payment"
                  />
                </div>
                <InputField
                  label="Interest Rate"
                  value={inputs.interestRate}
                  onChange={(v) => updateInput("interestRate", v)}
                  suffix="%"
                  step={0.1}
                  tooltip="Annual mortgage interest rate"
                />
                <InputField
                  label="Loan Term"
                  value={inputs.loanTermYears}
                  onChange={(v) => updateInput("loanTermYears", v)}
                  suffix="yrs"
                  tooltip="Length of the mortgage in years"
                />
                <InputField
                  label="Closing Costs"
                  value={inputs.closingCostPercent}
                  onChange={(v) => updateInput("closingCostPercent", v)}
                  suffix="%"
                  step={0.5}
                  tooltip="Closing costs as percentage of purchase price"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Income & Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InputField
                  label="Monthly Rent"
                  value={inputs.monthlyRent}
                  onChange={(v) => updateInput("monthlyRent", v)}
                  prefix="$"
                  tooltip="Expected gross monthly rental income"
                />
                <InputField
                  label="Vacancy Rate"
                  value={inputs.vacancyRate}
                  onChange={(v) => updateInput("vacancyRate", v)}
                  suffix="%"
                  tooltip="Expected percentage of time the property is vacant"
                />
                <InputField
                  label="Property Tax Rate"
                  value={inputs.propertyTaxRate}
                  onChange={(v) => updateInput("propertyTaxRate", v)}
                  suffix="%"
                  step={0.1}
                  tooltip="Annual property tax as percentage of property value"
                />
                <InputField
                  label="Annual Insurance"
                  value={inputs.insuranceAnnual}
                  onChange={(v) => updateInput("insuranceAnnual", v)}
                  prefix="$"
                  tooltip="Annual property insurance cost"
                />
                <InputField
                  label="Maintenance"
                  value={inputs.maintenancePercent}
                  onChange={(v) => updateInput("maintenancePercent", v)}
                  suffix="%"
                  step={0.25}
                  tooltip="Annual maintenance as percentage of property value (1-2% typical)"
                />
                <InputField
                  label="Management Fee"
                  value={inputs.managementPercent}
                  onChange={(v) => updateInput("managementPercent", v)}
                  suffix="%"
                  tooltip="Property management fee as percentage of rent (8-12% typical)"
                />
                <InputField
                  label="Annual Appreciation"
                  value={inputs.appreciationRate}
                  onChange={(v) => updateInput("appreciationRate", v)}
                  suffix="%"
                  step={0.5}
                  tooltip="Expected annual property value appreciation"
                />
              </CardContent>
            </Card>
          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard
                label="Monthly Cash Flow"
                value={`$${results.monthlyCashFlow.toFixed(0)}`}
                positive={results.monthlyCashFlow > 0}
                description={results.monthlyCashFlow > 0 ? "Positive cash flow" : "Negative cash flow"}
                icon={PiggyBank}
              />
              <MetricCard
                label="Cap Rate"
                value={`${results.capRate.toFixed(1)}%`}
                positive={results.capRate > 5 ? true : results.capRate > 3 ? null : false}
                description={results.capRate > 8 ? "Strong" : results.capRate > 5 ? "Good" : results.capRate > 3 ? "Fair" : "Low"}
                icon={Percent}
              />
              <MetricCard
                label="Cash-on-Cash"
                value={`${results.cashOnCashReturn.toFixed(1)}%`}
                positive={results.cashOnCashReturn > 8 ? true : results.cashOnCashReturn > 0 ? null : false}
                description="Annual return on cash invested"
                icon={TrendingUp}
              />
              <MetricCard
                label="5-Year ROI"
                value={`${results.fiveYearROI.toFixed(1)}%`}
                positive={results.fiveYearROI > 0}
                description="Including appreciation"
                icon={BarChart3}
              />
            </div>

            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Cash Required</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Down Payment</span>
                        <span className="font-medium tabular-nums">${results.downPayment.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Closing Costs</span>
                        <span className="font-medium tabular-nums">${(results.totalCashNeeded - results.downPayment).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="font-medium">Total Cash Needed</span>
                        <span className="font-bold tabular-nums">${results.totalCashNeeded.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Annual Returns</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Net Operating Income</span>
                        <span className="font-medium tabular-nums">${results.annualNOI.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Annual Cash Flow</span>
                        <span className={`font-medium tabular-nums ${results.annualCashFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          ${results.annualCashFlow.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Gross Rent Multiplier</span>
                        <span className="font-medium tabular-nums">{results.grossRentMultiplier.toFixed(1)}x</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Expense Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Mortgage", value: expenseBreakdown.mortgage, color: "bg-primary" },
                    { label: "Property Tax", value: expenseBreakdown.propertyTax, color: "bg-amber-500" },
                    { label: "Insurance", value: expenseBreakdown.insurance, color: "bg-blue-500" },
                    { label: "Maintenance", value: expenseBreakdown.maintenance, color: "bg-emerald-500" },
                    { label: "Management", value: expenseBreakdown.management, color: "bg-purple-500" },
                    { label: "Vacancy Reserve", value: expenseBreakdown.vacancy, color: "bg-red-500" },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground tabular-nums">
                            {totalMonthlyExpense > 0 ? `${((value / totalMonthlyExpense) * 100).toFixed(0)}%` : "0%"}
                          </span>
                          <span className="text-sm font-medium tabular-nums w-20 text-right">${value.toFixed(0)}</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all`}
                          style={{ width: `${totalMonthlyExpense > 0 ? (value / totalMonthlyExpense) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm border-t pt-3 mt-3">
                    <span className="font-medium">Total Monthly Expenses</span>
                    <span className="font-bold tabular-nums">${totalMonthlyExpense.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Monthly Rent Income</span>
                    <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">${inputs.monthlyRent.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Indicators */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Debt Service Coverage</p>
                    <p className="text-lg font-bold tabular-nums" data-testid="stat-dscr">{results.debtServiceCoverageRatio > 100 ? "N/A" : `${results.debtServiceCoverageRatio.toFixed(2)}x`}</p>
                    <Badge variant={results.debtServiceCoverageRatio >= 1.25 ? "default" : results.debtServiceCoverageRatio >= 1.0 ? "secondary" : "destructive"}>
                      {results.debtServiceCoverageRatio >= 1.25 ? "Strong" : results.debtServiceCoverageRatio >= 1.0 ? "Adequate" : "At Risk"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Break-Even Occupancy</p>
                    <p className="text-lg font-bold tabular-nums" data-testid="stat-break-even">{results.breakEvenOccupancy.toFixed(1)}%</p>
                    <Badge variant={results.breakEvenOccupancy <= 75 ? "default" : results.breakEvenOccupancy <= 90 ? "secondary" : "destructive"}>
                      {results.breakEvenOccupancy <= 75 ? "Comfortable" : results.breakEvenOccupancy <= 90 ? "Tight" : "Risky"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">5-Year Equity</p>
                    <p className="text-lg font-bold tabular-nums" data-testid="stat-equity">{formatCurrency(results.fiveYearEquity)}</p>
                    <Badge variant="secondary">Projected</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pro Market Context */}
            {isPro && marketContext ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Market Context
                    <Badge variant="secondary">Pro</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">NY Median Price</p>
                      <p className="text-lg font-bold tabular-nums">{formatCurrency(marketContext.medianPrice)}</p>
                      <p className="text-xs text-muted-foreground">
                        Your price is {inputs.purchasePrice < marketContext.medianPrice ? "below" : "above"} median
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Market Trend (3mo)</p>
                      <p className={`text-lg font-bold ${(marketContext.trend3m || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {((marketContext.trend3m || 0) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Median $/sqft</p>
                      <p className="text-lg font-bold tabular-nums">${marketContext.medianPricePerSqft}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : isFree ? (
              <Card className="relative overflow-visible">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Market Context
                    <Badge variant="secondary">
                      <Lock className="mr-1 h-3 w-3" />
                      Pro
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="opacity-30 blur-sm pointer-events-none">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <p className="text-sm text-muted-foreground">NY Median Price</p>
                          <p className="text-lg font-bold">$650K</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Market Trend</p>
                          <p className="text-lg font-bold">+2.3%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Median $/sqft</p>
                          <p className="text-lg font-bold">$425</p>
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button variant="outline" size="sm" onClick={() => setUpgradeOpen(true)} data-testid="button-unlock-market-context">
                        <Lock className="mr-1 h-3 w-3" />
                        Unlock Market Context
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Related Actions */}
            <div className="flex flex-wrap gap-3">
              <Link href="/investment-opportunities">
                <Button variant="outline" data-testid="link-screener">
                  <Building2 className="mr-2 h-4 w-4" />
                  Find Properties
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/market-intelligence">
                <Button variant="outline" data-testid="link-market">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Market Explorer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="Market Context"
        description="Get real-time market data alongside your investment calculations, including median prices, trends, and comparable analysis for any area."
      />
    </AppLayout>
  );
}
