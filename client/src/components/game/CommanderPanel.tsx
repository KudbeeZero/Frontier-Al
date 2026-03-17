import { useState, useEffect, useRef } from "react";
import {
  Shield, Swords, Zap, Target, Radio, Crosshair, Skull, Radar, Clock,
  Satellite, Gift, Loader2, Lock, ChevronDown, ChevronUp, Pickaxe, Fuel,
  AlertTriangle, MapPin, CheckCircle2, XCircle, ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Player, CommanderTier, SpecialAttackType, LandParcel } from "@shared/schema";
import {
  COMMANDER_INFO, SPECIAL_ATTACK_INFO, DRONE_MINT_COST_FRONTIER, MAX_DRONES,
  DRONE_SCOUT_DURATION_MS, SATELLITE_DEPLOY_COST_FRONTIER, MAX_SATELLITES,
  SATELLITE_ORBIT_DURATION_MS, SATELLITE_YIELD_BONUS, ATTACK_BASE_COST, biomeBonuses,
} from "@shared/schema";
import type { SubParcel } from "@shared/schema";
import sentinelImg from "@assets/image_1771570491560.png";
import phantomImg from "@assets/image_1771570495782.png";
import reaperImg from "@assets/image_1771570500912.png";
import droneImg from "@assets/image_1771570514563.png";

// ── Companion animal config per tier ─────────────────────────────────────────
const COMPANION: Record<CommanderTier, { emoji: string; name: string; flavor: string; winMsg: string; loseMsg: string }> = {
  sentinel: {
    emoji: "🐺",
    name: "Iron Wolf",
    flavor: "Mechanical legs, energy jaw, tactical suppression",
    winMsg: "Iron Wolf seized the sub-parcel.",
    loseMsg: "Iron Wolf retreated — defenses held.",
  },
  phantom: {
    emoji: "🦊",
    name: "Shadow Fox",
    flavor: "Cloaked chassis, EMP tail, stealth recon plating",
    winMsg: "Shadow Fox slipped through the defenses.",
    loseMsg: "Shadow Fox vanished — target too fortified.",
  },
  reaper: {
    emoji: "🦅",
    name: "Apex Raptor",
    flavor: "Biomechanical wings, siege talons, orbital targeting",
    winMsg: "Apex Raptor tore through the fortification.",
    loseMsg: "Apex Raptor pulled back — no breach achieved.",
  },
};

const COMMANDER_IMAGES: Record<CommanderTier, string> = { sentinel: sentinelImg, phantom: phantomImg, reaper: reaperImg };
const TIER_COLORS: Record<CommanderTier, string> = { sentinel: "#3b82f6", phantom: "#a855f7", reaper: "#f97316" };
const TIER_BORDER: Record<CommanderTier, string> = {
  sentinel: "border-blue-500/60 bg-blue-500/5",
  phantom:  "border-purple-500/60 bg-purple-500/5",
  reaper:   "border-orange-500/60 bg-orange-500/5",
};
const ATTACK_ICONS: Record<SpecialAttackType, React.ElementType> = {
  orbital_strike: Target, emp_blast: Zap, siege_barrage: Crosshair, sabotage: Skull,
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ready";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SatelliteCard({ satellite, index }: { satellite: Player["satellites"][0]; index: number }) {
  const now = Date.now();
  const remaining = Math.max(0, satellite.expiresAt - now);
  const elapsed = now - satellite.deployedAt;
  const progressPct = satellite.status === "active" ? Math.min(100, (elapsed / SATELLITE_ORBIT_DURATION_MS) * 100) : 100;
  const isExpired = satellite.status === "expired" || remaining === 0;
  const [, tick] = useState(0);
  useEffect(() => {
    if (isExpired) return;
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [isExpired]);

  return (
    <Card className={cn("p-2 border text-xs", isExpired ? "border-muted opacity-60" : "border-yellow-500/50 bg-yellow-500/5")}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-display uppercase tracking-wide text-[10px]">SAT-{String(index + 1).padStart(2, "0")}</span>
        <Badge variant={isExpired ? "secondary" : "default"} className="text-[9px] px-1 py-0">{isExpired ? "expired" : "orbiting"}</Badge>
      </div>
      {!isExpired && (
        <>
          <div className="w-full bg-muted rounded-full h-1 mb-1">
            <div className="h-1 rounded-full bg-yellow-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-2.5 h-2.5" /><span>{formatCountdown(remaining)} remaining</span>
          </div>
        </>
      )}
    </Card>
  );
}

function DroneCard({ drone, index }: { drone: Player["drones"][0]; index: number }) {
  const elapsed = Date.now() - drone.deployedAt;
  const remaining = Math.max(0, DRONE_SCOUT_DURATION_MS - elapsed);
  const isExpired = remaining === 0 && drone.status === "scouting";
  const progressPct = drone.status === "scouting" ? Math.min(100, (elapsed / DRONE_SCOUT_DURATION_MS) * 100) : 0;
  const [, tick] = useState(0);
  useEffect(() => {
    if (isExpired || drone.status !== "scouting") return;
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [isExpired, drone.status]);

  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return (
    <div className="p-2.5 border border-border rounded-md">
      <div className="flex items-center gap-2 mb-1.5">
        <img src={droneImg} alt="Recon Drone" className="w-8 h-8 rounded-md object-cover" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-display uppercase tracking-wide block">Drone #{index + 1}</span>
          <Badge variant={isExpired || drone.status === "returned" ? "secondary" : "outline"} className="text-[9px]">
            {isExpired ? "Report Ready" : drone.status === "scouting" ? `Scouting ${m}:${String(s).padStart(2, "0")}` : drone.status}
          </Badge>
        </div>
      </div>
      {(isExpired || drone.scoutReportReady) && drone.discoveredResources && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <span>+{drone.discoveredResources.iron}I</span>
          <span>+{drone.discoveredResources.fuel}F</span>
          <span>+{drone.discoveredResources.crystal}C</span>
        </div>
      )}
      {drone.status === "scouting" && !isExpired && (
        <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </div>
  );
}

function CommanderNftStatus({ commanderId, onClaim, isClaiming, walletConnected }: {
  commanderId: string; onClaim?: (id: string) => void; isClaiming?: boolean; walletConnected?: boolean;
}) {
  const { data, isLoading } = useQuery<{ exists: boolean; status?: string; assetId?: number }>({
    queryKey: ["/api/nft/commander", commanderId],
    queryFn: async () => {
      const res = await fetch(`/api/nft/commander/${commanderId}`);
      if (!res.ok) return { exists: false };
      return res.json();
    },
    staleTime: 30_000, retry: false,
  });
  if (isLoading) return <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /><span>NFT…</span></div>;
  if (!data?.exists) return null;
  const delivered = data.status === "delivered";
  const inCustody = data.status === "minted" || data.status === "pending";
  return (
    <div className="mt-1 flex items-center gap-1 flex-wrap">
      {delivered ? (
        <Badge className="text-[8px] bg-green-500/20 text-green-400 border-green-500/30 gap-1"><Gift className="w-2 h-2" />NFT</Badge>
      ) : inCustody ? (
        <>
          <Badge variant="outline" className="text-[8px] text-yellow-400 border-yellow-500/30 gap-1"><Gift className="w-2 h-2" />ASA {data.assetId}</Badge>
          {walletConnected && onClaim && (
            <Button size="sm" variant="outline" className="text-[8px] h-4 px-1.5 border-yellow-500/50 text-yellow-400" onClick={() => onClaim(commanderId)} disabled={isClaiming}>
              {isClaiming ? <Loader2 className="w-2 h-2 animate-spin" /> : "Claim"}
            </Button>
          )}
        </>
      ) : null}
    </div>
  );
}

// ── Commander Card (horizontal roster) ───────────────────────────────────────

function CommanderCard({ cmd, isActive, onDeploy, onClaim, isClaiming, walletConnected }: {
  cmd: Player["commanders"][0]; isActive: boolean;
  onDeploy: () => void; onClaim?: (id: string) => void; isClaiming?: boolean; walletConnected?: boolean;
}) {
  const [countdown, setCountdown] = useState(0);
  const companion = COMPANION[cmd.tier as CommanderTier];

  useEffect(() => {
    const update = () => {
      const rem = cmd.lockedUntil ? Math.max(0, cmd.lockedUntil - Date.now()) : 0;
      setCountdown(rem);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [cmd.lockedUntil]);

  const isLocked = countdown > 0;

  return (
    <div className={cn(
      "flex-shrink-0 w-40 rounded-lg border-2 p-2.5 flex flex-col gap-1.5 transition-all cursor-pointer select-none snap-start",
      isActive ? cn("border-2", TIER_BORDER[cmd.tier as CommanderTier]) : "border-border/60 bg-muted/10",
      isLocked && "opacity-70"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-lg">{companion.emoji}</span>
        <div className="flex items-center gap-1">
          {isActive && <Badge className="text-[8px] px-1 py-0 bg-primary/20 text-primary border-primary/30">ACTIVE</Badge>}
          {isLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
        </div>
      </div>

      {/* Commander image + name */}
      <div className="flex items-center gap-2">
        <img src={COMMANDER_IMAGES[cmd.tier as CommanderTier]} alt={cmd.name} className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-display uppercase font-bold leading-tight truncate" style={{ color: TIER_COLORS[cmd.tier as CommanderTier] }}>{cmd.name}</p>
          <p className="text-[9px] text-muted-foreground capitalize">{cmd.tier}</p>
          <p className="text-[9px] text-muted-foreground font-mono">☠ {cmd.totalKills}</p>
        </div>
      </div>

      {/* Companion name */}
      <p className="text-[9px] text-cyan-400/80 font-display uppercase tracking-wide">{companion.name}</p>

      {/* Stats */}
      <div className="flex gap-2 text-[9px]">
        <span className="font-mono">ATK <span className="text-green-400">+{cmd.attackBonus}</span></span>
        <span className="font-mono">DEF <span className="text-blue-400">+{cmd.defenseBonus}</span></span>
      </div>

      {/* NFT status */}
      <CommanderNftStatus commanderId={cmd.id} onClaim={onClaim} isClaiming={isClaiming} walletConnected={walletConnected} />

      {/* Deploy button */}
      {isLocked ? (
        <div className="text-center mt-auto">
          <div className="flex items-center justify-center gap-1 text-[9px] text-destructive/80 font-mono">
            <Clock className="w-2.5 h-2.5" /> {formatCountdown(countdown)}
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant={isActive ? "default" : "outline"}
          onClick={onDeploy}
          className={cn("h-6 text-[9px] font-display uppercase tracking-wide mt-auto w-full", isActive && "bg-primary/20 border-primary/40 text-primary")}
        >
          {isActive ? "Deployed ✓" : "Deploy"}
        </Button>
      )}
    </div>
  );
}

// ── Sub-Parcel Grid Picker ────────────────────────────────────────────────────

function SubParcelGridPicker({ subParcels, selectedIdx, onSelect, currentPlayerId }: {
  subParcels: SubParcel[]; selectedIdx: number | null;
  onSelect: (idx: number, spId: string) => void; currentPlayerId: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }, (_, i) => {
        const sp = subParcels.find(s => s.subIndex === i);
        const isOwn = sp?.ownerId === currentPlayerId;
        const isOther = sp?.ownerId && sp.ownerId !== currentPlayerId;
        const isSelected = selectedIdx === i;
        return (
          <button
            key={i}
            onClick={() => sp && isOther && onSelect(i, sp.id)}
            disabled={!sp || !isOther}
            className={cn(
              "h-9 rounded border text-[9px] font-mono flex flex-col items-center justify-center transition-colors",
              isSelected ? "border-destructive bg-destructive/20 text-destructive" :
              isOther ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:border-destructive hover:bg-destructive/10 cursor-pointer" :
              isOwn ? "border-green-500/30 bg-green-500/5 text-green-400 cursor-not-allowed" :
              "border-border/40 bg-muted/5 text-muted-foreground cursor-not-allowed"
            )}
          >
            <span>{i + 1}</span>
            {sp?.ownerId ? (
              <span className="text-[7px] truncate max-w-full px-0.5">{isOwn ? "yours" : "enemy"}</span>
            ) : (
              <span className="text-[7px] opacity-50">empty</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Battle Result Display ─────────────────────────────────────────────────────

interface BattleResult {
  outcome: "attacker_wins" | "defender_wins";
  attackerPower: number;
  defenderPower: number;
  log: { phase: string; message: string }[];
  commanderTier?: CommanderTier;
}

function BattleResultCard({ result }: { result: BattleResult }) {
  const won = result.outcome === "attacker_wins";
  const companion = result.commanderTier ? COMPANION[result.commanderTier] : null;
  return (
    <div className={cn("rounded-md border p-3 text-xs", won ? "border-green-500/40 bg-green-500/5" : "border-destructive/40 bg-destructive/5")}>
      <div className="flex items-center gap-2 mb-2">
        {won ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-destructive" />}
        <span className="font-display uppercase tracking-wide font-bold">{won ? "Victory" : "Repelled"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <p className="text-[9px] text-muted-foreground uppercase">Your Power</p>
          <p className="font-mono font-bold text-primary">{Math.round(result.attackerPower)}</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground uppercase">Defender</p>
          <p className="font-mono font-bold text-destructive">{Math.round(result.defenderPower)}</p>
        </div>
      </div>
      {companion && (
        <p className="text-[9px] text-muted-foreground italic border-t border-border/30 pt-1.5">
          {companion.emoji} {won ? companion.winMsg : companion.loseMsg}
        </p>
      )}
    </div>
  );
}

// ── Main CommanderPanel ───────────────────────────────────────────────────────

export interface CommanderPanelProps {
  player: Player | null;
  onMintAvatar: (tier: CommanderTier) => void;
  onDeployDrone: (targetParcelId?: string) => void;
  onDeploySatellite: () => void;
  onSwitchCommander?: (index: number) => void;
  onClaimCommanderNft?: (commanderId: string) => void;
  onAttack?: (troops: number, iron: number, fuel: number, crystal: number, commanderId?: string, sourceParcelId?: string) => void;
  isMinting: boolean;
  isDeployingDrone: boolean;
  isDeployingSatellite: boolean;
  isClaimingCommanderNft?: boolean;
  isAttacking?: boolean;
  selectedParcel?: LandParcel | null;
  ownedParcels?: LandParcel[];
  wallet?: { isConnected: boolean; address: string | null };
  className?: string;
}

export function CommanderPanel({
  player, onMintAvatar, onDeployDrone, onDeploySatellite, onSwitchCommander,
  onClaimCommanderNft, onAttack, isMinting, isDeployingDrone, isDeployingSatellite,
  isClaimingCommanderNft, isAttacking, selectedParcel, ownedParcels = [],
  wallet, className,
}: CommanderPanelProps) {
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<CommanderTier>("sentinel");
  const [showMintSection, setShowMintSection] = useState(false);

  // Battlefront state
  const [battlefrontOpen, setBattlefrontOpen] = useState(false);
  const [attackMode, setAttackMode] = useState<"plot" | "sub-parcel">("plot");
  const [targetParcelId, setTargetParcelId] = useState<string>("");
  const [targetPlotId, setTargetPlotId] = useState<string>("");
  const [selectedSubParcelId, setSelectedSubParcelId] = useState<string | null>(null);
  const [selectedSubIdx, setSelectedSubIdx] = useState<number | null>(null);
  const [troops, setTroops] = useState(1);
  const [extraIron, setExtraIron] = useState(0);
  const [extraFuel, setExtraFuel] = useState(0);
  const [extraCrystal, setExtraCrystal] = useState(0);
  const [lastBattleResult, setLastBattleResult] = useState<BattleResult | null>(null);
  const [sourceParcelId, setSourceParcelId] = useState<string | null>(ownedParcels[0]?.id ?? null);

  // Sync target from selected parcel
  useEffect(() => {
    if (selectedParcel) {
      setTargetParcelId(selectedParcel.id);
      setTargetPlotId(String(selectedParcel.plotId));
    }
  }, [selectedParcel?.id]);

  // Sync source parcel
  useEffect(() => {
    if (ownedParcels.length > 0 && !sourceParcelId) setSourceParcelId(ownedParcels[0].id);
  }, [ownedParcels]);

  const { data: selectedTierPrice } = useQuery<{ algoPrice: number; usdPrice: number; adminAddress: string }>({
    queryKey: ["/api/nft/commander-price", selectedTier],
    queryFn: async () => { const r = await fetch(`/api/nft/commander-price/${selectedTier}`); if (!r.ok) throw new Error(); return r.json(); },
    staleTime: 60_000, retry: false,
  });

  // Sub-parcel list for grid picker
  const { data: subParcelsData } = useQuery<{ subParcels: SubParcel[] }>({
    queryKey: ["/api/plots", targetPlotId, "sub-parcels"],
    queryFn: async () => {
      if (!targetPlotId) return { subParcels: [] };
      const r = await fetch(`/api/plots/${targetPlotId}/sub-parcels`);
      if (!r.ok) return { subParcels: [] };
      return r.json();
    },
    enabled: attackMode === "sub-parcel" && !!targetPlotId,
    staleTime: 10_000,
  });

  // Sub-parcel attack mutation
  const subParcelAttackMutation = useMutation({
    mutationFn: async (params: { subParcelId: string; attackerId: string; attackerParcelId: string; commanderId?: string; troops: number; iron: number; fuel: number; crystal: number }) => {
      const r = await fetch(`/api/sub-parcels/${params.subParcelId}/attack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Attack failed"); }
      return r.json();
    },
    onSuccess: (data, variables) => {
      const cmd = player?.commanders?.find(c => c.id === variables.commanderId);
      setLastBattleResult({
        outcome: data.outcome,
        attackerPower: data.attackerPower,
        defenderPower: data.defenderPower,
        log: data.log ?? [],
        commanderTier: cmd?.tier as CommanderTier | undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/plots", targetPlotId, "sub-parcels"] });
    },
  });

  if (!player) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground p-8", className)}>
        <Shield className="w-12 h-12 mb-4 opacity-30" />
        <p className="font-display uppercase tracking-wide text-center">Connect wallet to access Commander</p>
      </div>
    );
  }

  const commanders = player.commanders || [];
  const hasCommander = commanders.length > 0;
  const activeCommander = player.commander;
  const activeDrones = player.drones.filter(d => d.status !== "scouting" || Date.now() - d.deployedAt < DRONE_SCOUT_DURATION_MS + 300000);
  const activeSatellites = (player.satellites ?? []).filter(s => s.status === "active" && s.expiresAt > Date.now());
  const isRealWallet = wallet?.isConnected && !!wallet?.address;
  const selectedInfo = COMMANDER_INFO[selectedTier];

  // Battlefront calc
  const baseCostIron = ATTACK_BASE_COST.iron * troops;
  const baseCostFuel = ATTACK_BASE_COST.fuel * troops;
  const totalIron = baseCostIron + extraIron;
  const totalFuel = baseCostFuel + extraFuel;
  const cmdBonus = activeCommander?.attackBonus ?? 0;
  const attackerPower = troops * 10 + extraIron * 0.5 + extraFuel * 0.8 + extraCrystal * 1.2 + cmdBonus;
  const targetForCalc = selectedParcel?.id === targetParcelId ? selectedParcel : null;
  const defenderPower = targetForCalc ? targetForCalc.defenseLevel * 15 * (biomeBonuses[targetForCalc.biome]?.defenseMod ?? 1) : 0;
  const winChance = defenderPower > 0 ? Math.min(95, Math.max(5, (attackerPower / (attackerPower + defenderPower)) * 100)) : 75;
  const canAfford = player.iron >= totalIron && player.fuel >= totalFuel && player.crystal >= extraCrystal;
  const maxTroops = Math.min(10, Math.floor(player.iron / ATTACK_BASE_COST.iron), Math.floor(player.fuel / ATTACK_BASE_COST.fuel));
  const isOnCooldown = player.attackCooldownUntil && Date.now() < player.attackCooldownUntil;
  const allCommandersLocked = commanders.every(c => c.lockedUntil && Date.now() < c.lockedUntil);

  const handleLaunchPlotAttack = () => {
    if (!onAttack || !targetParcelId) return;
    onAttack(troops, totalIron, totalFuel, extraCrystal, activeCommander?.id, sourceParcelId ?? undefined);
  };

  const handleLaunchSubParcelAttack = () => {
    if (!player || !selectedSubParcelId || !sourceParcelId) return;
    subParcelAttackMutation.mutate({
      subParcelId: selectedSubParcelId,
      attackerId: player.id,
      attackerParcelId: sourceParcelId,
      commanderId: activeCommander?.id,
      troops,
      iron: totalIron,
      fuel: totalFuel,
      crystal: extraCrystal,
    });
  };

  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="commander-panel">
      {/* ── Header ── */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="font-display text-base font-bold uppercase tracking-wide">Commander</h2>
        </div>
        <p className="text-[9px] text-muted-foreground font-mono">
          FRNTR: {player.frontier.toFixed(1)} · Burned: {player.totalFrontierBurned.toFixed(1)} · Avatars: {commanders.length}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">

          {/* ── Commander Roster (horizontal scroll) ── */}
          {hasCommander && (
            <div>
              <h3 className="text-[10px] font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Swords className="w-3 h-3" /> Commander Roster
              </h3>
              <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x scroll-smooth" style={{ scrollbarWidth: "none" }}>
                {commanders.map((cmd, idx) => (
                  <CommanderCard
                    key={cmd.id}
                    cmd={cmd}
                    isActive={activeCommander?.id === cmd.id}
                    onDeploy={() => onSwitchCommander?.(idx)}
                    onClaim={onClaimCommanderNft}
                    isClaiming={isClaimingCommanderNft}
                    walletConnected={isRealWallet}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Mint Section ── */}
          {(!hasCommander || showMintSection) && (
            <div data-testid="mint-section">
              <h3 className="text-[10px] font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Swords className="w-3 h-3" /> {hasCommander ? "Mint Another" : "Mint Your First Commander"}
              </h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(Object.entries(COMMANDER_INFO) as [CommanderTier, (typeof COMMANDER_INFO)[CommanderTier]][]).map(([tier, info]) => {
                  const isSelected = selectedTier === tier;
                  const comp = COMPANION[tier];
                  return (
                    <button
                      key={tier}
                      onClick={() => setSelectedTier(tier)}
                      className={cn("p-2 rounded-md border text-center transition-colors", isSelected ? "border-primary bg-primary/10" : "border-border hover-elevate")}
                    >
                      <div className="text-xl mb-0.5">{comp.emoji}</div>
                      <img src={COMMANDER_IMAGES[tier]} alt={info.name} className="w-12 h-12 mx-auto rounded-md object-cover mb-1" />
                      <span className="text-[9px] font-display uppercase font-bold block" style={{ color: TIER_COLORS[tier] }}>{info.name}</span>
                      <span className={cn("text-[9px] font-mono block", player.frontier >= info.mintCostFrontier ? "text-muted-foreground" : "text-destructive")}>{info.mintCostFrontier} FRNTR</span>
                    </button>
                  );
                })}
              </div>
              <Card className="p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{COMPANION[selectedTier].emoji}</span>
                  <img src={COMMANDER_IMAGES[selectedTier]} alt={selectedInfo.name} className="w-9 h-9 rounded-md object-cover" />
                  <div>
                    <span className="text-sm font-display uppercase font-bold block" style={{ color: TIER_COLORS[selectedTier] }}>{selectedInfo.name}</span>
                    <span className="text-[10px] text-muted-foreground">{COMPANION[selectedTier].name} · {selectedInfo.specialAbility}</span>
                  </div>
                </div>
                <p className="text-[9px] text-cyan-400/80 italic mb-2">{COMPANION[selectedTier].flavor}</p>
                {isRealWallet && selectedTierPrice && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-cyan-500/5 border border-cyan-500/20 mb-2">
                    <Gift className="w-3 h-3 text-cyan-400" />
                    <p className="text-[9px] text-cyan-300">NFT incl. — {selectedTierPrice.algoPrice.toFixed(3)} ALGO (~${selectedTierPrice.usdPrice.toFixed(2)})</p>
                  </div>
                )}
                <Button onClick={() => onMintAvatar(selectedTier)} disabled={isMinting || player.frontier < selectedInfo.mintCostFrontier} className="w-full font-display uppercase tracking-wide text-xs" data-testid="button-mint-avatar">
                  <Zap className="w-3.5 h-3.5 mr-2" />
                  {isMinting ? "Minting…" : isRealWallet && selectedTierPrice ? `Mint · ${selectedInfo.mintCostFrontier} FRNTR + ${selectedTierPrice.algoPrice.toFixed(3)} ALGO` : `Mint for ${selectedInfo.mintCostFrontier} FRNTR`}
                </Button>
              </Card>
            </div>
          )}
          {hasCommander && (
            <Button variant="outline" size="sm" onClick={() => setShowMintSection(!showMintSection)} className="w-full font-display uppercase tracking-wide text-xs" data-testid="button-toggle-mint">
              <Zap className="w-3 h-3 mr-1.5" />{showMintSection ? "Hide Mint" : "Mint Another Commander"}
            </Button>
          )}

          {/* ── Battlefront ── */}
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setBattlefrontOpen(!battlefrontOpen)}
              className="w-full flex items-center justify-between p-3 bg-destructive/5 hover:bg-destructive/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-destructive" />
                <span className="font-display uppercase tracking-wide text-sm font-bold text-destructive">Battlefront</span>
              </div>
              {battlefrontOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {battlefrontOpen && (
              <div className="p-3 space-y-3">
                {/* Attack mode toggle */}
                <div className="flex rounded-md border border-border overflow-hidden text-[10px] font-display uppercase">
                  <button
                    onClick={() => setAttackMode("plot")}
                    className={cn("flex-1 py-1.5 transition-colors", attackMode === "plot" ? "bg-destructive/20 text-destructive" : "text-muted-foreground hover:bg-muted/30")}
                  >Plot Attack</button>
                  <button
                    onClick={() => setAttackMode("sub-parcel")}
                    className={cn("flex-1 py-1.5 transition-colors border-l border-border", attackMode === "sub-parcel" ? "bg-orange-500/20 text-orange-400" : "text-muted-foreground hover:bg-muted/30")}
                  >Sub-Parcel</button>
                </div>

                {/* Target input */}
                <div className="space-y-1">
                  <p className="text-[10px] font-display uppercase text-muted-foreground">Target</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={attackMode === "plot" ? targetParcelId : targetPlotId}
                      onChange={e => attackMode === "plot" ? setTargetParcelId(e.target.value) : setTargetPlotId(e.target.value)}
                      placeholder={attackMode === "plot" ? "Parcel ID…" : "Plot #…"}
                      className="flex-1 bg-muted/30 border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary"
                    />
                    {selectedParcel && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[9px]" onClick={() => { setTargetParcelId(selectedParcel.id); setTargetPlotId(String(selectedParcel.plotId)); }}>
                        <MapPin className="w-3 h-3 mr-1" />Use Selected
                      </Button>
                    )}
                  </div>
                  {targetForCalc && (
                    <p className="text-[9px] text-muted-foreground font-mono">Plot #{targetForCalc.plotId} · {targetForCalc.biome} · Def {targetForCalc.defenseLevel}</p>
                  )}
                </div>

                {/* Sub-parcel grid picker */}
                {attackMode === "sub-parcel" && targetPlotId && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-display uppercase text-muted-foreground">Pick Sub-Parcel (orange = enemy)</p>
                    {subParcelsData?.subParcels?.length ? (
                      <SubParcelGridPicker
                        subParcels={subParcelsData.subParcels}
                        selectedIdx={selectedSubIdx}
                        onSelect={(idx, id) => { setSelectedSubIdx(idx); setSelectedSubParcelId(id); }}
                        currentPlayerId={player.id}
                      />
                    ) : (
                      <p className="text-[9px] text-muted-foreground">No sub-parcels found for this plot.</p>
                    )}
                    {selectedSubIdx !== null && (
                      <p className="text-[9px] text-orange-400 font-mono">Selected: Cell #{selectedSubIdx + 1}</p>
                    )}
                  </div>
                )}

                {/* Source parcel */}
                {ownedParcels.length > 1 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-display uppercase text-muted-foreground">Launch From</p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {ownedParcels.slice(0, 6).map(p => (
                        <button key={p.id} onClick={() => setSourceParcelId(p.id)} className={cn(
                          "flex-shrink-0 w-14 h-12 rounded border flex flex-col items-center justify-center text-[8px] font-mono gap-0.5 transition-colors",
                          sourceParcelId === p.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/10 hover:border-muted-foreground text-muted-foreground"
                        )}>
                          <MapPin className="w-2.5 h-2.5" />
                          <span>#{p.plotId}</span>
                          <span className="capitalize text-[7px]">{p.biome}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active commander display */}
                {activeCommander && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/40">
                    <span className="text-base">{COMPANION[activeCommander.tier as CommanderTier]?.emoji}</span>
                    <div className="text-[9px]">
                      <p className="font-display uppercase font-bold" style={{ color: TIER_COLORS[activeCommander.tier as CommanderTier] }}>{activeCommander.name}</p>
                      <p className="text-muted-foreground">+{activeCommander.attackBonus} ATK · {COMPANION[activeCommander.tier as CommanderTier]?.name}</p>
                    </div>
                    <ChevronsRight className="w-3 h-3 text-muted-foreground ml-auto" />
                  </div>
                )}

                {/* Resources */}
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-display uppercase text-muted-foreground">Troops</span>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => setTroops(Math.max(1, troops - 1))} disabled={troops <= 1}><ChevronDown className="w-2.5 h-2.5" /></Button>
                        <span className="font-mono text-sm w-5 text-center">{troops}</span>
                        <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => setTroops(Math.min(maxTroops, troops + 1))} disabled={troops >= maxTroops}><ChevronUp className="w-2.5 h-2.5" /></Button>
                      </div>
                    </div>
                    <Slider value={[troops]} onValueChange={([v]) => setTroops(v)} min={1} max={Math.max(1, maxTroops)} step={1} className="w-full" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-display uppercase flex items-center gap-1 text-muted-foreground"><Pickaxe className="w-2.5 h-2.5 text-iron" /> Extra Iron</span>
                      <span className="font-mono text-[10px]">{extraIron}</span>
                    </div>
                    <Slider value={[extraIron]} onValueChange={([v]) => setExtraIron(v)} min={0} max={Math.max(0, player.iron - baseCostIron)} step={10} className="w-full" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-display uppercase flex items-center gap-1 text-muted-foreground"><Fuel className="w-2.5 h-2.5 text-fuel" /> Extra Fuel</span>
                      <span className="font-mono text-[10px]">{extraFuel}</span>
                    </div>
                    <Slider value={[extraFuel]} onValueChange={([v]) => setExtraFuel(v)} min={0} max={Math.max(0, player.fuel - baseCostFuel)} step={10} className="w-full" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-display uppercase flex items-center gap-1 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Crystal</span>
                      <span className="font-mono text-[10px] text-cyan-400">{extraCrystal}</span>
                    </div>
                    <Slider value={[extraCrystal]} onValueChange={([v]) => setExtraCrystal(v)} min={0} max={Math.max(0, player.crystal)} step={1} className="w-full" />
                  </div>
                </div>

                {/* Power display */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-card border border-border rounded-md">
                  <div><p className="text-[9px] text-muted-foreground uppercase font-display">Your Power</p><p className="font-mono text-lg font-bold text-primary">{Math.round(attackerPower)}</p></div>
                  <div><p className="text-[9px] text-muted-foreground uppercase font-display">Defender</p><p className="font-mono text-lg font-bold text-destructive">{defenderPower > 0 ? Math.round(defenderPower) : "?"}</p></div>
                </div>
                {defenderPower > 0 && (
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-muted-foreground font-display uppercase">Win Chance</span>
                    <Badge variant={winChance > 60 ? "default" : winChance > 40 ? "secondary" : "destructive"} className="font-mono">{Math.round(winChance)}%</Badge>
                  </div>
                )}

                {/* Warnings */}
                {(!canAfford || !hasCommander || allCommandersLocked || isOnCooldown) && (
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md space-y-1 text-[9px] text-yellow-400">
                    {!canAfford && <p className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Insufficient resources</p>}
                    {!hasCommander && <p className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Mint a Commander to attack</p>}
                    {allCommandersLocked && hasCommander && <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> All commanders on cooldown</p>}
                    {isOnCooldown && <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> Attack cooldown active</p>}
                  </div>
                )}

                {/* Launch button */}
                {attackMode === "plot" ? (
                  <Button
                    variant="destructive"
                    className="w-full font-display uppercase tracking-wide"
                    onClick={handleLaunchPlotAttack}
                    disabled={!canAfford || !hasCommander || allCommandersLocked || !!isOnCooldown || isAttacking || !targetParcelId}
                  >
                    <Swords className="w-4 h-4 mr-2" />
                    {isAttacking ? "Deploying…" : "Launch Plot Attack"}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    className="w-full font-display uppercase tracking-wide bg-orange-600 hover:bg-orange-700 border-orange-500"
                    onClick={handleLaunchSubParcelAttack}
                    disabled={!canAfford || !hasCommander || allCommandersLocked || !selectedSubParcelId || subParcelAttackMutation.isPending}
                  >
                    <Target className="w-4 h-4 mr-2" />
                    {subParcelAttackMutation.isPending ? "Attacking…" : "Launch Sub-Parcel Strike"}
                  </Button>
                )}

                {/* Sub-parcel attack error */}
                {subParcelAttackMutation.isError && (
                  <p className="text-[9px] text-destructive">{(subParcelAttackMutation.error as Error)?.message}</p>
                )}

                {/* Battle result */}
                {lastBattleResult && <BattleResultCard result={lastBattleResult} />}
              </div>
            )}
          </div>

          {/* ── Special Attacks ── */}
          {activeCommander && (
            <div>
              <h3 className="text-[10px] font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Target className="w-3 h-3" /> Special Attacks
              </h3>
              <p className="text-[9px] text-muted-foreground mb-2">Select a target plot on the map, then use a special attack from LandSheet</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(SPECIAL_ATTACK_INFO) as [SpecialAttackType, (typeof SPECIAL_ATTACK_INFO)[SpecialAttackType]][]).map(([type, info]) => {
                  const Icon = ATTACK_ICONS[type];
                  const isAvailable = info.requiredTier.includes(activeCommander.tier);
                  const record = player.specialAttacks.find(sa => sa.type === type);
                  const isOnCooldownSA = record ? (Date.now() - record.lastUsedTs) < info.cooldownMs : false;
                  const cooldownRemaining = record ? Math.max(0, info.cooldownMs - (Date.now() - record.lastUsedTs)) : 0;
                  return (
                    <div key={type} className={cn("p-2 rounded-md border text-left", !isAvailable ? "border-border opacity-40" : isOnCooldownSA ? "border-warning/40" : "border-border")}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Icon className="w-3 h-3" style={{ color: isAvailable ? TIER_COLORS[activeCommander.tier] : undefined }} />
                        <span className="text-[9px] font-display uppercase font-bold">{info.name}</span>
                      </div>
                      <span className="text-[8px] text-muted-foreground block">{info.effect}</span>
                      <div className="flex items-center gap-2 mt-1 text-[8px] font-mono">
                        <span>{info.costFrontier} FRNTR</span>
                        {isOnCooldownSA && <span className="text-warning flex items-center gap-0.5"><Clock className="w-2 h-2" />{formatCountdown(cooldownRemaining)}</span>}
                      </div>
                      {!isAvailable && <span className="text-[8px] text-destructive">Req. {info.requiredTier.join("/")}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Recon Drones ── */}
          <div data-testid="drone-section">
            <h3 className="text-[10px] font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Radar className="w-3 h-3" /> Recon Drones ({activeDrones.length}/{MAX_DRONES})
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <img src={droneImg} alt="Recon Drone" className="w-9 h-9 rounded-md object-cover" />
              <span className="text-[9px] text-muted-foreground flex-1">Scout enemy territory. {DRONE_MINT_COST_FRONTIER} FRNTR each.</span>
              <Button size="sm" onClick={() => onDeployDrone()} disabled={isDeployingDrone || activeDrones.length >= MAX_DRONES || player.frontier < DRONE_MINT_COST_FRONTIER} className="font-display uppercase text-xs shrink-0" data-testid="button-deploy-drone">
                <Radio className="w-3 h-3 mr-1" />{isDeployingDrone ? "…" : "Deploy"}
              </Button>
            </div>
            {activeDrones.length > 0 ? (
              <div className="space-y-2">{activeDrones.map((d, i) => <DroneCard key={d.id} drone={d} index={i} />)}</div>
            ) : (
              <div className="text-center py-3 text-muted-foreground"><Radar className="w-5 h-5 mx-auto mb-1 opacity-30" /><p className="text-[9px]">No drones deployed</p></div>
            )}
          </div>

          {/* ── Orbital Satellites ── */}
          <div data-testid="satellite-section">
            <h3 className="text-[10px] font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Satellite className="w-3 h-3" /> Orbital Satellites ({activeSatellites.length}/{MAX_SATELLITES})
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-md bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center shrink-0">
                <Satellite className="w-4 h-4 text-yellow-400" />
              </div>
              <span className="text-[9px] text-muted-foreground flex-1">+{SATELLITE_YIELD_BONUS * 100}% yield · 1h · {SATELLITE_DEPLOY_COST_FRONTIER} FRNTR</span>
              <Button size="sm" onClick={() => onDeploySatellite()} disabled={isDeployingSatellite || activeSatellites.length >= MAX_SATELLITES || player.frontier < SATELLITE_DEPLOY_COST_FRONTIER} className="font-display uppercase text-xs shrink-0" data-testid="button-deploy-satellite">
                <Satellite className="w-3 h-3 mr-1" />{isDeployingSatellite ? "…" : "Launch"}
              </Button>
            </div>
            {activeSatellites.length > 0 ? (
              <div className="space-y-2">{activeSatellites.map((s, i) => <SatelliteCard key={s.id} satellite={s} index={i} />)}</div>
            ) : (
              <div className="text-center py-3 text-muted-foreground"><Satellite className="w-5 h-5 mx-auto mb-1 opacity-30" /><p className="text-[9px]">No satellites in orbit</p></div>
            )}
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}
