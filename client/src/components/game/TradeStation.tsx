import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Plus, X, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { TradeOrder, TradeResource } from "@shared/schema";

interface Player {
  id: string;
  name: string;
  iron: number;
  fuel: number;
  crystal: number;
  frontier: number;
}

interface TradeStationProps {
  player: Player | null;
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

function ResourceBadge({ resource, amount }: { resource: TradeResource; amount: number }) {
  return (
    <span className={cn("font-mono font-bold", RESOURCE_COLORS[resource])}>
      {amount.toLocaleString()} {RESOURCE_LABELS[resource]}
    </span>
  );
}

function RatioLabel({ giveAmount, wantAmount }: { giveAmount: number; wantAmount: number }) {
  if (!giveAmount || !wantAmount) return null;
  const ratio = (wantAmount / giveAmount).toFixed(2);
  return (
    <span className="text-[10px] text-muted-foreground font-mono">1:{ratio}</span>
  );
}

export function TradeStation({ player, className }: TradeStationProps) {
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
        body: JSON.stringify({ playerId: player?.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to cancel");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Order Cancelled" });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fillMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const r = await fetch(`/api/trade/orders/${orderId}/fill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player?.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to fill order");
      return data;
    },
    onSuccess: (_, orderId) => {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        toast({
          title: "Trade Complete",
          description: `You gave ${order.giveAmount} ${RESOURCE_LABELS[order.wantResource]} and received ${order.giveAmount} ${RESOURCE_LABELS[order.giveResource]}.`,
        });
      } else {
        toast({ title: "Trade Complete" });
      }
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canAffordOrder = (order: TradeOrder): boolean => {
    if (!player) return false;
    return (player[order.wantResource as keyof Player] as number) >= order.wantAmount;
  };

  const handlePost = () => {
    if (!player) return;
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
    createMutation.mutate({ playerId: player.id, giveResource, giveAmount: ga, wantResource, wantAmount: wa });
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
        <Zap className="w-5 h-5 text-amber-400" />
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wide leading-none">Trade Station</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Post offers. Other commanders accept.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 shrink-0"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
          </Button>
          {player && (
            <Button
              size="sm"
              variant={showForm ? "secondary" : "default"}
              className="h-7 text-xs gap-1"
              onClick={() => setShowForm(v => !v)}
            >
              <Plus className="w-3.5 h-3.5" />
              New Order
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Create form */}
        {showForm && player && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-3 space-y-3">
              <p className="text-xs font-display uppercase tracking-wide text-amber-400 font-bold">New Trade Offer</p>

              <div className="grid grid-cols-2 gap-2">
                {/* Give side */}
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">You Give</p>
                  <Select value={giveResource} onValueChange={v => setGiveResource(v as TradeResource)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCES.map(r => (
                        <SelectItem key={r} value={r} className="text-xs">
                          <span className={RESOURCE_COLORS[r]}>{RESOURCE_LABELS[r]}</span>
                          <span className="text-muted-foreground ml-1">({(player[r as keyof Player] as number) ?? 0})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    placeholder="Amount"
                    value={giveAmount}
                    onChange={e => setGiveAmount(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                {/* Want side */}
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">You Want</p>
                  <Select value={wantResource} onValueChange={v => setWantResource(v as TradeResource)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCES.filter(r => r !== giveResource).map(r => (
                        <SelectItem key={r} value={r} className="text-xs">
                          <span className={RESOURCE_COLORS[r]}>{RESOURCE_LABELS[r]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    placeholder="Amount"
                    value={wantAmount}
                    onChange={e => setWantAmount(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold"
                  onClick={handlePost}
                  disabled={createMutation.isPending || !giveAmount || !wantAmount}
                >
                  {createMutation.isPending ? "Posting..." : "Post Order"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => setShowForm(false)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Orders list */}
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Zap className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No open orders</p>
            <p className="text-xs text-muted-foreground/60">Be the first to post a trade offer.</p>
          </div>
        ) : (
          orders.map(order => {
            const isOwn = player?.id === order.offererId;
            const affordable = canAffordOrder(order);
            return (
              <Card
                key={order.id}
                className={cn(
                  "border transition-colors",
                  isOwn
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-border/50 bg-card/60 hover:border-border",
                )}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    {/* Trade summary */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ResourceBadge resource={order.giveResource as TradeResource} amount={order.giveAmount} />
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <ResourceBadge resource={order.wantResource as TradeResource} amount={order.wantAmount} />
                        <RatioLabel giveAmount={order.giveAmount} wantAmount={order.wantAmount} />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-muted-foreground font-mono truncate">
                          {order.offererName}
                        </span>
                        {isOwn && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/40 text-amber-400">
                            YOUR ORDER
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="shrink-0">
                      {isOwn ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                          onClick={() => cancelMutation.mutate(order.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className={cn(
                            "h-7 text-xs font-bold",
                            affordable
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                              : "opacity-50 cursor-not-allowed",
                          )}
                          onClick={() => affordable && fillMutation.mutate(order.id)}
                          disabled={!affordable || fillMutation.isPending || !player}
                          title={!affordable ? `Need ${order.wantAmount} ${RESOURCE_LABELS[order.wantResource as TradeResource]}` : undefined}
                        >
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
