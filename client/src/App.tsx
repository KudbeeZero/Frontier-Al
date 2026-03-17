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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path="/game">
              <WalletProvider enableAutoConnect={true}>
                <GamePage />
              </WalletProvider>
            </Route>
            <Route path="/">
              <WalletProvider enableAutoConnect={false}>
                <LandingPage />
              </WalletProvider>
            </Route>
            <Route path="/info/economics">
              <WalletProvider enableAutoConnect={false}>
                <LandingEconomics />
              </WalletProvider>
            </Route>
            <Route path="/info/gameplay">
              <WalletProvider enableAutoConnect={false}>
                <LandingGameplay />
              </WalletProvider>
            </Route>
            <Route path="/info/features">
              <WalletProvider enableAutoConnect={false}>
                <LandingFeatures />
              </WalletProvider>
            </Route>
            <Route path="/info/updates">
              <WalletProvider enableAutoConnect={false}>
                <LandingUpdates />
              </WalletProvider>
            </Route>
            <Route path="/testnet">
              <WalletProvider enableAutoConnect={false}>
                <TestnetPage />
              </WalletProvider>
            </Route>
            <Route>
              <WalletProvider enableAutoConnect={false}>
                <NotFound />
              </WalletProvider>
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
