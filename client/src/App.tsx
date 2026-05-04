import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Login from "@/pages/Login";

// P-01: lazy-load non-critical routes so the initial bundle stays small.
// Landing, Home, and Login are eager because they sit on the auth boundary
// and one of them renders on every first paint.
const Register = lazy(() => import("@/pages/Register"));
const MarketExplorer = lazy(() => import("@/pages/MarketExplorer"));
const OpportunityScreener = lazy(() => import("@/pages/OpportunityScreener"));
const PropertyDetail = lazy(() => import("@/pages/PropertyDetail"));
const Watchlists = lazy(() => import("@/pages/Watchlists"));
const AdminConsole = lazy(() => import("@/pages/AdminConsole"));
const UpAndComingZips = lazy(() => import("@/pages/UpAndComingZips"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const About = lazy(() => import("@/pages/About"));
const Contact = lazy(() => import("@/pages/Contact"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const CheckoutSuccess = lazy(() => import("@/pages/CheckoutSuccess"));
const Settings = lazy(() => import("@/pages/Settings"));
const Developers = lazy(() => import("@/pages/Developers"));
const ApiAccess = lazy(() => import("@/pages/ApiAccess"));
const ReleaseNotes = lazy(() => import("@/pages/ReleaseNotes"));
const Portfolio = lazy(() => import("@/pages/Portfolio"));
const Activate = lazy(() => import("@/pages/Activate"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const BuildingDetail = lazy(() => import("@/pages/BuildingDetail"));
const UnitDetail = lazy(() => import("@/pages/UnitDetail"));
const PropertyResolver = lazy(() => import("@/pages/PropertyResolver"));
const StateBrowse = lazy(() => import("@/pages/StateBrowse"));
const CityBrowse = lazy(() => import("@/pages/CityBrowse"));
const PropertyComparison = lazy(() => import("@/pages/PropertyComparison"));
const NeighborhoodReport = lazy(() => import("@/pages/NeighborhoodReport"));
const InvestmentCalculator = lazy(() => import("@/pages/InvestmentCalculator"));

function RouteFallback() {
  return (
    <div
      className="flex h-[60vh] items-center justify-center"
      data-testid="route-fallback"
    >
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-foreground" />
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={isLoading || !isAuthenticated ? Landing : Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/activate" component={Activate} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/market-intelligence" component={MarketExplorer} />
        <Route path="/investment-opportunities" component={OpportunityScreener} />
        <Route path="/up-and-coming" component={UpAndComingZips} />
        <Route path="/properties/:slug" component={PropertyDetail} />
        <Route path="/building/:baseBbl" component={BuildingDetail} />
        <Route path="/unit/:unitBbl" component={UnitDetail} />
        <Route path="/property/:id" component={PropertyResolver} />
        <Route path="/saved-properties">
          {isAuthenticated ? <Watchlists /> : <Login />}
        </Route>
        <Route path="/admin-console">
          {isAuthenticated ? <AdminConsole /> : <Login />}
        </Route>
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/faq" component={FAQ} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/checkout/success" component={CheckoutSuccess} />
        <Route path="/settings">
          {isAuthenticated ? <Settings /> : <Login />}
        </Route>
        <Route path="/portfolio">
          {isAuthenticated ? <Portfolio /> : <Login />}
        </Route>
        <Route path="/developers" component={Developers} />
        <Route path="/api-access" component={ApiAccess} />
        <Route path="/release-notes" component={ReleaseNotes} />
        <Route path="/compare" component={PropertyComparison} />
        <Route path="/neighborhood/:geoId" component={NeighborhoodReport} />
        <Route path="/calculator" component={InvestmentCalculator} />
        <Route path="/browse/:state" component={StateBrowse} />
        <Route path="/browse/:state/:city" component={CityBrowse} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// P-03: MapProvider is no longer mounted at the root — it is now wrapped
// inside <PropertyMap> and the activated branch of <InteractiveStreetView>,
// so the Google Maps JS bundle is only requested on routes that visibly
// render an interactive map.
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
