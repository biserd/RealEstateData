import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, Building2, Home, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BuildingResult = {
  baseBbl: string;
  displayAddress: string;
  borough: string | null;
  unitCount: number;
};

type UnitResult = {
  unitBbl: string;
  baseBbl: string;
  unitDesignation: string | null;
  displayAddress: string | null;
  borough: string | null;
  slug?: string | null;
};

type SearchResults = {
  buildings: BuildingResult[];
  units: UnitResult[];
  locations: Array<{ type: string; id: string; name: string; state: string }>;
};

interface SmartAddressSearchProps {
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  showButton?: boolean;
  autoFocus?: boolean;
}

export function SmartAddressSearch({
  placeholder = "Search by address, ZIP, or city...",
  className,
  inputClassName,
  buttonClassName,
  showButton = true,
  autoFocus = false,
}: SmartAddressSearchProps) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const allResults = [
    ...(results?.buildings || []).map(b => ({ type: "building" as const, data: b })),
    ...(results?.units || []).map(u => ({ type: "unit" as const, data: u })),
  ];

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setResults(null);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/unified?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data);
          setShowDropdown(true);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateToResult = (item: typeof allResults[0]) => {
    if (item.type === "building") {
      const building = item.data as BuildingResult;
      const slug = building.displayAddress
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
      setLocation(`/building/${slug}-${building.baseBbl}`);
    } else {
      const unit = item.data as UnitResult;
      if (unit.slug) {
        setLocation(`/unit/${unit.slug}`);
      } else {
        setLocation(`/unit/${unit.unitBbl}`);
      }
    }
    setShowDropdown(false);
    setQuery("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedIndex >= 0 && allResults[selectedIndex]) {
      navigateToResult(allResults[selectedIndex]);
      return;
    }

    if (allResults.length === 1) {
      navigateToResult(allResults[0]);
      return;
    }

    if (query.trim()) {
      setLocation(`/market-intelligence?q=${encodeURIComponent(query.trim())}`);
      setShowDropdown(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || allResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < allResults.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : allResults.length - 1
        );
        break;
      case "Escape":
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const formatBoroughLabel = (borough: string | null) => {
    if (!borough) return "";
    const boroughMap: Record<string, string> = {
      MN: "Manhattan",
      BK: "Brooklyn",
      QN: "Queens",
      BX: "Bronx",
      SI: "Staten Island",
    };
    return boroughMap[borough] || borough;
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            className={cn("h-12 pl-12 pr-4 text-base", inputClassName)}
            data-testid="input-smart-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results && setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            autoFocus={autoFocus}
            autoComplete="off"
          />
          {isLoading && (
            <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {showButton && (
          <Button type="submit" size="lg" className={cn("h-12 px-6", buttonClassName)} data-testid="button-smart-search">
            Search
          </Button>
        )}
      </form>

      {showDropdown && allResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 max-h-80 overflow-auto rounded-lg border bg-background shadow-lg">
          {results?.buildings && results.buildings.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                Buildings
              </div>
              {results.buildings.map((building, idx) => {
                const globalIdx = idx;
                return (
                  <button
                    key={building.baseBbl}
                    type="button"
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 text-left hover-elevate transition-colors",
                      selectedIndex === globalIdx && "bg-accent"
                    )}
                    onClick={() => navigateToResult({ type: "building", data: building })}
                    data-testid={`search-result-building-${building.baseBbl}`}
                  >
                    <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{building.displayAddress}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>{formatBoroughLabel(building.borough)}</span>
                        <span className="text-xs">•</span>
                        <span>{building.unitCount} units</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {results?.units && results.units.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                Units
              </div>
              {results.units.map((unit, idx) => {
                const globalIdx = (results?.buildings?.length || 0) + idx;
                return (
                  <button
                    key={unit.unitBbl}
                    type="button"
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 text-left hover-elevate transition-colors",
                      selectedIndex === globalIdx && "bg-accent"
                    )}
                    onClick={() => navigateToResult({ type: "unit", data: unit })}
                    data-testid={`search-result-unit-${unit.unitBbl}`}
                  >
                    <Home className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {unit.displayAddress}
                        {unit.unitDesignation && (
                          <span className="text-primary ml-1">Unit {unit.unitDesignation}</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatBoroughLabel(unit.borough)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {query.length >= 2 && (
            <button
              type="button"
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left border-t hover-elevate",
                selectedIndex === allResults.length && "bg-accent"
              )}
              onClick={() => {
                setLocation(`/market-intelligence?q=${encodeURIComponent(query.trim())}`);
                setShowDropdown(false);
              }}
              data-testid="search-result-see-all"
            >
              <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">
                See all results for "<span className="font-medium text-foreground">{query}</span>"
              </span>
            </button>
          )}
        </div>
      )}

      {showDropdown && query.length >= 2 && allResults.length === 0 && !isLoading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-lg border bg-background p-4 shadow-lg text-center text-muted-foreground">
          No properties found for "{query}"
        </div>
      )}
    </div>
  );
}
