import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { MapProvider } from "@/components/MapProvider";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import MarketExplorer from "@/pages/MarketExplorer";
import OpportunityScreener from "@/pages/OpportunityScreener";
import PropertyDetail from "@/pages/PropertyDetail";
import Watchlists from "@/pages/Watchlists";
import AdminConsole from "@/pages/AdminConsole";
import UpAndComingZips from "@/pages/UpAndComingZips";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import About from "@/pages/About";
import Contact from "@/pages/Contact";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/" component={isLoading || !isAuthenticated ? Landing : Home} />
      <Route path="/market-intelligence" component={MarketExplorer} />
      <Route path="/investment-opportunities" component={OpportunityScreener} />
      <Route path="/up-and-coming" component={UpAndComingZips} />
      <Route path="/properties/:slug" component={PropertyDetail} />
      <Route path="/saved-properties">
        {isAuthenticated ? <Watchlists /> : <Landing />}
      </Route>
      <Route path="/admin-console">
        {isAuthenticated ? <AdminConsole /> : <Landing />}
      </Route>
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MapProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </MapProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
