import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calculator, TrendingUp, TrendingDown, DollarSign, Percent, Home, Loader2, Bot, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ScenarioInputs {
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
  appreciationRate: number;
}

interface ScenarioResults {
  loanAmount: number;
  monthlyMortgage: number;
  monthlyExpenses: number;
  monthlyNetCashFlow: number;
  annualNetCashFlow: number;
  cashOnCashReturn: number;
  capRate: number;
  totalCashRequired: number;
  breakEvenOccupancy: number;
  year5Equity: number;
  year5TotalReturn: number;
}

interface AIAssessment {
  dealQuality: "Excellent" | "Good" | "Fair" | "Poor";
  summary: string;
  pros: string[];
  cons: string[];
  recommendation: string;
}

interface ScenarioSimulatorProps {
  propertyId: string;
  estimatedValue?: number | null;
  estimatedRent?: number | null;
}

const defaultInputs: ScenarioInputs = {
  purchasePrice: 500000,
  downPaymentPercent: 20,
  interestRate: 7.0,
  loanTermYears: 30,
  monthlyRent: 3000,
  vacancyRate: 5,
  propertyTaxRate: 1.5,
  insuranceAnnual: 1800,
  maintenancePercent: 5,
  managementPercent: 8,
  appreciationRate: 3,
};

export function ScenarioSimulator({ propertyId, estimatedValue, estimatedRent }: ScenarioSimulatorProps) {
  const [inputs, setInputs] = useState<ScenarioInputs>({
    ...defaultInputs,
    purchasePrice: estimatedValue || defaultInputs.purchasePrice,
    monthlyRent: estimatedRent || defaultInputs.monthlyRent,
  });
  const [results, setResults] = useState<ScenarioResults | null>(null);
  const [aiAssessment, setAiAssessment] = useState<AIAssessment | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const calculateMutation = useMutation({
    mutationFn: async (inputsToCalc: ScenarioInputs) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      const response = await fetch("/api/scenario/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(inputsToCalc),
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        throw new Error("Calculation failed");
      }
      
      const data = await response.json();
      return data as ScenarioResults;
    },
    onSuccess: (data) => {
      setResults(data);
      setCalcError(null);
    },
    onError: (error: Error) => {
      if (error.name !== "AbortError") {
        setCalcError("Failed to calculate scenario");
        setResults(null);
      }
    },
  });

  const analyzeWithAI = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/ai/scenario/${propertyId}`, inputs);
      const data = await response.json();
      return data as { inputs: ScenarioInputs; results: ScenarioResults; aiAssessment: AIAssessment };
    },
    onSuccess: (data) => {
      setResults(data.results);
      setAiAssessment(data.aiAssessment);
      toast({
        title: "Analysis complete",
        description: "AI has evaluated your investment scenario.",
      });
    },
    onError: () => {
      toast({
        title: "Analysis failed",
        description: "Unable to get AI assessment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const debouncedCalculate = useCallback((newInputs: ScenarioInputs) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      calculateMutation.mutate(newInputs);
    }, 300);
  }, []);

  useEffect(() => {
    debouncedCalculate(inputs);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputs, debouncedCalculate]);

  const updateInput = (key: keyof ScenarioInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    setAiAssessment(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getCashFlowColor = (value: number) => {
    if (value > 0) return "text-emerald-600 dark:text-emerald-400";
    if (value < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const getReturnColor = (value: number) => {
    if (value >= 10) return "text-emerald-600 dark:text-emerald-400";
    if (value >= 5) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getDealQualityColor = (quality: string) => {
    switch (quality) {
      case "Excellent":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "Good":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "Fair":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "Poor":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-muted";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Investment Scenario Simulator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="inputs" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="inputs" data-testid="tab-inputs">Inputs</TabsTrigger>
            <TabsTrigger value="results" data-testid="tab-results">Results</TabsTrigger>
            <TabsTrigger value="ai" data-testid="tab-ai-analysis">AI Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="inputs" className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Purchase Price</Label>
                <div className="flex items-center gap-4 mt-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    value={inputs.purchasePrice}
                    onChange={(e) => updateInput("purchasePrice", parseInt(e.target.value) || 0)}
                    className="flex-1"
                    data-testid="input-purchase-price"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Down Payment</Label>
                  <span className="text-sm text-muted-foreground">
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Interest Rate</Label>
                  <span className="text-sm text-muted-foreground">{inputs.interestRate}%</span>
                </div>
                <Slider
                  value={[inputs.interestRate]}
                  onValueChange={([v]) => updateInput("interestRate", v)}
                  min={3}
                  max={12}
                  step={0.125}
                  data-testid="slider-interest-rate"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Monthly Rent</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    value={inputs.monthlyRent}
                    onChange={(e) => updateInput("monthlyRent", parseInt(e.target.value) || 0)}
                    className="flex-1"
                    data-testid="input-monthly-rent"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Vacancy Rate</Label>
                  <span className="text-sm text-muted-foreground">{inputs.vacancyRate}%</span>
                </div>
                <Slider
                  value={[inputs.vacancyRate]}
                  onValueChange={([v]) => updateInput("vacancyRate", v)}
                  min={0}
                  max={20}
                  step={1}
                  data-testid="slider-vacancy"
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Property Tax Rate</Label>
                    <span className="text-sm text-muted-foreground">{inputs.propertyTaxRate}%</span>
                  </div>
                  <Slider
                    value={[inputs.propertyTaxRate]}
                    onValueChange={([v]) => updateInput("propertyTaxRate", v)}
                    min={0.5}
                    max={4}
                    step={0.1}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Annual Insurance</Label>
                  <Input
                    type="number"
                    value={inputs.insuranceAnnual}
                    onChange={(e) => updateInput("insuranceAnnual", parseInt(e.target.value) || 0)}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Maintenance</Label>
                    <span className="text-sm text-muted-foreground">{inputs.maintenancePercent}%</span>
                  </div>
                  <Slider
                    value={[inputs.maintenancePercent]}
                    onValueChange={([v]) => updateInput("maintenancePercent", v)}
                    min={0}
                    max={15}
                    step={1}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Management</Label>
                    <span className="text-sm text-muted-foreground">{inputs.managementPercent}%</span>
                  </div>
                  <Slider
                    value={[inputs.managementPercent]}
                    onValueChange={([v]) => updateInput("managementPercent", v)}
                    min={0}
                    max={15}
                    step={1}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Annual Appreciation</Label>
                  <span className="text-sm text-muted-foreground">{inputs.appreciationRate}%</span>
                </div>
                <Slider
                  value={[inputs.appreciationRate]}
                  onValueChange={([v]) => updateInput("appreciationRate", v)}
                  min={-5}
                  max={10}
                  step={0.5}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {calcError ? (
              <div className="py-8 text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                <p className="text-destructive">{calcError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => {
                    setCalcError(null);
                    calculateMutation.mutate(inputs);
                  }}
                >
                  Retry Calculation
                </Button>
              </div>
            ) : results ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Monthly Cash Flow</p>
                      <p className={cn("text-2xl font-bold", getCashFlowColor(results.monthlyNetCashFlow))}>
                        {results.monthlyNetCashFlow >= 0 ? "+" : ""}{formatCurrency(results.monthlyNetCashFlow)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Annual Cash Flow</p>
                      <p className={cn("text-2xl font-bold", getCashFlowColor(results.annualNetCashFlow))}>
                        {results.annualNetCashFlow >= 0 ? "+" : ""}{formatCurrency(results.annualNetCashFlow)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-sm text-muted-foreground">Cash-on-Cash</p>
                      <p className={cn("text-xl font-bold", getReturnColor(results.cashOnCashReturn))}>
                        {results.cashOnCashReturn.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-sm text-muted-foreground">Cap Rate</p>
                      <p className={cn("text-xl font-bold", getReturnColor(results.capRate))}>
                        {results.capRate.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-sm text-muted-foreground">Break-Even</p>
                      <p className={cn(
                        "text-xl font-bold",
                        results.breakEvenOccupancy < 80 ? "text-emerald-600" : results.breakEvenOccupancy < 90 ? "text-amber-600" : "text-red-600"
                      )}>
                        {results.breakEvenOccupancy.toFixed(0)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium">Investment Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Cash Required</span>
                      <span className="font-medium">{formatCurrency(results.totalCashRequired)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Loan Amount</span>
                      <span className="font-medium">{formatCurrency(results.loanAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Mortgage</span>
                      <span className="font-medium">{formatCurrency(results.monthlyMortgage)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Expenses</span>
                      <span className="font-medium">{formatCurrency(results.monthlyExpenses)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium">5-Year Projections</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Projected Equity</span>
                      <span className="font-medium text-emerald-600">{formatCurrency(results.year5Equity)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Return</span>
                      <span className={cn("font-medium", getReturnColor(results.year5TotalReturn))}>
                        {results.year5TotalReturn.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : calculateMutation.isPending ? (
              <div className="py-8 text-center text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p>Calculating...</p>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Adjust inputs to see results</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            {!aiAssessment ? (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Get AI-powered analysis of your investment scenario
                </p>
                <Button
                  onClick={() => analyzeWithAI.mutate()}
                  disabled={analyzeWithAI.isPending}
                  data-testid="button-analyze-scenario"
                >
                  {analyzeWithAI.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 mr-2" />
                      Analyze This Scenario
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">AI Assessment</h4>
                  <Badge className={getDealQualityColor(aiAssessment.dealQuality)}>
                    {aiAssessment.dealQuality} Deal
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {aiAssessment.summary}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        Pros
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {aiAssessment.pros.map((pro, i) => (
                          <li key={i} className="text-xs flex items-start gap-2">
                            <span className="text-emerald-600">+</span>
                            {pro}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-amber-600" />
                        Cons
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {aiAssessment.cons.map((con, i) => (
                          <li key={i} className="text-xs flex items-start gap-2">
                            <span className="text-amber-600">-</span>
                            {con}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="pt-4">
                    <h5 className="text-sm font-medium mb-2">Recommendation</h5>
                    <p className="text-sm text-muted-foreground">{aiAssessment.recommendation}</p>
                  </CardContent>
                </Card>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => analyzeWithAI.mutate()}
                  disabled={analyzeWithAI.isPending}
                  className="w-full"
                >
                  {analyzeWithAI.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Re-analyze with Current Inputs
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
