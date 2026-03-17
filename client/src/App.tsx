import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/contexts/WalletContext";
import NotFound from "@/pages/not-found";
import GamePage from "@/pages/game";
import TestnetPage from "@/pages/testnet";
import LandingPage from "@/pages/landing";
import LandingEconomics from "@/pages/landing-economics";
import LandingGameplay from "@/pages/landing-gameplay";
import LandingFeatures from "@/pages/landing-features";
import LandingUpdates from "@/pages/landing-updates";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/info/economics" component={LandingEconomics} />
      <Route path="/info/gameplay" component={LandingGameplay} />
      <Route path="/info/features" component={LandingFeatures} />
      <Route path="/info/updates" component={LandingUpdates} />
      <Route path="/testnet" component={TestnetPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function GameRouter() {
  return (
    <Switch>
      <Route path="/game" component={GamePage} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          {/* Landing pages: no wallet auto-connect */}
          <WalletProvider enableAutoConnect={false}>
            <Router />
          </WalletProvider>
          {/* Game page: enable wallet auto-connect */}
          <WalletProvider enableAutoConnect={true}>
            <GameRouter />
          </WalletProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
