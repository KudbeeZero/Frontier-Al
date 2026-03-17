import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider as UseWalletProvider } from "@txnlab/use-wallet-react";
import { WalletProvider } from "@/contexts/WalletContext";
import { walletManager } from "@/lib/walletManager";
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
      <Route path="/game" component={GamePage} />
      <Route path="/testnet" component={TestnetPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <UseWalletProvider manager={walletManager}>
          <WalletProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </WalletProvider>
        </UseWalletProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
