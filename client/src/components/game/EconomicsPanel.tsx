import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Flame,
  Coins,
  Globe,
  Users,
  BarChart3,
  ExternalLink,
  RefreshCw,
  Zap,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface EconomicsData {
  asaId: number | null;
  adminAddress: string;
  totalSupply: number;
  circulating: number;
  totalBurned: number;
  totalEarned: number;
  totalHeld: number;
  totalPendingClaim: number;
  totalFrontierPerDay: number;
  totalPlots: number;
  claimedPlots: number;
  humanPlayerCount: number;
  network: string;
  unitName: string;
  assetName: string;
  decimals: number;
}

function fmt(n: number, decimals = 2): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(decimals);
}

function pct(part: number, total: number): string {
  if (!total) return "0.0%";
  return ((part / total) * 100).toFixed(1) + "%";
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "destructive" | "yellow" | "green";
  className?: string;
}

function StatCard({ icon: Icon, label, value, sub, accent = "primary", className }: StatCardProps) {
  const accentClass =
    accent === "destructive" ? "text-destructive" :
    accent === "yellow" ? "text-yellow-400" :
    accent === "green" ? "text-emerald-400" :
    "text-primary";

  return (
    <div className={cn("bg-card/60 border border-border/50 rounded-lg p-3 flex items-start gap-3", className)}>
      <div className={cn("mt-0.5 shrink-0", accentClass)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-display">{label}</p>
        <p className={cn("font-mono font-bold text-base leading-tight", accentClass)}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

interface DistributionBarProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function DistributionBar({ label, value, total, color }: DistributionBarProps) {
  const width = total > 0 ? Math.max(2, (value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-muted-foreground font-display uppercase tracking-wide">{label}</span>
        <span className="text-[11px] font-mono text-foreground">{fmt(value)} <span className="text-muted-foreground">({pct(value, total)})</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

interface EconomicsPanelProps {
  className?: string;
}

export function EconomicsPanel({ className }: EconomicsPanelProps) {
  const { data, isLoading, error, refetch, isFetching } = useQuery<EconomicsData>({
    queryKey: ["/api/economics"],
    queryFn: () => fetch("/api/economics").then(r => r.json()),
    refetchInterval: 30_000,
  });

  const algoExplorerUrl = data?.asaId
    ? `https://testnet.explorer.perawallet.app/asset/${data.asaId}/`
    : null;

  const vestigeUrl = data?.asaId
    ? `https://vestige.fi/asset/${data.asaId}`
    : null;

  const tinyman = data?.asaId
    ? `https://testnet.tinyman.org/#/swap?asset_in=0&asset_out=${data.asaId}`
    : null;

  const treasury = data
    ? Math.max(0, data.totalSupply - data.circulating - data.totalBurned)
    : 0;

  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="economics-panel">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">Token Economics</h2>
        <Badge variant="secondary" className="ml-auto text-[10px] font-mono">FRONTIER / FRNTR</Badge>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 shrink-0"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-economics"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : error || !data ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Failed to load economics data</p>
            </div>
          ) : (
            <>
              {/* Token Identity */}
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-muted-foreground mb-2">Token Info</p>
                <div className="bg-card/60 border border-border/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Asset Name</span>
                    <span className="font-mono text-xs font-bold text-primary">{data.assetName} ({data.unitName})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Network</span>
                    <Badge variant="outline" className="text-[10px]">{data.network}</Badge>
                  </div>
                  {data.asaId ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">ASA ID</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-foreground">#{data.asaId}</span>
                        {algoExplorerUrl && (
                          <a
                            href={algoExplorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:opacity-80"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">ASA ID</span>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Pending</Badge>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Decimals</span>
                    <span className="font-mono text-xs text-foreground">{data.decimals}</span>
                  </div>
                </div>
              </div>

              {/* Supply Stats */}
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-muted-foreground mb-2">Supply</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    icon={Coins}
                    label="Total Supply"
                    value={fmt(data.totalSupply)}
                    sub="Hard cap — 1 Billion"
                    accent="primary"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="In Circulation"
                    value={fmt(data.circulating)}
                    sub={pct(data.circulating, data.totalSupply) + " of supply"}
                    accent="green"
                  />
                  <StatCard
                    icon={Flame}
                    label="Total Burned"
                    value={fmt(data.totalBurned)}
                    sub={pct(data.totalBurned, data.totalSupply) + " destroyed"}
                    accent="destructive"
                  />
                  <StatCard
                    icon={Lock}
                    label="Treasury"
                    value={fmt(treasury)}
                    sub="Held by admin reserve"
                    accent="yellow"
                  />
                </div>
              </div>

              {/* Distribution Breakdown */}
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-muted-foreground mb-2">Token Distribution</p>
                <div className="bg-card/60 border border-border/50 rounded-lg p-3 space-y-3">
                  <DistributionBar label="In Player Wallets" value={data.totalHeld} total={data.totalSupply} color="bg-primary" />
                  <DistributionBar label="Pending Claim" value={data.totalPendingClaim} total={data.totalSupply} color="bg-blue-500" />
                  <DistributionBar label="Burned (Spent)" value={data.totalBurned} total={data.totalSupply} color="bg-destructive" />
                  <DistributionBar label="Treasury Reserve" value={treasury} total={data.totalSupply} color="bg-yellow-500" />
                </div>
              </div>

              {/* Emission Stats */}
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-muted-foreground mb-2">Emission</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    icon={Zap}
                    label="Tokens / Day"
                    value={fmt(data.totalFrontierPerDay)}
                    sub="Current emission rate"
                    accent="yellow"
                  />
                  <StatCard
                    icon={Globe}
                    label="Plots Owned"
                    value={`${data.claimedPlots} / ${fmt(data.totalPlots, 0)}`}
                    sub={pct(data.claimedPlots, data.totalPlots) + " of map claimed"}
                    accent="primary"
                  />
                </div>
              </div>

              {/* Game Stats */}
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-muted-foreground mb-2">Game Activity</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    icon={Users}
                    label="Active Players"
                    value={String(data.humanPlayerCount)}
                    sub="Human commanders"
                    accent="green"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Total Earned"
                    value={fmt(data.totalEarned)}
                    sub="Lifetime FRONTIER mined"
                    accent="primary"
                  />
                </div>
              </div>

              {/* Buy / DEX Section */}
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-muted-foreground mb-2">Where to Buy</p>
                <div className="bg-card/60 border border-border/50 rounded-lg p-3 space-y-2.5">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    FRONTIER (FRNTR) is an Algorand Standard Asset (ASA). You can swap or provide liquidity on Algorand DEXs below. Make sure your wallet is opted in before trading.
                  </p>

                  <div className="flex flex-col gap-2">
                    {tinyman ? (
                      <a
                        href={tinyman}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-md px-3 py-2 transition-colors"
                      >
                        <div>
                          <p className="font-display text-xs font-bold uppercase tracking-wide text-primary">Tinyman DEX</p>
                          <p className="text-[10px] text-muted-foreground">Swap ALGO → FRONTIER</p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0" />
                      </a>
                    ) : null}

                    {vestigeUrl ? (
                      <a
                        href={vestigeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between bg-muted/30 hover:bg-muted/50 border border-border/50 rounded-md px-3 py-2 transition-colors"
                      >
                        <div>
                          <p className="font-display text-xs font-bold uppercase tracking-wide">Vestige.fi</p>
                          <p className="text-[10px] text-muted-foreground">Analytics & DEX aggregator</p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </a>
                    ) : null}

                    {algoExplorerUrl ? (
                      <a
                        href={algoExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between bg-muted/30 hover:bg-muted/50 border border-border/50 rounded-md px-3 py-2 transition-colors"
                      >
                        <div>
                          <p className="font-display text-xs font-bold uppercase tracking-wide">Pera Explorer</p>
                          <p className="text-[10px] text-muted-foreground">View on-chain asset details</p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </a>
                    ) : null}

                    {!data.asaId && (
                      <p className="text-[11px] text-muted-foreground text-center py-2">
                        DEX links available once ASA is deployed on-chain.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* How to Earn */}
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-muted-foreground mb-2">How to Earn FRONTIER</p>
                <div className="bg-card/60 border border-border/50 rounded-lg p-3 space-y-2">
                  {[
                    { label: "Own Land Plots", desc: "Each biome generates 0.5–1.5 FRONTIER/hr passively" },
                    { label: "Booster Buildings", desc: "Blockchain nodes, data centres & AI labs multiply your yield" },
                    { label: "Welcome Bonus", desc: "New commanders receive 500 FRONTIER on wallet connection" },
                    { label: "Claim On-Chain", desc: "Accumulated tokens sent directly to your Algorand wallet" },
                  ].map(({ label, desc }) => (
                    <div key={label} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[11px] font-bold text-foreground font-display uppercase tracking-wide">{label}</span>
                        <span className="text-[10px] text-muted-foreground"> — {desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Token Sink / Burn */}
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-muted-foreground mb-2">Token Sinks (Burns)</p>
                <div className="bg-card/60 border border-border/50 rounded-lg p-3 space-y-2">
                  {[
                    { label: "Commander Minting", desc: "Tier 1–3 commanders cost 100–500 FRONTIER to mint" },
                    { label: "Special Attacks", desc: "EMP, Nuke & Orbital Strike burn FRONTIER on use" },
                    { label: "Drone Recon", desc: "Deploying scout drones costs FRONTIER" },
                    { label: "Land Upgrades", desc: "Some facility upgrades consume FRONTIER tokens" },
                  ].map(({ label, desc }) => (
                    <div key={label} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-destructive mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[11px] font-bold text-foreground font-display uppercase tracking-wide">{label}</span>
                        <span className="text-[10px] text-muted-foreground"> — {desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground/50 text-center pb-2">
                Data refreshes every 30 seconds · Algorand TestNet
              </p>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
