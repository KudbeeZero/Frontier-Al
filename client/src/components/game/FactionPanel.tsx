/**
 * FactionPanel.tsx
 *
 * Displays the 4 game factions with live stats (members, territory, resources)
 * and allows the current player to join/switch faction alignment.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Map, Zap, Hammer, TrendingUp, Shield, Swords, DollarSign, CheckCircle2, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Player } from "@shared/schema";

interface FactionData {
  name: string;
  unitName: string;
  assetName: string;
  behavior: string;
  lore: string;
  totalSupply: number;
  assetId: number | null;
  explorerUrl: string | null;
  onChain: boolean;
  memberCount: number;
  territoryCount: number;
  iron: number;
  fuel: number;
  treasury: number;
}

interface FactionPanelProps {
  player: Player | null | undefined;
  className?: string;
}

const BEHAVIOR_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  expansionist: { label: "Expansionist", color: "text-blue-400 border-blue-400/30 bg-blue-400/10",  icon: TrendingUp },
  defensive:    { label: "Defensive",    color: "text-green-400 border-green-400/30 bg-green-400/10", icon: Shield },
  raider:       { label: "Raider",       color: "text-red-400 border-red-400/30 bg-red-400/10",      icon: Swords },
  economic:     { label: "Economic",     color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10", icon: DollarSign },
};

const FACTION_COLORS: Record<string, string> = {
  "NEXUS-7":  "border-blue-500/40 bg-blue-500/5",
  "KRONOS":   "border-green-500/40 bg-green-500/5",
  "VANGUARD": "border-red-500/40 bg-red-500/5",
  "SPECTRE":  "border-yellow-500/40 bg-yellow-500/5",
};

const FACTION_ACCENT: Record<string, string> = {
  "NEXUS-7":  "bg-blue-500",
  "KRONOS":   "bg-green-500",
  "VANGUARD": "bg-red-500",
  "SPECTRE":  "bg-yellow-500",
};

const MAX_TERRITORY = 21000; // total plots in world

function FactionCard({
  faction,
  isAligned,
  playerId,
  onJoin,
  onLeave,
  isJoining,
}: {
  faction: FactionData;
  isAligned: boolean;
  playerId: string | null;
  onJoin: (factionName: string) => void;
  onLeave: () => void;
  isJoining: boolean;
}) {
  const meta = BEHAVIOR_META[faction.behavior] ?? BEHAVIOR_META.expansionist;
  const BehaviorIcon = meta.icon;
  const territoryPct = Math.min(100, (faction.territoryCount / MAX_TERRITORY) * 100);

  // Financial stability = weighted composite of territory (50%) + treasury (30%) + resources (20%)
  const maxTreasury = 10000;
  const maxResources = 5000;
  const stabilityPct = Math.min(
    100,
    (faction.territoryCount / MAX_TERRITORY) * 50 +
    Math.min(100, (faction.treasury / maxTreasury) * 100) * 0.3 +
    Math.min(100, ((faction.iron + faction.fuel) / maxResources) * 100) * 0.2
  );

  return (
    <div
      className={cn(
        "relative rounded-lg border p-4 space-y-3 transition-all",
        FACTION_COLORS[faction.name] ?? "border-border bg-card",
        isAligned && "ring-1 ring-primary/60"
      )}
      data-testid={`faction-card-${faction.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm uppercase tracking-widest font-bold">
              {faction.name}
            </span>
            {isAligned && (
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/70 font-mono uppercase tracking-wider mt-0.5">
            {faction.unitName} · {faction.behavior.toUpperCase()}
          </p>
        </div>
        <Badge
          className={cn("text-[10px] shrink-0 border", meta.color)}
          variant="outline"
        >
          <BehaviorIcon className="w-2.5 h-2.5 mr-1" />
          {meta.label}
        </Badge>
      </div>

      {/* Lore */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">{faction.lore}</p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="w-3 h-3 shrink-0" />
          <span className="font-mono">{faction.memberCount}</span>
          <span className="text-[10px]">members</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Map className="w-3 h-3 shrink-0" />
          <span className="font-mono">{faction.territoryCount.toLocaleString()}</span>
          <span className="text-[10px]">plots</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Hammer className="w-3 h-3 shrink-0" />
          <span className="font-mono">{faction.iron.toLocaleString()}</span>
          <span className="text-[10px]">iron</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="w-3 h-3 shrink-0" />
          <span className="font-mono">{faction.fuel.toLocaleString()}</span>
          <span className="text-[10px]">fuel</span>
        </div>
      </div>

      {/* Territory control bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="uppercase tracking-wider">Territory Control</span>
          <span className="font-mono">{territoryPct.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", FACTION_ACCENT[faction.name] ?? "bg-primary")}
            style={{ width: `${territoryPct}%` }}
          />
        </div>
      </div>

      {/* Financial stability bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="uppercase tracking-wider">Financial Stability</span>
          <span className={cn(
            "font-mono font-bold",
            stabilityPct >= 60 ? "text-green-400" :
            stabilityPct >= 30 ? "text-yellow-400" : "text-red-400"
          )}>
            {stabilityPct >= 60 ? "STABLE" : stabilityPct >= 30 ? "VOLATILE" : "FRAGILE"}
          </span>
        </div>
        <Progress
          value={stabilityPct}
          className={cn(
            "h-1.5",
            stabilityPct >= 60 ? "[&>div]:bg-green-500" :
            stabilityPct >= 30 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"
          )}
        />
      </div>

      {/* Action button */}
      {playerId && (
        <div className="pt-1">
          {isAligned ? (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-primary text-xs font-display uppercase tracking-wide">
                <CheckCircle2 className="w-3 h-3" />
                Aligned
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] text-muted-foreground hover:text-destructive h-auto py-1.5 px-2"
                onClick={onLeave}
                disabled={isJoining}
              >
                <LogOut className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs font-display uppercase tracking-wide h-8"
              onClick={() => onJoin(faction.name)}
              disabled={isJoining}
            >
              {isJoining ? "Joining..." : "Align with Faction"}
            </Button>
          )}
        </div>
      )}

      {/* On-chain badge */}
      {faction.onChain && (
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground/50">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500/60 inline-block" />
          <span className="font-mono">ASA #{faction.assetId}</span>
        </div>
      )}
    </div>
  );
}

export function FactionPanel({ player, className }: FactionPanelProps) {
  const queryClient = useQueryClient();
  const [joiningFaction, setJoiningFaction] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ factions: FactionData[] }>({
    queryKey: ["/api/factions"],
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const joinMutation = useMutation({
    mutationFn: async (factionName: string) => {
      const res = await fetch(`/api/factions/${encodeURIComponent(factionName)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player?.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to join faction");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/factions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
      setJoiningFaction(null);
    },
    onError: () => setJoiningFaction(null),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/factions/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player?.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to leave faction");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/factions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });

  const handleJoin = (factionName: string) => {
    setJoiningFaction(factionName);
    joinMutation.mutate(factionName);
  };

  const handleLeave = () => {
    leaveMutation.mutate();
  };

  const currentFaction = player?.playerFactionId ?? null;
  const factions = data?.factions ?? [];

  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="faction-panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h2 className="font-display text-sm uppercase tracking-widest text-primary">Factions</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {currentFaction
            ? `Aligned with ${currentFaction}`
            : "Choose a faction to align with"}
        </p>
      </div>

      {/* Unaligned banner */}
      {!currentFaction && player && (
        <div className="mx-4 mt-3 p-3 rounded-md border border-muted-foreground/20 bg-muted/30 text-[11px] text-muted-foreground leading-relaxed">
          Aligning with a faction is required to participate in faction-based rewards and cooperative territory defense. Choose wisely — each faction has a distinct strategic style.
        </div>
      )}

      {/* Faction cards */}
      <ScrollArea className="flex-1 px-4 py-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Failed to load faction data
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {factions.map((faction) => (
              <FactionCard
                key={faction.name}
                faction={faction}
                isAligned={currentFaction === faction.name}
                playerId={player?.id ?? null}
                onJoin={handleJoin}
                onLeave={handleLeave}
                isJoining={joiningFaction === faction.name && joinMutation.isPending}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
