import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, Building2, Home, MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchResult {
  buildings: Array<{
    baseBbl: string;
    displayAddress: string;
    borough: string | null;
    unitCount: number;
  }>;
  units: Array<{
    unitBbl: string;
    baseBbl: string;
    unitDesignation: string | null;
    displayAddress: string | null;
    borough: string | null;
  }>;
  locations: Array<{
    type: string;
    id: string;
    name: string;
    state: string;
  }>;
}

interface RateLimitError {
  message: string;
  upgrade: boolean;
  upgradeUrl: string;
}

type EntityFilter = "all" | "buildings" | "units";

export function GlobalSearch() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [rateLimitError, setRateLimitError] = useState<RateLimitError | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setRateLimitError(null);
      try {
        const res = await fetch(
          `/api/search/unified?q=${encodeURIComponent(query)}&filter=${entityFilter}`,
          { credentials: "include" }
        );
        if (res.ok) {
          setResults(await res.json());
        } else if (res.status === 429) {
          const errorData = await res.json();
          setRateLimitError(errorData);
          setResults(null);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, entityFilter]);

  const handleSelect = (type: "building" | "unit" | "location", id: string, locationData?: { type: string; state: string }) => {
    setIsOpen(false);
    setQuery("");
    
    if (type === "building") {
      navigate(`/building/${id}`);
    } else if (type === "unit") {
      navigate(`/unit/${id}`);
    } else if (type === "location" && locationData) {
      const { type: locType, state } = locationData;
      if (locType === "zip") {
        navigate(`/market-intelligence?state=${state}&zipCode=${id}`);
      } else if (locType === "city") {
        navigate(`/market-intelligence?state=${state}&city=${id}`);
      } else if (locType === "neighborhood") {
        navigate(`/market-intelligence?state=${state}&cd=${id}`);
      }
    }
  };

  const totalResults = 
    (results?.buildings?.length || 0) + 
    (results?.units?.length || 0) + 
    (results?.locations?.length || 0);

  const showResults = isOpen && query.length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          placeholder="Search addresses, units, or locations..."
          className="pl-10 pr-8 bg-muted/50"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          data-testid="input-global-search"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults(null);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border bg-popover shadow-lg z-50 overflow-hidden" data-testid="search-results-dropdown">
          <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
            <Button
              size="sm"
              variant={entityFilter === "all" ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setEntityFilter("all")}
              data-testid="filter-all"
            >
              All
            </Button>
            <Button
              size="sm"
              variant={entityFilter === "buildings" ? "secondary" : "ghost"}
              className="h-7 text-xs gap-1"
              onClick={() => setEntityFilter("buildings")}
              data-testid="filter-buildings"
            >
              <Building2 className="h-3 w-3" />
              Buildings
            </Button>
            <Button
              size="sm"
              variant={entityFilter === "units" ? "secondary" : "ghost"}
              className="h-7 text-xs gap-1"
              onClick={() => setEntityFilter("units")}
              data-testid="filter-units"
            >
              <Home className="h-3 w-3" />
              Units
            </Button>
          </div>

          <div className="max-h-80 overflow-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : rateLimitError ? (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">{rateLimitError.message}</p>
                {rateLimitError.upgrade && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsOpen(false);
                      navigate(rateLimitError.upgradeUrl);
                    }}
                    data-testid="button-upgrade-search"
                  >
                    Upgrade Now
                  </Button>
                )}
              </div>
            ) : totalResults === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No results found for "{query}"
              </div>
            ) : (
              <>
                {results?.buildings && results.buildings.length > 0 && entityFilter !== "units" && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                      Buildings
                    </div>
                    {results.buildings.map((building) => (
                      <button
                        key={building.baseBbl}
                        className="w-full flex items-center gap-3 p-3 hover-elevate text-left"
                        onClick={() => handleSelect("building", building.baseBbl)}
                        data-testid={`result-building-${building.baseBbl}`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 shrink-0">
                          <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{building.displayAddress}</p>
                          <p className="text-xs text-muted-foreground">
                            {building.borough} · {building.unitCount} units
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          Building
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}

                {results?.units && results.units.length > 0 && entityFilter !== "buildings" && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                      Units
                    </div>
                    {results.units.map((unit) => (
                      <button
                        key={unit.unitBbl}
                        className="w-full flex items-center gap-3 p-3 hover-elevate text-left"
                        onClick={() => handleSelect("unit", unit.unitBbl)}
                        data-testid={`result-unit-${unit.unitBbl}`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 shrink-0">
                          <Home className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {unit.displayAddress || `Unit ${unit.unitDesignation || unit.unitBbl.slice(-4)}`}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {unit.unitDesignation ? `Unit ${unit.unitDesignation}` : ""}{unit.borough ? ` · ${unit.borough}` : "NYC"}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                          Unit
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}

                {results?.locations && results.locations.length > 0 && entityFilter === "all" && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                      Locations
                    </div>
                    {results.locations.map((location) => (
                      <button
                        key={`${location.type}-${location.id}`}
                        className="w-full flex items-center gap-3 p-3 hover-elevate text-left"
                        onClick={() => handleSelect("location", location.id, { type: location.type, state: location.state })}
                        data-testid={`result-location-${location.id}`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 shrink-0">
                          <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{location.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {location.state} · {location.type}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
