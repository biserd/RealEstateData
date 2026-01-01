import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Save, Mail, Clock, Zap, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ScreenerFilters } from "@shared/schema";

interface SaveSearchDialogProps {
  filters: ScreenerFilters;
  matchCount?: number;
  trigger?: React.ReactNode;
}

function getFilterSummary(filters: ScreenerFilters): string[] {
  const summary: string[] = [];
  
  if (filters.state) {
    summary.push(filters.state);
  }
  if (filters.cities?.length) {
    summary.push(`${filters.cities.length} ${filters.cities.length === 1 ? 'city' : 'cities'}`);
  }
  if (filters.zipCodes?.length) {
    summary.push(`${filters.zipCodes.length} ZIP${filters.zipCodes.length === 1 ? '' : 's'}`);
  }
  if (filters.propertyTypes?.length) {
    summary.push(`${filters.propertyTypes.join(', ')}`);
  }
  if (filters.priceMin || filters.priceMax) {
    const min = filters.priceMin ? `$${(filters.priceMin / 1000).toFixed(0)}K` : '$0';
    const max = filters.priceMax ? `$${(filters.priceMax / 1000000).toFixed(1)}M` : 'No max';
    summary.push(`${min} - ${max}`);
  }
  if (filters.opportunityScoreMin) {
    summary.push(`Score ${filters.opportunityScoreMin}+`);
  }
  if (filters.bedsBands?.length) {
    summary.push(`${filters.bedsBands.join(', ')} beds`);
  }
  if (filters.bathsBands?.length) {
    summary.push(`${filters.bathsBands.join(', ')} baths`);
  }
  
  return summary;
}

export function SaveSearchDialog({ filters, matchCount, trigger }: SaveSearchDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [emailEnabled, setEmailEnabled] = useState(true);

  const filterSummary = getFilterSummary(filters);
  const hasFilters = filterSummary.length > 0;

  const saveSearchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/saved-searches", {
        name: name.trim() || generateDefaultName(filters),
        filters,
        frequency,
        emailEnabled,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Search saved",
        description: emailEnabled 
          ? `You'll receive ${frequency === 'instant' ? 'instant' : frequency} alerts for new matches.`
          : "Your search has been saved. You can enable notifications later.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] });
      setOpen(false);
      setName("");
      setFrequency("daily");
      setEmailEnabled(true);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save search",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!hasFilters) {
      toast({
        title: "No filters applied",
        description: "Please apply at least one filter before saving your search.",
        variant: "destructive",
      });
      return;
    }
    saveSearchMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" data-testid="button-save-search">
            <Bell className="mr-2 h-4 w-4" />
            Save Search
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Save Search & Get Alerts
          </DialogTitle>
          <DialogDescription>
            Get notified when new properties match your criteria or when existing matches change.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="search-name">Search Name</Label>
            <Input
              id="search-name"
              placeholder={generateDefaultName(filters)}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-search-name"
            />
          </div>

          <div className="space-y-2">
            <Label>Current Filters</Label>
            {hasFilters ? (
              <div className="flex flex-wrap gap-1.5">
                {filterSummary.map((filter, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {filter}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No filters applied. Apply filters to save a search.
              </p>
            )}
            {matchCount !== undefined && (
              <p className="text-sm text-muted-foreground mt-2">
                Currently matching <strong>{matchCount}</strong> properties
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notification Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger data-testid="select-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span>Instant</span>
                    <span className="text-xs text-muted-foreground">(High priority)</span>
                  </div>
                </SelectItem>
                <SelectItem value="daily">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span>Daily digest</span>
                  </div>
                </SelectItem>
                <SelectItem value="weekly">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-500" />
                    <span>Weekly digest</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="email-notifications" className="text-sm font-medium">
                  Email notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive alerts at your registered email
                </p>
              </div>
            </div>
            <Switch
              id="email-notifications"
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
              data-testid="switch-email-notifications"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!hasFilters || saveSearchMutation.isPending}
            data-testid="button-confirm-save-search"
          >
            {saveSearchMutation.isPending ? (
              "Saving..."
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Search
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function generateDefaultName(filters: ScreenerFilters): string {
  const parts: string[] = [];
  
  if (filters.state) {
    parts.push(filters.state);
  }
  if (filters.cities?.length === 1) {
    parts.push(filters.cities[0]);
  }
  if (filters.propertyTypes?.length === 1) {
    parts.push(filters.propertyTypes[0]);
  }
  if (filters.opportunityScoreMin) {
    parts.push(`Score ${filters.opportunityScoreMin}+`);
  }
  
  if (parts.length === 0) {
    return "My Search";
  }
  
  return parts.slice(0, 3).join(" - ");
}
