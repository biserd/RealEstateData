import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import MarketExplorer from "@/pages/MarketExplorer";
import OpportunityScreener from "@/pages/OpportunityScreener";
import PropertyDetail from "@/pages/PropertyDetail";
import Watchlists from "@/pages/Watchlists";
import AdminConsole from "@/pages/AdminConsole";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/explore" component={MarketExplorer} />
          <Route path="/screener" component={OpportunityScreener} />
          <Route path="/property/:id" component={PropertyDetail} />
          <Route path="/watchlists" component={Watchlists} />
          <Route path="/admin" component={AdminConsole} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
