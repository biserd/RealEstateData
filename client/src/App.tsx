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
import Login from "@/pages/Login";
import Register from "@/pages/Register";
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
import FAQ from "@/pages/FAQ";
import Pricing from "@/pages/Pricing";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import Settings from "@/pages/Settings";
import Developers from "@/pages/Developers";
import ApiAccess from "@/pages/ApiAccess";
import ReleaseNotes from "@/pages/ReleaseNotes";
import Portfolio from "@/pages/Portfolio";
import Activate from "@/pages/Activate";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import BuildingDetail from "@/pages/BuildingDetail";
import UnitDetail from "@/pages/UnitDetail";
import PropertyResolver from "@/pages/PropertyResolver";
import StateBrowse from "@/pages/StateBrowse";
import CityBrowse from "@/pages/CityBrowse";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
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
      <Route path="/browse/:state" component={StateBrowse} />
      <Route path="/browse/:state/:city" component={CityBrowse} />
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
