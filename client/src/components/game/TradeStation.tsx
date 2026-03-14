import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Plus, X, ArrowRight, RefreshCw, ArrowLeftRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { TradeOrder, TradeResource } from "@shared/schema";

interface TradeStationPanelProps {
  currentPlayerId: string;
  currentPlayerName: string;
  className?: string;
}

const RESOURCES: TradeResource[] = ["iron", "fuel", "crystal", "frontier"];

const RESOURCE_COLORS: Record<TradeResource, string> = {
  iron:     "text-slate-300",
  fuel:     "text-amber-400",
  crystal:  "text-cyan-400",
  frontier: "text-emerald-400",
};

const RESOURCE_LABELS: Record<TradeResource, string> = {
  iron:     "Iron",
  fuel:     "Fuel",
  crystal:  "Crystal",
  frontier: "FRONTIER",
};

const RESOURCE_ICONS: Record<string, string> = {
  iron:     "⚙️",
  fuel:     "⛽",
  crystal:  "💎",
  frontier: "⚡",
};

function relTime(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ResourceBadge({ resource, amount }: { resource: string; amount: number }) {
  return (
    <span className={cn("font-mono font-bold", RESOURCE_COLORS[resource as TradeResource] ?? "text-foreground")}>
      {amount.toLocaleString()} {RESOURCE_ICONS[resource]}{RESOURCE_LABELS[resource as TradeResource] ?? resource}
    </span>
  );
}

function RatioLabel({ giveAmount, wantAmount }: { giveAmount: number; wantAmount: number }) {
  if (!giveAmount || !wantAmount) return null;
  const ratio = (wantAmount / giveAmount).toFixed(2);
  return <span className="text-[10px] text-muted-foreground font-mono">1:{ratio}</span>;
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

function OrdersTab({ currentPlayerId }: { currentPlayerId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [giveResource, setGiveResource] = useState<TradeResource>("iron");
  const [wantResource, setWantResource] = useState<TradeResource>("fuel");
  const [giveAmount, setGiveAmount] = useState("");
  const [wantAmount, setWantAmount] = useState("");

  const { data: orders = [], isFetching, refetch } = useQuery<TradeOrder[]>({
    queryKey: ["/api/trade/orders"],
    queryFn: () => fetch("/api/trade/orders").then(r => r.json()),
    refetchInterval: 10_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/trade/orders"] });

  const createMutation = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch("/api/trade/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to post order");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Order Posted", description: "Your trade offer is now live." });
      setShowForm(false);
      setGiveAmount("");
      setWantAmount("");
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const r = await fetch(`/api/trade/orders/${orderId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: currentPlayerId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to cancel");
      return data;
    },
    onSuccess: () => { toast({ title: "Order Cancelled" }); invalidate(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fillMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const r = await fetch(`/api/trade/orders/${orderId}/fill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: currentPlayerId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to fill order");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Trade Complete", description: "Resources exchanged successfully." });
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/trade/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trade/leaderboard"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handlePost = () => {
    const ga = parseInt(giveAmount, 10);
    const wa = parseInt(wantAmount, 10);
    if (!ga || !wa || ga < 1 || wa < 1) {
      toast({ title: "Invalid amounts", description: "Amounts must be at least 1.", variant: "destructive" });
      return;
    }
    if (giveResource === wantResource) {
      toast({ title: "Invalid trade", description: "Cannot trade a resource for itself.", variant: "destructive" });
      return;
    }
    createMutation.mutate({ playerId: currentPlayerId, giveResource, giveAmount: ga, wantResource, wantAmount: wa });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header */}
      <div className="px-3 pt-2 pb-1 flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-muted-foreground">{orders.length} open {orders.length === 1 ? "offer" : "offers"}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
          </Button>
          {currentPlayerId && (
            <Button size="sm" variant={showForm ? "secondary" : "default"} className="h-7 text-xs gap-1"
              onClick={() => setShowForm(v => !v)}>
              <Plus className="w-3.5 h-3.5" /> New Order
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {/* Create form */}
        {showForm && currentPlayerId && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-3 space-y-3">
              <p className="text-xs font-display uppercase tracking-wide text-amber-400 font-bold">New Trade Offer</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">You Give</p>
                  <Select value={giveResource} onValueChange={v => setGiveResource(v as TradeResource)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESOURCES.map(r => (
                        <SelectItem key={r} value={r} className="text-xs">
                          <span className={RESOURCE_COLORS[r]}>{RESOURCE_ICONS[r]}{RESOURCE_LABELS[r]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={1} max={10000} placeholder="Amount" value={giveAmount}
                    onChange={e => setGiveAmount(e.target.value)} className="h-8 text-xs font-mono" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">You Want</p>
                  <Select value={wantResource} onValueChange={v => setWantResource(v as TradeResource)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESOURCES.filter(r => r !== giveResource).map(r => (
                        <SelectItem key={r} value={r} className="text-xs">
                          <span className={RESOURCE_COLORS[r]}>{RESOURCE_ICONS[r]}{RESOURCE_LABELS[r]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={1} max={10000} placeholder="Amount" value={wantAmount}
                    onChange={e => setWantAmount(e.target.value)} className="h-8 text-xs font-mono" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1 h-8 text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold"
                  onClick={handlePost} disabled={createMutation.isPending || !giveAmount || !wantAmount}>
                  {createMutation.isPending ? "Posting..." : "Post Order"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowForm(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Orders list */}
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <ArrowLeftRight className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No open orders</p>
            <p className="text-xs text-muted-foreground/60">Be the first to post a trade offer.</p>
          </div>
        ) : (
          orders.map(order => {
            const isOwn = currentPlayerId === order.offererId;
            return (
              <Card key={order.id} className={cn("border transition-colors",
                isOwn ? "border-amber-500/30 bg-amber-500/5" : "border-border/50 bg-card/60 hover:border-border")}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ResourceBadge resource={order.giveResource} amount={order.giveAmount} />
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <ResourceBadge resource={order.wantResource} amount={order.wantAmount} />
                        <RatioLabel giveAmount={order.giveAmount} wantAmount={order.wantAmount} />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-muted-foreground font-mono truncate">{order.offererName}</span>
                        {isOwn && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/40 text-amber-400">
                            YOUR ORDER
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isOwn ? (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                          onClick={() => cancelMutation.mutate(order.id)} disabled={cancelMutation.isPending}>
                          <X className="w-3 h-3" /> Cancel
                        </Button>
                      ) : (
                        <Button size="sm"
                          className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                          onClick={() => fillMutation.mutate(order.id)}
                          disabled={fillMutation.isPending || !currentPlayerId}>
                          Accept
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data: history = [], isFetching } = useQuery<TradeOrder[]>({
    queryKey: ["/api/trade/history"],
    queryFn: () => fetch("/api/trade/history").then(r => r.json()),
    refetchInterval: 15_000,
  });

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center gap-2">
        <Zap className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No completed trades yet.</p>
        {isFetching && <p className="text-xs text-muted-foreground/50">Loading…</p>}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-2">
      {history.map(trade => (
        <Card key={trade.id} className="border-border/40 bg-card/60">
          <CardContent className="p-3">
            {/* Players */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono mb-1.5">
              <span className="text-foreground font-semibold truncate">{trade.offererName}</span>
              <ArrowLeftRight className="w-3 h-3 shrink-0" />
              <span className="text-foreground font-semibold truncate">{trade.filledByName ?? "—"}</span>
              <span className="ml-auto shrink-0 text-[10px]">{trade.filledAt ? relTime(trade.filledAt) : ""}</span>
            </div>
            {/* Resources */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <ResourceBadge resource={trade.giveResource} amount={trade.giveAmount} />
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              <ResourceBadge resource={trade.wantResource} amount={trade.wantAmount} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Rankings Tab ──────────────────────────────────────────────────────────────

interface LeaderEntry {
  playerId: string;
  name: string;
  tradesPosted: number;
  tradesFilled: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function RankingsTab() {
  const { data: board = [] } = useQuery<LeaderEntry[]>({
    queryKey: ["/api/trade/leaderboard"],
    queryFn: () => fetch("/api/trade/leaderboard").then(r => r.json()),
    refetchInterval: 30_000,
  });

  if (board.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center gap-2">
        <Trophy className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No trades yet — post the first order!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
      {/* Header row */}
      <div className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem] gap-1 px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wide font-display mb-1">
        <span>#</span>
        <span>Commander</span>
        <span className="text-right">Filled</span>
        <span className="text-right">Posted</span>
        <span className="text-right">Total</span>
      </div>
      <div className="space-y-1">
        {board.map((entry, i) => (
          <div key={entry.playerId}
            className={cn("grid grid-cols-[2rem_1fr_3rem_3rem_3rem] gap-1 items-center px-2 py-2 rounded-lg text-sm",
              i < 3 ? "bg-amber-500/10 border border-amber-500/20" : "bg-card/40 border border-border/30")}>
            <span className="text-base leading-none">{MEDALS[i] ?? `${i + 1}`}</span>
            <span className="font-mono text-xs truncate">{entry.name}</span>
            <span className="text-right font-mono text-xs text-emerald-400">{entry.tradesFilled}</span>
            <span className="text-right font-mono text-xs text-amber-400">{entry.tradesPosted}</span>
            <span className="text-right font-mono text-xs font-bold">{entry.tradesFilled + entry.tradesPosted}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export function TradeStationPanel({ currentPlayerId, currentPlayerName: _currentPlayerName, className }: TradeStationPanelProps) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
        <Zap className="w-5 h-5 text-amber-400" />
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wide leading-none">Trade Station</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Post offers. Other commanders accept.</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="orders" className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-3 mt-2 shrink-0 grid grid-cols-3 h-8">
          <TabsTrigger value="orders"   className="text-xs">Orders</TabsTrigger>
          <TabsTrigger value="history"  className="text-xs">History</TabsTrigger>
          <TabsTrigger value="rankings" className="text-xs">Rankings</TabsTrigger>
        </TabsList>

        <TabsContent value="orders"   className="flex-1 overflow-hidden mt-0 flex flex-col">
          <OrdersTab currentPlayerId={currentPlayerId} />
        </TabsContent>
        <TabsContent value="history"  className="flex-1 overflow-hidden mt-0 flex flex-col">
          <HistoryTab />
        </TabsContent>
        <TabsContent value="rankings" className="flex-1 overflow-hidden mt-0 flex flex-col">
          <RankingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

