import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Plus, 
  Heart, 
  Bell, 
  MapPin, 
  Trash2, 
  Edit2, 
  MoreHorizontal,
  Search,
  Folder,
  Home,
  Filter
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Header } from "@/components/Header";
import { PropertyCard } from "@/components/PropertyCard";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Watchlist, Property, Alert, Notification } from "@shared/schema";

interface WatchlistWithProperties extends Watchlist {
  properties?: Property[];
  alertCount?: number;
}

export default function Watchlists() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("watchlists");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("");

  const { data: watchlists, isLoading: loadingWatchlists } = useQuery<WatchlistWithProperties[]>({
    queryKey: ["/api/watchlists"],
  });

  const { data: notifications, isLoading: loadingNotifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const { data: alerts, isLoading: loadingAlerts } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const createWatchlistMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/watchlists", { name });
    },
    onSuccess: () => {
      toast({ title: "Watchlist created" });
      setIsCreateDialogOpen(false);
      setNewWatchlistName("");
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
    },
    onError: () => {
      toast({ title: "Failed to create watchlist", variant: "destructive" });
    },
  });

  const deleteWatchlistMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/watchlists/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Watchlist deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
    },
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/notifications/${id}`, { isRead: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Watchlists & Alerts</h1>
            <p className="text-muted-foreground">
              Track properties and get notified when conditions change
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-watchlist">
                <Plus className="mr-2 h-4 w-4" />
                New Watchlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Watchlist</DialogTitle>
                <DialogDescription>
                  Create a new watchlist to save properties and set up alerts.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="name">Watchlist Name</Label>
                <Input
                  id="name"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  placeholder="e.g., Brooklyn 3BR under $600K"
                  className="mt-2"
                  data-testid="input-watchlist-name"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createWatchlistMutation.mutate(newWatchlistName)}
                  disabled={!newWatchlistName.trim() || createWatchlistMutation.isPending}
                  data-testid="button-confirm-create"
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="watchlists" data-testid="tab-watchlists">
              <Folder className="mr-2 h-4 w-4" />
              Watchlists
              {watchlists && watchlists.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {watchlists.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">
              <Filter className="mr-2 h-4 w-4" />
              Alert Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="watchlists">
            {loadingWatchlists ? (
              <LoadingState type="skeleton-list" count={3} />
            ) : watchlists && watchlists.length > 0 ? (
              <div className="space-y-6">
                {watchlists.map((watchlist) => (
                  <Card key={watchlist.id}>
                    <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Folder className="h-5 w-5 text-muted-foreground" />
                          {watchlist.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {watchlist.properties?.length || 0} properties
                          {watchlist.geoId && (
                            <span className="ml-2">
                              <MapPin className="mr-1 inline h-3 w-3" />
                              {watchlist.geoId}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {watchlist.alertCount && watchlist.alertCount > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <Bell className="h-3 w-3" />
                            {watchlist.alertCount} alerts
                          </Badge>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit2 className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Bell className="mr-2 h-4 w-4" />
                              Configure Alerts
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteWatchlistMutation.mutate(watchlist.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {watchlist.properties && watchlist.properties.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {watchlist.properties.slice(0, 3).map((property) => (
                            <PropertyCard
                              key={property.id}
                              property={property}
                              isSaved
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-8 text-center">
                          <div>
                            <Home className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              No properties saved yet
                            </p>
                            <Link href="/investment-opportunities">
                              <Button variant="ghost" size="sm">
                                Browse properties
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Folder className="h-8 w-8" />}
                title="No watchlists yet"
                description="Create a watchlist to save properties and set up alerts for market changes."
                action={{
                  label: "Create Watchlist",
                  onClick: () => setIsCreateDialogOpen(true),
                }}
              />
            )}
          </TabsContent>

          <TabsContent value="notifications">
            {loadingNotifications ? (
              <LoadingState type="skeleton-list" count={5} />
            ) : notifications && notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={notification.isRead ? "opacity-60" : ""}
                  >
                    <CardContent className="flex items-start gap-4 p-4">
                      <div
                        className={`mt-1 h-2 w-2 rounded-full ${
                          notification.isRead ? "bg-muted" : "bg-primary"
                        }`}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(notification.createdAt!).toLocaleString()}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            markNotificationReadMutation.mutate(notification.id)
                          }
                        >
                          Mark read
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Bell className="h-8 w-8" />}
                title="No notifications"
                description="You'll see alerts here when properties in your watchlists have updates."
              />
            )}
          </TabsContent>

          <TabsContent value="alerts">
            {loadingAlerts ? (
              <LoadingState type="skeleton-list" count={3} />
            ) : alerts && alerts.length > 0 ? (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <Card key={alert.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Bell className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {alert.alertType === "score_threshold"
                              ? `Score above ${alert.threshold}`
                              : alert.alertType === "price_cut"
                                ? "Price reduction"
                                : alert.alertType === "new_comp"
                                  ? "New comparable sale"
                                  : "Market shift"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {alert.propertyId
                              ? "Property alert"
                              : alert.watchlistId
                                ? "Watchlist alert"
                                : "General alert"}
                          </p>
                        </div>
                      </div>
                      <Switch checked={alert.isActive ?? false} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Filter className="h-8 w-8" />}
                title="No alerts configured"
                description="Set up alerts to get notified when properties match your criteria."
                action={{
                  label: "Create Alert",
                  onClick: () => {},
                }}
              />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
