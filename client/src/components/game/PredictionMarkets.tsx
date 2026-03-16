import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { PredictionMarket, MarketPosition } from "@shared/schema";

interface PredictionMarketsPanelProps {
  currentPlayerId: string;
  currentPlayerFrontier: number;
  className?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  battle:  "bg-red-500/20 text-red-400 border-red-500/30",
  faction: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  season:  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  orbital: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  economy: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

function timeUntil(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return "Expired";
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function oddsLabel(poolA: number, poolB: number): { a: string; b: string } {
  const total = poolA + poolB;
  if (total === 0) return { a: "50%", b: "50%" };
  return {
    a: `${Math.round((poolA / total) * 100)}%`,
    b: `${Math.round((poolB / total) * 100)}%`,
  };
}

// ── Market Card ───────────────────────────────────────────────────────────────

function MarketCard({
  market,
  currentPlayerId,
  currentPlayerFrontier,
  onBetPlaced,
}: {
  market: PredictionMarket;
  currentPlayerId: string;
  currentPlayerFrontier: number;
  onBetPlaced: () => void;
}) {
  const { toast } = useToast();
  const [betOutcome, setBetOutcome] = useState<"a" | "b" | null>(null);
  const [betAmount, setBetAmount] = useState("");

  const betMutation = useMutation({
    mutationFn: ({ outcome, amount }: { outcome: "a" | "b"; amount: number }) =>
      fetch(`/api/markets/${market.id}/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: currentPlayerId, outcome, amount }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast({ title: "Bet Failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Bet Placed!", description: `You wagered ${betAmount} FRONTIER on ${betOutcome === "a" ? market.outcomeALabel : market.outcomeBLabel}.` });
      setBetOutcome(null);
      setBetAmount("");
      onBetPlaced();
    },
    onError: () => toast({ title: "Bet Failed", description: "Unexpected error", variant: "destructive" }),
  });

  const claimMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/markets/${market.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: currentPlayerId }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast({ title: "Claim Failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Winnings Claimed!", description: `+${data.payout} FRONTIER added to your balance.` });
      onBetPlaced();
    },
    onError: () => toast({ title: "Claim Failed", description: "Unexpected error", variant: "destructive" }),
  });

  const handleBet = () => {
    const amount = parseInt(betAmount, 10);
    if (!betOutcome || isNaN(amount) || amount < 1) {
      toast({ title: "Invalid Bet", description: "Select an outcome and enter a valid amount.", variant: "destructive" });
      return;
    }
    if (amount > currentPlayerFrontier) {
      toast({ title: "Insufficient Balance", description: "You don't have enough FRONTIER.", variant: "destructive" });
      return;
    }
    betMutation.mutate({ outcome: betOutcome, amount });
  };

  const odds = oddsLabel(market.tokenPoolA, market.tokenPoolB);
  const totalPool = market.tokenPoolA + market.tokenPoolB;
  const isOpen = market.status === "open";
  const isResolved = market.status === "resolved";

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] uppercase font-mono", CATEGORY_COLORS[market.category])}>
                {market.category}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px] uppercase font-mono", {
                "bg-green-500/20 text-green-400 border-green-500/30": isOpen,
                "bg-yellow-500/20 text-yellow-400 border-yellow-500/30": market.status === "closed",
                "bg-blue-500/20 text-blue-400 border-blue-500/30": isResolved,
                "bg-muted text-muted-foreground": market.status === "cancelled",
              })}>
                {market.status}
              </Badge>
            </div>
            <p className="text-sm font-medium leading-tight">{market.title}</p>
          </div>
          {isOpen && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
              <Clock className="w-3 h-3" />
              {timeUntil(market.resolvesAt)}
            </div>
          )}
          {isResolved && market.winningOutcome && (
            <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] whitespace-nowrap">
              {market.winningOutcome === "a" ? market.outcomeALabel : market.outcomeBLabel} won
            </Badge>
          )}
        </div>

        {/* Outcome bars */}
        <div className="space-y-1.5">
          {(["a", "b"] as const).map((side) => {
            const label = side === "a" ? market.outcomeALabel : market.outcomeBLabel;
            const pool = side === "a" ? market.tokenPoolA : market.tokenPoolB;
            const pct = parseInt(side === "a" ? odds.a : odds.b, 10);
            const isWinner = isResolved && market.winningOutcome === side;
            return (
              <button
                key={side}
                disabled={!isOpen || betMutation.isPending}
                onClick={() => setBetOutcome(betOutcome === side ? null : side)}
                className={cn(
                  "w-full text-left rounded-md border px-3 py-2 transition-all",
                  isOpen ? "cursor-pointer hover:border-primary/50" : "cursor-default",
                  betOutcome === side ? "border-primary bg-primary/10" : "border-border/50 bg-background/30",
                  isWinner && "border-blue-500/50 bg-blue-500/10",
                )}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium truncate">{label}</span>
                  <span className="font-mono text-muted-foreground ml-2 shrink-0">{pool.toLocaleString()} FRNTR · {side === "a" ? odds.a : odds.b}</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", isWinner ? "bg-blue-400" : "bg-primary/70")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-[10px] text-muted-foreground font-mono">
          Total pool: {totalPool.toLocaleString()} FRNTR · 5% protocol fee
        </div>

        {/* Bet form */}
        {isOpen && (
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              placeholder="Amount (FRNTR)"
              value={betAmount}
              onChange={e => setBetAmount(e.target.value)}
              className="h-8 text-sm font-mono"
            />
            <Button
              size="sm"
              disabled={!betOutcome || !betAmount || betMutation.isPending}
              onClick={handleBet}
              className="shrink-0"
            >
              {betMutation.isPending ? "..." : "Bet"}
            </Button>
          </div>
        )}

        {/* Claim button */}
        {isResolved && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending}
            className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          >
            {claimMutation.isPending ? "Claiming..." : "Claim Winnings"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Markets Tab ───────────────────────────────────────────────────────────────

function MarketsTab({ currentPlayerId, currentPlayerFrontier }: { currentPlayerId: string; currentPlayerFrontier: number }) {
  const queryClient = useQueryClient();
  const { data: markets = [], isFetching, refetch } = useQuery<PredictionMarket[]>({
    queryKey: ["/api/markets"],
    queryFn: () => fetch("/api/markets").then(r => r.json()),
    refetchInterval: 15_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/markets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/markets/history"] });
  };

  if (markets.length === 0 && !isFetching) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <TrendingUp className="w-10 h-10 opacity-30" />
        <p className="text-sm">No open markets right now.</p>
        <p className="text-xs opacity-60">Check back soon — admins post new markets regularly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{markets.length} open {markets.length === 1 ? "market" : "markets"}</span>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 px-2 text-xs gap-1">
          <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>
      {markets.map(m => (
        <MarketCard
          key={m.id}
          market={m}
          currentPlayerId={currentPlayerId}
          currentPlayerFrontier={currentPlayerFrontier}
          onBetPlaced={invalidate}
        />
      ))}
    </div>
  );
}

// ── My Bets Tab ───────────────────────────────────────────────────────────────

function MyBetsTab({ currentPlayerId, currentPlayerFrontier }: { currentPlayerId: string; currentPlayerFrontier: number }) {
  const queryClient = useQueryClient();
  const { data: positions = [], isFetching } = useQuery<(MarketPosition & { market: PredictionMarket })[]>({
    queryKey: ["/api/markets/player", currentPlayerId],
    queryFn: () => fetch(`/api/markets/player/${currentPlayerId}`).then(r => r.json()),
    refetchInterval: 15_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/markets/player", currentPlayerId] });
    queryClient.invalidateQueries({ queryKey: ["/api/markets"] });
  };

  if (positions.length === 0 && !isFetching) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <TrendingUp className="w-10 h-10 opacity-30" />
        <p className="text-sm">No bets placed yet.</p>
        <p className="text-xs opacity-60">Head to Open Markets to place your first bet.</p>
      </div>
    );
  }

  // Deduplicate by market — show one card per market
  const seen = new Set<string>();
  const uniqueMarkets = positions.reduce<PredictionMarket[]>((acc, p) => {
    if (!seen.has(p.marketId)) {
      seen.add(p.marketId);
      acc.push(p.market);
    }
    return acc;
  }, []);

  return (
    <div className="space-y-3">
      {uniqueMarkets.map(m => (
        <div key={m.id} className="space-y-1">
          <div className="text-[10px] text-muted-foreground font-mono px-1">
            Your positions:{" "}
            {positions
              .filter(p => p.marketId === m.id)
              .map(p => `${p.amountWagered} FRNTR on ${p.outcome === "a" ? m.outcomeALabel : m.outcomeBLabel}${p.claimed ? " ✓" : ""}`)
              .join(" · ")}
          </div>
          <MarketCard
            market={m}
            currentPlayerId={currentPlayerId}
            currentPlayerFrontier={currentPlayerFrontier}
            onBetPlaced={invalidate}
          />
        </div>
      ))}
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data: markets = [], isFetching } = useQuery<PredictionMarket[]>({
    queryKey: ["/api/markets/history"],
    queryFn: () => fetch("/api/markets/history").then(r => r.json()),
    refetchInterval: 30_000,
  });

  const resolved = markets.filter(m => m.status === "resolved" || m.status === "cancelled" || m.status === "closed");

  if (resolved.length === 0 && !isFetching) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <CheckCircle className="w-10 h-10 opacity-30" />
        <p className="text-sm">No resolved markets yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {resolved.map(m => (
        <Card key={m.id} className="border-border/50 bg-card/40">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-tight">{m.title}</p>
              <Badge variant="outline" className={cn("text-[10px] shrink-0", {
                "bg-blue-500/20 text-blue-400 border-blue-500/30": m.status === "resolved",
                "bg-yellow-500/20 text-yellow-400 border-yellow-500/30": m.status === "closed",
                "bg-muted text-muted-foreground": m.status === "cancelled",
              })}>
                {m.status}
              </Badge>
            </div>
            {m.status === "resolved" && m.winningOutcome && (
              <p className="text-xs text-muted-foreground">
                Winner: <span className="text-blue-400 font-medium">{m.winningOutcome === "a" ? m.outcomeALabel : m.outcomeBLabel}</span>
                {" · "}Pool: {(m.tokenPoolA + m.tokenPoolB).toLocaleString()} FRNTR
              </p>
            )}
            {m.status === "closed" && (
              <p className="text-xs text-muted-foreground">Awaiting admin resolution.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function PredictionMarketsPanel({ currentPlayerId, currentPlayerFrontier, className }: PredictionMarketsPanelProps) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <TrendingUp className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-sm font-display font-bold uppercase tracking-wider">Prediction Markets</h2>
          <p className="text-[10px] text-muted-foreground">Wager FRONTIER on game outcomes</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] text-muted-foreground">Balance</p>
          <p className="text-sm font-mono font-bold text-emerald-400">{currentPlayerFrontier.toLocaleString()} FRNTR</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto p-4">
        <Tabs defaultValue="open">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="open" className="flex-1 text-xs">Open Markets</TabsTrigger>
            <TabsTrigger value="mybets" className="flex-1 text-xs">My Bets</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 text-xs">Resolved</TabsTrigger>
          </TabsList>
          <TabsContent value="open">
            <MarketsTab currentPlayerId={currentPlayerId} currentPlayerFrontier={currentPlayerFrontier} />
          </TabsContent>
          <TabsContent value="mybets">
            <MyBetsTab currentPlayerId={currentPlayerId} currentPlayerFrontier={currentPlayerFrontier} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
