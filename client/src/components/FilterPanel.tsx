import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { propertyTypes, bedsBands, bathsBands, yearBuiltBands, sizeBands, states, confidenceLevels } from "@shared/schema";
import type { ScreenerFilters } from "@shared/schema";

interface FilterPanelProps {
  filters: ScreenerFilters;
  onChange: (filters: ScreenerFilters) => void;
  onReset: () => void;
}

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between py-3 text-sm font-medium hover-elevate rounded-md px-2 -mx-2">
          {title}
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pb-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FilterPanel({ filters, onChange, onReset }: FilterPanelProps) {
  const handleArrayToggle = <K extends keyof ScreenerFilters>(
    key: K,
    value: string
  ) => {
    const current = (filters[key] as string[] | undefined) || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: updated.length > 0 ? updated : undefined });
  };

  const handlePriceChange = (values: number[]) => {
    onChange({
      ...filters,
      priceMin: values[0] * 10000,
      priceMax: values[1] * 10000,
    });
  };

  const handleScoreChange = (values: number[]) => {
    onChange({ ...filters, opportunityScoreMin: values[0] });
  };

  const priceMin = (filters.priceMin || 0) / 10000;
  const priceMax = (filters.priceMax || 5000000) / 10000;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-4">
        <div className="flex items-center justify-between pb-2">
          <h3 className="font-semibold">Filters</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 text-xs"
            data-testid="button-reset-filters"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset
          </Button>
        </div>

        <Separator />

        <FilterSection title="State">
          <div className="space-y-2">
            {states.map((state) => (
              <div key={state} className="flex items-center gap-2">
                <Checkbox
                  id={`state-${state}`}
                  checked={filters.state === state}
                  onCheckedChange={(checked) =>
                    onChange({ ...filters, state: checked ? state : undefined })
                  }
                  data-testid={`filter-state-${state}`}
                />
                <Label htmlFor={`state-${state}`} className="text-sm cursor-pointer">
                  {state === "NY" ? "New York" : state === "NJ" ? "New Jersey" : "Connecticut"}
                </Label>
              </div>
            ))}
          </div>
        </FilterSection>

        <Separator />

        <FilterSection title="Property Type">
          <div className="space-y-2">
            {propertyTypes.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <Checkbox
                  id={`type-${type}`}
                  checked={filters.propertyTypes?.includes(type)}
                  onCheckedChange={() => handleArrayToggle("propertyTypes", type)}
                  data-testid={`filter-type-${type}`}
                />
                <Label htmlFor={`type-${type}`} className="text-sm cursor-pointer">
                  {type}
                </Label>
              </div>
            ))}
          </div>
        </FilterSection>

        <Separator />

        <FilterSection title="Bedrooms">
          <div className="flex flex-wrap gap-2">
            {bedsBands.map((band) => (
              <Button
                key={band}
                variant={filters.bedsBands?.includes(band) ? "default" : "outline"}
                size="sm"
                className="h-8 min-w-[3rem]"
                onClick={() => handleArrayToggle("bedsBands", band)}
                data-testid={`filter-beds-${band}`}
              >
                {band}
              </Button>
            ))}
          </div>
        </FilterSection>

        <Separator />

        <FilterSection title="Bathrooms">
          <div className="flex flex-wrap gap-2">
            {bathsBands.map((band) => (
              <Button
                key={band}
                variant={filters.bathsBands?.includes(band) ? "default" : "outline"}
                size="sm"
                className="h-8 min-w-[3rem]"
                onClick={() => handleArrayToggle("bathsBands", band)}
                data-testid={`filter-baths-${band}`}
              >
                {band}
              </Button>
            ))}
          </div>
        </FilterSection>

        <Separator />

        <FilterSection title="Year Built">
          <div className="space-y-2">
            {yearBuiltBands.map((band) => (
              <div key={band} className="flex items-center gap-2">
                <Checkbox
                  id={`year-${band}`}
                  checked={filters.yearBuiltBands?.includes(band)}
                  onCheckedChange={() => handleArrayToggle("yearBuiltBands", band)}
                  data-testid={`filter-year-${band}`}
                />
                <Label htmlFor={`year-${band}`} className="text-sm cursor-pointer">
                  {band}
                </Label>
              </div>
            ))}
          </div>
        </FilterSection>

        <Separator />

        <FilterSection title="Size (sqft)">
          <div className="space-y-2">
            {sizeBands.map((band) => (
              <div key={band} className="flex items-center gap-2">
                <Checkbox
                  id={`size-${band}`}
                  checked={filters.sizeBands?.includes(band)}
                  onCheckedChange={() => handleArrayToggle("sizeBands", band)}
                  data-testid={`filter-size-${band}`}
                />
                <Label htmlFor={`size-${band}`} className="text-sm cursor-pointer">
                  {band} sqft
                </Label>
              </div>
            ))}
          </div>
        </FilterSection>

        <Separator />

        <FilterSection title="Price Range">
          <div className="space-y-4 px-1">
            <Slider
              value={[priceMin, priceMax]}
              min={0}
              max={500}
              step={10}
              onValueChange={handlePriceChange}
              data-testid="filter-price-slider"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>${((filters.priceMin || 0) / 1000).toFixed(0)}K</span>
              <span>${((filters.priceMax || 5000000) / 1000000).toFixed(1)}M</span>
            </div>
          </div>
        </FilterSection>

        <Separator />

        <FilterSection title="Opportunity Score">
          <div className="space-y-4 px-1">
            <Slider
              value={[filters.opportunityScoreMin || 0]}
              min={0}
              max={100}
              step={5}
              onValueChange={handleScoreChange}
              data-testid="filter-score-slider"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Min: {filters.opportunityScoreMin || 0}</span>
              <span>Max: 100</span>
            </div>
          </div>
        </FilterSection>

        <Separator />

        <FilterSection title="Confidence Level">
          <div className="space-y-2">
            {confidenceLevels.map((level) => (
              <div key={level} className="flex items-center gap-2">
                <Checkbox
                  id={`confidence-${level}`}
                  checked={filters.confidenceLevels?.includes(level)}
                  onCheckedChange={() => handleArrayToggle("confidenceLevels", level)}
                  data-testid={`filter-confidence-${level}`}
                />
                <Label htmlFor={`confidence-${level}`} className="text-sm cursor-pointer">
                  {level}
                </Label>
              </div>
            ))}
          </div>
        </FilterSection>
      </div>
    </ScrollArea>
  );
}
