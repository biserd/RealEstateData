import { Switch, Route } from "wouter";
import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
// Every route is lazy, including the auth boundary. The static HTML/CSS shell
// paints immediately while only the selected page module is downloaded.
const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/Landing"));
const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Toaster = lazy(() => import("@/components/ui/toaster").then((module) => ({ default: module.Toaster })));
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
const Methodology = lazy(() => import("@/pages/Methodology"));
const Comparisons = lazy(() => import("@/pages/Comparisons"));
const Guides = lazy(() => import("@/pages/Guides"));
const Guide = lazy(() => import("@/pages/Guide"));

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

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application render failed", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
          <div className="max-w-lg space-y-4 text-center">
            <h1 className="text-2xl font-semibold">This page could not load</h1>
            <p className="text-muted-foreground">
              Please reload the page. If the problem continues, return to the dashboard and try again.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
              <a className="rounded-md border px-4 py-2" href="/">
                Return home
              </a>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
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
        <Route path="/methodology/:topic" component={Methodology} />
        <Route path="/comparisons" component={Comparisons} />
        <Route path="/guides" component={Guides} />
        <Route path="/guides/:slug" component={Guide} />
        <Route path="/browse/:state" component={StateBrowse} />
        <Route path="/browse/:state/:city" component={CityBrowse} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            <Suspense fallback={null}>
              <Toaster />
            </Suspense>
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
