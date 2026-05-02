import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calculator, DollarSign, TrendingUp, Percent, Building2, PiggyBank,
  BarChart3, ArrowRight, Lock, Info, Search, Share2, RotateCcw,
  Bookmark, Trash2, Check, Wifi, X, Hammer,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AppLayout } from "@/components/layouts";
import { SEO } from "@/components/SEO";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, Legend, ReferenceLine,
} from "recharts";

// ───────────────────────────────────────────── Types ─────────────────────────────────────────────

type Mode = "standard" | "refinance" | "brrrr";

interface CalculatorInputs {
  mode: Mode;
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
  rentGrowthRate: number;
  expenseGrowthRate: number;
  // Refinance scenario
  refiYear: number;
  refiInterestRate: number;
  refiLoanTermYears: number;
  refiClosingCostPercent: number;
  // BRRRR scenario
  rehabCost: number;
  rehabMonths: number;
  arv: number; // After Repair Value
}

interface ProjectionRow {
  year: number;
  cashFlow: number;
  cumulativeCashFlow: number;
  propertyValue: number;
  loanBalance: number;
  equity: number;
  totalReturn: number;
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
  fiveYearROI: number;
  thirtyYearROI: number;
  projection: ProjectionRow[];
  monthlyExpenseBreakdown: {
    mortgage: number;
    propertyTax: number;
    insurance: number;
    maintenance: number;
    management: number;
    vacancy: number;
  };
  // BRRRR-specific
  brrrr?: {
    totalProjectCost: number;
    refinanceLoan: number;
    cashOut: number;
    cashLeftIn: number;
    infiniteReturn: boolean;
  };
}

// ──────────────────────────────────────── Calculation core ───────────────────────────────────────

function pmt(principal: number, monthlyRate: number, numPayments: number): number {
  if (principal <= 0 || numPayments <= 0) return 0;
  if (monthlyRate <= 0) return principal / numPayments;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
}

function balanceAfterMonths(principal: number, monthlyRate: number, numPayments: number, monthsElapsed: number): number {
  if (principal <= 0) return 0;
  if (monthsElapsed >= numPayments) return 0;
  const payment = pmt(principal, monthlyRate, numPayments);
  if (monthlyRate <= 0) return Math.max(0, principal - payment * monthsElapsed);
  const fv = principal * Math.pow(1 + monthlyRate, monthsElapsed) -
    payment * (Math.pow(1 + monthlyRate, monthsElapsed) - 1) / monthlyRate;
  return Math.max(0, fv);
}

function calculateResults(inputs: CalculatorInputs): CalculatorResults {
  const downPayment = inputs.purchasePrice * (inputs.downPaymentPercent / 100);
  const loanAmount = inputs.purchasePrice - downPayment;
  const closingCosts = inputs.purchasePrice * (inputs.closingCostPercent / 100);
  let totalCashNeeded = downPayment + closingCosts;
  if (inputs.mode === "brrrr") totalCashNeeded += inputs.rehabCost;

  const monthlyRate = inputs.interestRate / 100 / 12;
  const numPayments = inputs.loanTermYears * 12;
  const monthlyMortgage = pmt(loanAmount, monthlyRate, numPayments);

  const monthlyPropertyTax = (inputs.purchasePrice * (inputs.propertyTaxRate / 100)) / 12;
  const monthlyInsurance = inputs.insuranceAnnual / 12;
  const monthlyMaintenance = (inputs.purchasePrice * (inputs.maintenancePercent / 100)) / 12;
  const monthlyManagement = inputs.monthlyRent * (inputs.managementPercent / 100);
  const monthlyVacancy = inputs.monthlyRent * (inputs.vacancyRate / 100);

  const monthlyOperating = monthlyPropertyTax + monthlyInsurance + monthlyMaintenance + monthlyManagement;
  const effectiveRent = inputs.monthlyRent * (1 - inputs.vacancyRate / 100);
  const monthlyCashFlow = effectiveRent - monthlyOperating - monthlyMortgage;
  const annualCashFlow = monthlyCashFlow * 12;
  const monthlyExpenses = monthlyOperating + monthlyMortgage + monthlyVacancy;

  const annualGrossRent = inputs.monthlyRent * 12;
  const annualEffectiveRent = effectiveRent * 12;
  const annualOperatingExpenses = monthlyOperating * 12;
  const annualNOI = annualEffectiveRent - annualOperatingExpenses;

  const capRate = inputs.purchasePrice > 0 ? (annualNOI / inputs.purchasePrice) * 100 : 0;
  const cashOnCashReturn = totalCashNeeded > 0 ? (annualCashFlow / totalCashNeeded) * 100 : 0;
  const grossRentMultiplier = annualGrossRent > 0 ? inputs.purchasePrice / annualGrossRent : 0;
  const debtServiceCoverageRatio = monthlyMortgage > 0 ? annualNOI / (monthlyMortgage * 12) : 999;
  const breakEvenOccupancy = annualGrossRent > 0
    ? ((annualOperatingExpenses + monthlyMortgage * 12) / annualGrossRent) * 100
    : 0;

  // ── 30-year projection ──
  const projection: ProjectionRow[] = [];
  let curRent = inputs.monthlyRent;
  let curOpExpenseAnnual = annualOperatingExpenses;
  let curMortgage = monthlyMortgage;
  let curMonthlyRate = monthlyRate;
  let curNumPayments = numPayments;
  let curLoanAmount = loanAmount;
  let monthsElapsed = 0;
  let cumCashFlow = 0;
  let curValue = inputs.mode === "brrrr" ? inputs.purchasePrice : inputs.purchasePrice;

  // BRRRR: jump value to ARV after rehab months and refinance at year 1
  let brrrr: CalculatorResults["brrrr"] | undefined;
  if (inputs.mode === "brrrr") {
    curValue = inputs.arv > 0 ? inputs.arv : inputs.purchasePrice;
    const refiLoan = curValue * 0.75; // standard 75% LTV cash-out refi
    const refiClosing = curValue * (inputs.refiClosingCostPercent / 100);
    const cashOut = refiLoan - loanAmount - refiClosing;
    const totalProjectCost = inputs.purchasePrice + inputs.rehabCost + closingCosts;
    const cashLeftIn = Math.max(0, totalProjectCost - refiLoan);
    brrrr = {
      totalProjectCost,
      refinanceLoan: refiLoan,
      cashOut,
      cashLeftIn,
      infiniteReturn: cashLeftIn <= 0,
    };
    // Use refinanced loan as the active loan from year 1 onward
    curLoanAmount = refiLoan;
    curMonthlyRate = (inputs.refiInterestRate || inputs.interestRate) / 100 / 12;
    curNumPayments = (inputs.refiLoanTermYears || inputs.loanTermYears) * 12;
    curMortgage = pmt(curLoanAmount, curMonthlyRate, curNumPayments);
  }

  for (let year = 1; year <= 30; year++) {
    // Refinance event (standard mode only)
    if (inputs.mode === "refinance" && year === inputs.refiYear) {
      const balance = balanceAfterMonths(loanAmount, monthlyRate, numPayments, monthsElapsed);
      curLoanAmount = balance;
      curMonthlyRate = inputs.refiInterestRate / 100 / 12;
      curNumPayments = inputs.refiLoanTermYears * 12;
      monthsElapsed = 0;
      const refiClosing = balance * (inputs.refiClosingCostPercent / 100);
      cumCashFlow -= refiClosing; // closing costs come out of pocket
      curMortgage = pmt(curLoanAmount, curMonthlyRate, curNumPayments);
    }

    const yearGrossRent = curRent * 12;
    const yearEffectiveRent = yearGrossRent * (1 - inputs.vacancyRate / 100);
    const yearMortgage = curMortgage * 12;
    const yearCashFlow = yearEffectiveRent - curOpExpenseAnnual - yearMortgage;
    cumCashFlow += yearCashFlow;
    monthsElapsed += 12;
    const balance = balanceAfterMonths(curLoanAmount, curMonthlyRate, curNumPayments, monthsElapsed);
    curValue = curValue * (1 + inputs.appreciationRate / 100);
    const equity = curValue - balance;
    const totalReturn = cumCashFlow + (equity - downPayment);
    projection.push({
      year,
      cashFlow: yearCashFlow,
      cumulativeCashFlow: cumCashFlow,
      propertyValue: curValue,
      loanBalance: balance,
      equity,
      totalReturn,
    });
    curRent = curRent * (1 + inputs.rentGrowthRate / 100);
    curOpExpenseAnnual = curOpExpenseAnnual * (1 + inputs.expenseGrowthRate / 100);
  }

  const fiveYearROI = totalCashNeeded > 0 ? (projection[4].totalReturn / totalCashNeeded) * 100 : 0;
  const thirtyYearROI = totalCashNeeded > 0 ? (projection[29].totalReturn / totalCashNeeded) * 100 : 0;

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
    fiveYearROI,
    thirtyYearROI,
    projection,
    monthlyExpenseBreakdown: {
      mortgage: monthlyMortgage,
      propertyTax: monthlyPropertyTax,
      insurance: monthlyInsurance,
      maintenance: monthlyMaintenance,
      management: monthlyManagement,
      vacancy: monthlyVacancy,
    },
    brrrr,
  };
}

// ─────────────────────────────────────── Helpers / formatters ────────────────────────────────────

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

const DEFAULT_INPUTS: CalculatorInputs = {
  mode: "standard",
  purchasePrice: 500000,
  downPaymentPercent: 20,
  interestRate: 6.5,
  loanTermYears: 30,
  monthlyRent: 3000,
  vacancyRate: 5,
  propertyTaxRate: 1.4,
  insuranceAnnual: 2400,
  maintenancePercent: 1,
  managementPercent: 8,
  closingCostPercent: 3,
  appreciationRate: 3,
  rentGrowthRate: 2.5,
  expenseGrowthRate: 2,
  refiYear: 5,
  refiInterestRate: 5.5,
  refiLoanTermYears: 30,
  refiClosingCostPercent: 2,
  rehabCost: 50000,
  rehabMonths: 4,
  arv: 600000,
};

const URL_KEY_MAP: Record<keyof CalculatorInputs, string> = {
  mode: "m", purchasePrice: "p", downPaymentPercent: "dp", interestRate: "ir",
  loanTermYears: "lt", monthlyRent: "r", vacancyRate: "vr", propertyTaxRate: "ptr",
  insuranceAnnual: "ins", maintenancePercent: "mn", managementPercent: "mg",
  closingCostPercent: "cc", appreciationRate: "ar", rentGrowthRate: "rg",
  expenseGrowthRate: "eg", refiYear: "ry", refiInterestRate: "rir",
  refiLoanTermYears: "rlt", refiClosingCostPercent: "rcc", rehabCost: "rh",
  rehabMonths: "rhm", arv: "arv",
};

function inputsToUrlParams(inputs: CalculatorInputs): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, urlKey] of Object.entries(URL_KEY_MAP) as Array<[keyof CalculatorInputs, string]>) {
    const v = inputs[key];
    if (v !== DEFAULT_INPUTS[key]) {
      params.set(urlKey, String(v));
    }
  }
  return params;
}

function urlParamsToInputs(search: string): Partial<CalculatorInputs> {
  const params = new URLSearchParams(search);
  const result: Partial<CalculatorInputs> = {};
  for (const [key, urlKey] of Object.entries(URL_KEY_MAP) as Array<[keyof CalculatorInputs, string]>) {
    const raw = params.get(urlKey);
    if (raw === null) continue;
    if (key === "mode") {
      if (raw === "standard" || raw === "refinance" || raw === "brrrr") {
        (result as any)[key] = raw;
      }
    } else {
      const num = Number(raw);
      if (!isNaN(num)) (result as any)[key] = num;
    }
  }
  return result;
}

interface SavedScenario {
  id: string;
  name: string;
  inputs: CalculatorInputs;
  savedAt: number;
}

const SAVED_KEY = "calculator-saved-scenarios";

function loadSavedScenarios(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveScenarios(scenarios: SavedScenario[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(scenarios)); } catch {}
}

// ──────────────────────────────────────────── Sub-components ─────────────────────────────────────

function MetricCard({ label, value, description, positive, icon: Icon, testId }: {
  label: string;
  value: string;
  description?: string;
  positive?: boolean | null;
  icon: typeof DollarSign;
  testId?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">{label}</p>
            <p
              className={`text-xl font-bold tabular-nums mt-1 ${positive === true ? "text-emerald-600 dark:text-emerald-400" : positive === false ? "text-red-600 dark:text-red-400" : ""}`}
              data-testid={testId || `stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {value}
            </p>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InputField({ label, value, onChange, prefix, suffix, tooltip, min, max, step }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  tooltip?: string;
  min?: number;
  max?: number;
  step?: number;
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
            <TooltipContent side="top" className="max-w-[220px]">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">{prefix}</span>
        )}
        <Input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          min={min}
          max={max}
          step={step || 1}
          className={`${prefix ? "pl-7" : ""} ${suffix ? "pr-10" : ""}`}
          data-testid={`input-${label.toLowerCase().replace(/\s+/g, "-")}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── Property search popover (autofill) ────────────────────────────────

type SearchResults = {
  buildings: Array<{ baseBbl: string; displayAddress: string; borough: string | null; unitCount: number }>;
  units: Array<{ unitBbl: string; displayAddress: string | null; borough: string | null }>;
  locations: Array<{ type: string; id: string; name: string; state: string }>;
};

function PropertyAutofill({ onAutofill }: { onAutofill: (data: { price: number; rent: number; tax: number; address: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults(null); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/unified?q=${encodeURIComponent(query)}`);
        if (r.ok) setResults(await r.json());
      } finally { setLoading(false); }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  async function pickProperty(propertyId: string, displayAddress: string | null) {
    try {
      // The unified search returns buildings/units (NYC). For autofill we need a generic property
      // record. We'll search the area for a representative property, but most users will land on
      // a property page directly. Here we try to fetch as a property id first.
      const r = await fetch(`/api/calculator/property/${encodeURIComponent(propertyId)}`);
      if (r.ok) {
        const p = await r.json();
        onAutofill({
          price: p.estimatedValue || 500000,
          rent: p.estimatedMonthlyRent || 3000,
          tax: p.suggestedPropertyTaxRate || 1.5,
          address: `${p.address}, ${p.city}, ${p.state} ${p.zipCode}`,
        });
        setOpen(false);
        setQuery("");
        toast({ title: "Property loaded", description: `${p.address}, ${p.city} ${p.state}` });
        return;
      }
    } catch {}
    toast({
      title: "Couldn't autofill",
      description: "Try a different property or enter values manually.",
      variant: "destructive",
    });
  }

  async function pickLocation(geoId: string, name: string, state: string) {
    try {
      const r = await fetch(`/api/properties/area?geoType=zip&geoId=${encodeURIComponent(geoId)}&limit=1&sortBy=opportunity`);
      if (r.ok) {
        const data = await r.json();
        const p = Array.isArray(data) ? data[0] : data?.properties?.[0];
        if (p?.id) return pickProperty(p.id, p.address);
      }
    } catch {}
    toast({ title: "No properties in that area", variant: "destructive" });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-autofill">
          <Search className="mr-2 h-4 w-4" />
          Autofill from property
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <div className="p-3 border-b">
          <Input
            autoFocus
            placeholder="Search address, ZIP, or city..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="input-autofill-search"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto p-2">
          {loading && <p className="text-sm text-muted-foreground p-3 text-center">Searching...</p>}
          {!loading && query.length >= 2 && results && (
            results.buildings.length === 0 && results.units.length === 0 && results.locations.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 text-center">No matches</p>
            ) : (
              <>
                {results.locations.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground px-2 py-1">Areas</p>
                    {results.locations.slice(0, 4).map((l) => (
                      <button
                        key={`${l.type}-${l.id}`}
                        className="w-full text-left rounded-md p-2 text-sm hover-elevate"
                        onClick={() => pickLocation(l.id, l.name, l.state)}
                        data-testid={`autofill-area-${l.id}`}
                      >
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground">{l.state} · pulls top opportunity in area</div>
                      </button>
                    ))}
                  </div>
                )}
                {results.buildings.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground px-2 py-1">Buildings</p>
                    {results.buildings.slice(0, 6).map((b) => (
                      <button
                        key={b.baseBbl}
                        className="w-full text-left rounded-md p-2 text-sm hover-elevate"
                        onClick={() => pickProperty(b.baseBbl, b.displayAddress)}
                        data-testid={`autofill-building-${b.baseBbl}`}
                      >
                        <div className="font-medium truncate">{b.displayAddress}</div>
                        <div className="text-xs text-muted-foreground">{b.borough} · {b.unitCount} units</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )
          )}
          {!loading && query.length < 2 && (
            <p className="text-sm text-muted-foreground p-3 text-center">Type at least 2 characters</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────── Save / share scenarios popover ──────────────────────────────────────

function ScenariosPopover({ inputs, onLoad }: { inputs: CalculatorInputs; onLoad: (i: CalculatorInputs) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const { toast } = useToast();

  useEffect(() => { if (open) setScenarios(loadSavedScenarios()); }, [open]);

  function save() {
    const trimmed = name.trim() || `Scenario ${new Date().toLocaleDateString()}`;
    const next: SavedScenario = {
      id: crypto.randomUUID(),
      name: trimmed,
      inputs,
      savedAt: Date.now(),
    };
    const all = [next, ...loadSavedScenarios()].slice(0, 20);
    saveScenarios(all);
    setScenarios(all);
    setName("");
    toast({ title: "Scenario saved", description: trimmed });
  }

  function remove(id: string) {
    const next = scenarios.filter((s) => s.id !== id);
    saveScenarios(next);
    setScenarios(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-scenarios">
          <Bookmark className="mr-2 h-4 w-4" />
          Saved
          {scenarios.length > 0 && <Badge variant="secondary" className="ml-2">{scenarios.length}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">
        <div className="p-3 border-b">
          <div className="flex gap-2">
            <Input
              placeholder="Scenario name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-scenario-name"
            />
            <Button size="sm" onClick={save} data-testid="button-save-scenario">
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-2">
          {scenarios.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">No saved scenarios yet</p>
          ) : scenarios.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-md p-2 hover-elevate"
              data-testid={`saved-${s.id}`}
            >
              <button
                className="flex-1 text-left min-w-0"
                onClick={() => { onLoad(s.inputs); setOpen(false); toast({ title: "Loaded", description: s.name }); }}
              >
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(s.inputs.purchasePrice)} · {s.inputs.mode} · {new Date(s.savedAt).toLocaleDateString()}
                </div>
              </button>
              <Button size="icon" variant="ghost" onClick={() => remove(s.id)} data-testid={`button-delete-${s.id}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ────────────────────────────────────────── Main page ────────────────────────────────────────────

export default function InvestmentCalculator() {
  const { isPro, isFree } = useSubscription();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Initialize from URL query params if present, otherwise defaults
  const [inputs, setInputs] = useState<CalculatorInputs>(() => {
    if (typeof window !== "undefined") {
      const fromUrl = urlParamsToInputs(window.location.search);
      return { ...DEFAULT_INPUTS, ...fromUrl };
    }
    return DEFAULT_INPUTS;
  });
  const [autofilledAddress, setAutofilledAddress] = useState<string | null>(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  // Fetch live mortgage rate & smart defaults (NY by default)
  const { data: defaults } = useQuery<{
    mortgageRate: { value: number; asOf: string; source: string };
    market: { state: string; medianPrice: number; medianPricePerSqft: number; trend3m: number; trend12m: number } | null;
    defaults: any;
  }>({
    queryKey: ["/api/calculator/defaults"],
  });

  // Apply live mortgage rate on first load (only if URL didn't override interest rate)
  useEffect(() => {
    if (!defaults || defaultsApplied) return;
    const urlOverrides = urlParamsToInputs(window.location.search);
    setInputs((prev) => ({
      ...prev,
      interestRate: urlOverrides.interestRate ?? defaults.mortgageRate.value,
      refiInterestRate: urlOverrides.refiInterestRate ?? Math.max(4, defaults.mortgageRate.value - 1),
      propertyTaxRate: urlOverrides.propertyTaxRate ?? defaults.defaults.propertyTaxRate,
    }));
    setDefaultsApplied(true);
  }, [defaults, defaultsApplied]);

  // Update URL on inputs change (debounced via React state)
  useEffect(() => {
    const params = inputsToUrlParams(inputs);
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", newUrl);
  }, [inputs]);

  const updateInput = (key: keyof CalculatorInputs, value: number | Mode) => {
    setInputs((prev) => ({ ...prev, [key]: value as any }));
  };

  const results = useMemo(() => calculateResults(inputs), [inputs]);

  function handleShare() {
    const params = inputsToUrlParams(inputs);
    const url = `${window.location.origin}${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    navigator.clipboard.writeText(url).then(
      () => toast({ title: "Link copied", description: "Share this URL to share your scenario." }),
      () => toast({ title: "Couldn't copy", description: url, variant: "destructive" })
    );
  }

  function handleReset() {
    setInputs({ ...DEFAULT_INPUTS, interestRate: defaults?.mortgageRate.value ?? DEFAULT_INPUTS.interestRate });
    setAutofilledAddress(null);
    toast({ title: "Reset to defaults" });
  }

  const expenseBreakdown = results.monthlyExpenseBreakdown;
  const totalMonthlyExpense = Object.values(expenseBreakdown).reduce((sum, v) => sum + v, 0);

  // Chart data — slim down to year, cashFlow, equity, totalReturn
  const chartData = results.projection.map((p) => ({
    year: p.year,
    cashFlow: Math.round(p.cumulativeCashFlow),
    equity: Math.round(p.equity),
    totalReturn: Math.round(p.totalReturn),
  }));

  return (
    <AppLayout>
      <SEO
        title="Real Estate Investment Calculator - Cash Flow, Cap Rate, ROI"
        description="Free rental property investment calculator with refinance and BRRRR scenarios, live mortgage rates, 30-year cash flow projections, and shareable scenarios."
        canonicalUrl="https://realtorsdashboard.com/calculator"
      />
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Calculator className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl truncate" data-testid="text-page-title">
                Investment Calculator
              </h1>
              <p className="text-sm text-muted-foreground">
                Standard, refinance, and BRRRR scenarios with 30-year projections
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {defaults?.mortgageRate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="gap-1.5" data-testid="badge-live-rate">
                    <Wifi className="h-3 w-3" />
                    30yr: {defaults.mortgageRate.value.toFixed(2)}%
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px]">
                  <p className="text-xs">
                    Live 30-year fixed rate from {defaults.mortgageRate.source}
                    {defaults.mortgageRate.asOf !== "fallback" ? ` (${defaults.mortgageRate.asOf})` : ""}.
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            <PropertyAutofill onAutofill={(d) => {
              setInputs((prev) => ({
                ...prev,
                purchasePrice: d.price,
                monthlyRent: d.rent,
                propertyTaxRate: d.tax,
              }));
              setAutofilledAddress(d.address);
            }} />
            <ScenariosPopover inputs={inputs} onLoad={(i) => setInputs(i)} />
            <Button variant="outline" size="sm" onClick={handleShare} data-testid="button-share">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset} data-testid="button-reset">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        {autofilledAddress && (
          <Card className="mb-4">
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm truncate" data-testid="text-autofilled-address">
                  Autofilled from <span className="font-medium">{autofilledAddress}</span>
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setAutofilledAddress(null)}
                data-testid="button-clear-autofill"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Scenario tabs */}
        <Tabs
          value={inputs.mode}
          onValueChange={(v) => updateInput("mode", v as Mode)}
          className="mb-4"
        >
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="standard" data-testid="tab-standard">Standard</TabsTrigger>
            <TabsTrigger value="refinance" data-testid="tab-refinance">Refinance</TabsTrigger>
            <TabsTrigger value="brrrr" data-testid="tab-brrrr">BRRRR</TabsTrigger>
          </TabsList>
          <TabsContent value="standard" className="mt-2">
            <p className="text-xs text-muted-foreground">
              Buy & hold rental analysis with 30-year cash flow projection.
            </p>
          </TabsContent>
          <TabsContent value="refinance" className="mt-2">
            <p className="text-xs text-muted-foreground">
              Models a rate-and-term refinance in a future year. Closing costs are deducted from cumulative cash flow.
            </p>
          </TabsContent>
          <TabsContent value="brrrr" className="mt-2">
            <p className="text-xs text-muted-foreground">
              Buy → Rehab → Rent → Refinance → Repeat. Models a 75% LTV cash-out refi at year 1 based on After Repair Value.
            </p>
          </TabsContent>
        </Tabs>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Input Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Property & Loan
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
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <Label className="text-sm">Down Payment</Label>
                    <span className="text-sm font-medium tabular-nums">
                      {inputs.downPaymentPercent}% ({formatCurrency(inputs.purchasePrice * inputs.downPaymentPercent / 100)})
                    </span>
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
                  tooltip={defaults?.mortgageRate ? `Current market rate: ${defaults.mortgageRate.value.toFixed(2)}%` : "Annual mortgage interest rate"}
                />
                <InputField
                  label="Loan Term"
                  value={inputs.loanTermYears}
                  onChange={(v) => updateInput("loanTermYears", v)}
                  suffix="yrs"
                />
                <InputField
                  label="Closing Costs"
                  value={inputs.closingCostPercent}
                  onChange={(v) => updateInput("closingCostPercent", v)}
                  suffix="%"
                  step={0.5}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
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
                />
                <InputField
                  label="Vacancy Rate"
                  value={inputs.vacancyRate}
                  onChange={(v) => updateInput("vacancyRate", v)}
                  suffix="%"
                />
                <InputField
                  label="Property Tax Rate"
                  value={inputs.propertyTaxRate}
                  onChange={(v) => updateInput("propertyTaxRate", v)}
                  suffix="%"
                  step={0.1}
                  tooltip="Annual property tax as % of property value. NY ~1.4%, NJ ~2.2%, CT ~2.0%"
                />
                <InputField
                  label="Annual Insurance"
                  value={inputs.insuranceAnnual}
                  onChange={(v) => updateInput("insuranceAnnual", v)}
                  prefix="$"
                />
                <InputField
                  label="Maintenance"
                  value={inputs.maintenancePercent}
                  onChange={(v) => updateInput("maintenancePercent", v)}
                  suffix="%"
                  step={0.25}
                  tooltip="Annual maintenance as % of property value (1-2% typical)"
                />
                <InputField
                  label="Management Fee"
                  value={inputs.managementPercent}
                  onChange={(v) => updateInput("managementPercent", v)}
                  suffix="%"
                  tooltip="As % of rent (8-12% typical)"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Growth Assumptions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InputField
                  label="Appreciation"
                  value={inputs.appreciationRate}
                  onChange={(v) => updateInput("appreciationRate", v)}
                  suffix="%"
                  step={0.5}
                  tooltip="Expected annual property value appreciation"
                />
                <InputField
                  label="Rent Growth"
                  value={inputs.rentGrowthRate}
                  onChange={(v) => updateInput("rentGrowthRate", v)}
                  suffix="%"
                  step={0.5}
                  tooltip="Expected annual rent growth"
                />
                <InputField
                  label="Expense Growth"
                  value={inputs.expenseGrowthRate}
                  onChange={(v) => updateInput("expenseGrowthRate", v)}
                  suffix="%"
                  step={0.5}
                  tooltip="Expected annual operating expense growth"
                />
              </CardContent>
            </Card>

            {(inputs.mode === "refinance" || inputs.mode === "brrrr") && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {inputs.mode === "brrrr" ? <Hammer className="h-4 w-4" /> : <Percent className="h-4 w-4" />}
                    {inputs.mode === "brrrr" ? "BRRRR Details" : "Refinance"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {inputs.mode === "refinance" && (
                    <InputField
                      label="Refinance Year"
                      value={inputs.refiYear}
                      onChange={(v) => updateInput("refiYear", v)}
                      suffix="yrs"
                      min={1}
                      max={29}
                    />
                  )}
                  {inputs.mode === "brrrr" && (
                    <>
                      <InputField
                        label="Rehab Cost"
                        value={inputs.rehabCost}
                        onChange={(v) => updateInput("rehabCost", v)}
                        prefix="$"
                      />
                      <InputField
                        label="After Repair Value"
                        value={inputs.arv}
                        onChange={(v) => updateInput("arv", v)}
                        prefix="$"
                        tooltip="Estimated value after renovations are complete"
                      />
                    </>
                  )}
                  <InputField
                    label={inputs.mode === "brrrr" ? "Refi Rate" : "New Rate"}
                    value={inputs.refiInterestRate}
                    onChange={(v) => updateInput("refiInterestRate", v)}
                    suffix="%"
                    step={0.1}
                  />
                  <InputField
                    label={inputs.mode === "brrrr" ? "Refi Term" : "New Term"}
                    value={inputs.refiLoanTermYears}
                    onChange={(v) => updateInput("refiLoanTermYears", v)}
                    suffix="yrs"
                  />
                  <InputField
                    label="Refi Closing"
                    value={inputs.refiClosingCostPercent}
                    onChange={(v) => updateInput("refiClosingCostPercent", v)}
                    suffix="%"
                    step={0.5}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Results Panel */}
          <div className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard
                label="Monthly Cash Flow"
                value={`$${Math.round(results.monthlyCashFlow).toLocaleString()}`}
                positive={results.monthlyCashFlow > 0}
                description={results.monthlyCashFlow > 0 ? "Positive" : "Negative"}
                icon={PiggyBank}
                testId="stat-monthly-cash-flow"
              />
              <MetricCard
                label="Cap Rate"
                value={`${results.capRate.toFixed(1)}%`}
                positive={results.capRate > 5 ? true : results.capRate > 3 ? null : false}
                description={results.capRate > 8 ? "Strong" : results.capRate > 5 ? "Good" : results.capRate > 3 ? "Fair" : "Low"}
                icon={Percent}
                testId="stat-cap-rate"
              />
              <MetricCard
                label="Cash-on-Cash"
                value={`${results.cashOnCashReturn.toFixed(1)}%`}
                positive={results.cashOnCashReturn > 8 ? true : results.cashOnCashReturn > 0 ? null : false}
                description="Annual return on cash"
                icon={TrendingUp}
                testId="stat-cash-on-cash"
              />
              <MetricCard
                label={inputs.mode === "brrrr" ? "Cash Left In" : "30-Year ROI"}
                value={inputs.mode === "brrrr"
                  ? (results.brrrr?.infiniteReturn ? "$0" : formatCurrency(results.brrrr?.cashLeftIn || 0))
                  : `${results.thirtyYearROI.toFixed(0)}%`}
                positive={inputs.mode === "brrrr" ? results.brrrr?.infiniteReturn : results.thirtyYearROI > 100}
                description={inputs.mode === "brrrr" ? (results.brrrr?.infiniteReturn ? "Infinite return" : "Out of pocket") : "Including appreciation"}
                icon={BarChart3}
                testId="stat-roi"
              />
            </div>

            {/* BRRRR-specific summary */}
            {inputs.mode === "brrrr" && results.brrrr && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hammer className="h-4 w-4" />
                    BRRRR Refinance Outcome
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Total Project Cost</p>
                      <p className="text-lg font-bold tabular-nums">{formatCurrency(results.brrrr.totalProjectCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Refi Loan (75% ARV)</p>
                      <p className="text-lg font-bold tabular-nums">{formatCurrency(results.brrrr.refinanceLoan)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Cash Out at Refi</p>
                      <p className={`text-lg font-bold tabular-nums ${results.brrrr.cashOut > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {formatCurrency(results.brrrr.cashOut)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Cash Left In Deal</p>
                      <p className="text-lg font-bold tabular-nums">
                        {results.brrrr.infiniteReturn ? (
                          <Badge variant="default" className="text-base">Infinite Return</Badge>
                        ) : formatCurrency(results.brrrr.cashLeftIn)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cash flow projection chart */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  30-Year Projection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="year"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickFormatter={(y) => `Y${y}`}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickFormatter={(v) => formatCurrency(v)}
                      />
                      <RTooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                        formatter={(v: number) => formatCurrency(v)}
                        labelFormatter={(y) => `Year ${y}`}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
                      {inputs.mode === "refinance" && (
                        <ReferenceLine
                          x={inputs.refiYear}
                          stroke="hsl(var(--primary))"
                          strokeDasharray="4 4"
                          label={{ value: "Refi", fill: "hsl(var(--primary))", fontSize: 11, position: "top" }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="cashFlow"
                        stroke="hsl(142 76% 36%)"
                        strokeWidth={2}
                        dot={false}
                        name="Cumulative Cash Flow"
                      />
                      <Line
                        type="monotone"
                        dataKey="equity"
                        stroke="hsl(217 91% 60%)"
                        strokeWidth={2}
                        dot={false}
                        name="Equity"
                      />
                      <Line
                        type="monotone"
                        dataKey="totalReturn"
                        stroke="hsl(262 83% 58%)"
                        strokeWidth={2.5}
                        dot={false}
                        name="Total Return"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">5-Year Total Return</p>
                    <p className="text-base font-bold tabular-nums" data-testid="stat-5yr-return">{formatCurrency(results.projection[4].totalReturn)}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">10-Year Total Return</p>
                    <p className="text-base font-bold tabular-nums" data-testid="stat-10yr-return">{formatCurrency(results.projection[9].totalReturn)}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">30-Year Total Return</p>
                    <p className="text-base font-bold tabular-nums" data-testid="stat-30yr-return">{formatCurrency(results.projection[29].totalReturn)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Year One Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cash Required</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Down Payment</span>
                      <span className="font-medium tabular-nums">${Math.round(results.downPayment).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Closing Costs</span>
                      <span className="font-medium tabular-nums">${Math.round(inputs.purchasePrice * inputs.closingCostPercent / 100).toLocaleString()}</span>
                    </div>
                    {inputs.mode === "brrrr" && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Rehab</span>
                        <span className="font-medium tabular-nums">${Math.round(inputs.rehabCost).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="font-medium">Total Cash Needed</span>
                      <span className="font-bold tabular-nums">${Math.round(results.totalCashNeeded).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Annual Returns</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Net Operating Income</span>
                      <span className="font-medium tabular-nums">${Math.round(results.annualNOI).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Annual Cash Flow</span>
                      <span className={`font-medium tabular-nums ${results.annualCashFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        ${Math.round(results.annualCashFlow).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gross Rent Multiplier</span>
                      <span className="font-medium tabular-nums">{results.grossRentMultiplier.toFixed(1)}x</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">DSCR</span>
                      <span className="font-medium tabular-nums">{results.debtServiceCoverageRatio > 100 ? "N/A" : `${results.debtServiceCoverageRatio.toFixed(2)}x`}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Expense Breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Monthly Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {[
                    { label: "Mortgage", value: expenseBreakdown.mortgage, color: "bg-primary" },
                    { label: "Property Tax", value: expenseBreakdown.propertyTax, color: "bg-amber-500" },
                    { label: "Insurance", value: expenseBreakdown.insurance, color: "bg-blue-500" },
                    { label: "Maintenance", value: expenseBreakdown.maintenance, color: "bg-emerald-500" },
                    { label: "Management", value: expenseBreakdown.management, color: "bg-purple-500" },
                    { label: "Vacancy Reserve", value: expenseBreakdown.vacancy, color: "bg-red-500" },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-sm">{label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {totalMonthlyExpense > 0 ? `${((value / totalMonthlyExpense) * 100).toFixed(0)}%` : "0%"}
                          </span>
                          <span className="text-sm font-medium tabular-nums w-20 text-right">${Math.round(value).toLocaleString()}</span>
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
                    <span className="font-bold tabular-nums">${Math.round(totalMonthlyExpense).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Monthly Rent Income</span>
                    <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      ${inputs.monthlyRent.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Indicators */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Risk Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Debt Service Coverage</p>
                    <p className="text-lg font-bold tabular-nums" data-testid="stat-dscr">
                      {results.debtServiceCoverageRatio > 100 ? "N/A" : `${results.debtServiceCoverageRatio.toFixed(2)}x`}
                    </p>
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
                    <p className="text-lg font-bold tabular-nums" data-testid="stat-equity">{formatCurrency(results.projection[4].equity)}</p>
                    <Badge variant="secondary">Projected</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pro Market Context */}
            {isPro && defaults?.market ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Market Context
                    <Badge variant="secondary">Pro</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{defaults.market.state} Median Price</p>
                      <p className="text-lg font-bold tabular-nums">{formatCurrency(defaults.market.medianPrice)}</p>
                      <p className="text-xs text-muted-foreground">
                        Your price is {inputs.purchasePrice < defaults.market.medianPrice ? "below" : "above"} median
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Market Trend (3mo)</p>
                      <p className={`text-lg font-bold ${(defaults.market.trend3m || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {((defaults.market.trend3m || 0) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Median $/sqft</p>
                      <p className="text-lg font-bold tabular-nums">${defaults.market.medianPricePerSqft}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : isFree ? (
              <Card>
                <CardHeader className="pb-3">
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
                      <Button variant="outline" size="sm" onClick={() => navigate("/pricing")} data-testid="button-unlock-market-context">
                        <Lock className="mr-1 h-3 w-3" />
                        Unlock Market Context
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Link href="/investment-opportunities">
                <Button variant="outline" size="sm" data-testid="link-screener">
                  <Building2 className="mr-2 h-4 w-4" />
                  Find Properties
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/market-intelligence">
                <Button variant="outline" size="sm" data-testid="link-market">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Market Explorer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
