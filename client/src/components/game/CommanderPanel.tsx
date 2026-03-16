import { useState } from "react";
import { Shield, Swords, Zap, Target, Radio, Crosshair, Skull, Radar, Clock, Satellite, Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Player, CommanderTier, SpecialAttackType } from "@shared/schema";
import { COMMANDER_INFO, SPECIAL_ATTACK_INFO, DRONE_MINT_COST_FRONTIER, MAX_DRONES, DRONE_SCOUT_DURATION_MS, SATELLITE_DEPLOY_COST_FRONTIER, MAX_SATELLITES, SATELLITE_ORBIT_DURATION_MS, SATELLITE_YIELD_BONUS } from "@shared/schema";
import sentinelImg from "@assets/image_1771570491560.png";
import phantomImg from "@assets/image_1771570495782.png";
import reaperImg from "@assets/image_1771570500912.png";
import droneImg from "@assets/image_1771570514563.png";

const COMMANDER_IMAGES: Record<CommanderTier, string> = {
  sentinel: sentinelImg,
  phantom: phantomImg,
  reaper: reaperImg,
};

const TIER_COLORS: Record<CommanderTier, string> = {
  sentinel: "#3b82f6",
  phantom: "#a855f7",
  reaper: "#f97316",
};

const ATTACK_ICONS: Record<SpecialAttackType, React.ElementType> = {
  orbital_strike: Target,
  emp_blast: Zap,
  siege_barrage: Crosshair,
  sabotage: Skull,
};

interface CommanderPanelProps {
  player: Player | null;
  onMintAvatar: (tier: CommanderTier) => void;
  onDeployDrone: (targetParcelId?: string) => void;
  onDeploySatellite: () => void;
  onSwitchCommander?: (index: number) => void;
  onClaimCommanderNft?: (commanderId: string) => void;
  isMinting: boolean;
  isDeployingDrone: boolean;
  isDeployingSatellite: boolean;
  isClaimingCommanderNft?: boolean;
  wallet?: { isConnected: boolean; address: string | null };
  className?: string;
}

function SatelliteCard({ satellite, index }: { satellite: Player["satellites"][0]; index: number }) {
  const now = Date.now();
  const remaining = Math.max(0, satellite.expiresAt - now);
  const elapsed = now - satellite.deployedAt;
  const progressPct = satellite.status === "active" ? Math.min(100, (elapsed / SATELLITE_ORBIT_DURATION_MS) * 100) : 100;

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const isExpired = satellite.status === "expired" || remaining === 0;

  return (
    <Card className={cn("p-2 border text-xs", isExpired ? "border-muted opacity-60" : "border-yellow-500/50 bg-yellow-500/5")}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-display uppercase tracking-wide text-[10px]">
          SAT-{String(index + 1).padStart(2, "0")}
        </span>
        <Badge variant={isExpired ? "secondary" : "default"} className="text-[9px] px-1 py-0">
          {isExpired ? "expired" : "orbiting"}
        </Badge>
      </div>
      {!isExpired && (
        <>
          <div className="w-full bg-muted rounded-full h-1 mb-1">
            <div
              className="h-1 rounded-full bg-yellow-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-2.5 h-2.5" />
            <span>{formatTime(remaining)} remaining</span>
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

  const formatTime = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-2.5 border border-border rounded-md" data-testid={`drone-card-${index}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <img src={droneImg} alt="Recon Drone" className="w-8 h-8 rounded-md object-cover" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-display uppercase tracking-wide block">Drone #{index + 1}</span>
          <Badge
            variant={isExpired || drone.status === "returned" ? "secondary" : "outline"}
            className="text-[9px]"
          >
            {isExpired ? "Report Ready" : drone.status === "scouting" ? `Scouting ${formatTime(remaining)}` : drone.status}
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

function CommanderNftStatus({
  commanderId,
  onClaim,
  isClaiming,
  walletConnected,
}: {
  commanderId: string;
  onClaim?: (commanderId: string) => void;
  isClaiming?: boolean;
  walletConnected?: boolean;
}) {
  const { data, isLoading } = useQuery<{
    exists: boolean;
    status?: string;
    assetId?: number;
    txId?: string;
    tier?: string;
  }>({
    queryKey: ["/api/nft/commander", commanderId],
    queryFn: async () => {
      const res = await fetch(`/api/nft/commander/${commanderId}`);
      if (!res.ok) return { exists: false };
      return res.json();
    },
    staleTime: 30_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1.5">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        <span>Checking NFT…</span>
      </div>
    );
  }

  if (!data?.exists) return null;

  const inCustody = data.status === "minted" || data.status === "pending";
  const delivered = data.status === "delivered";

  return (
    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
      {delivered ? (
        <Badge className="text-[8px] bg-green-500/20 text-green-400 border-green-500/30 gap-1">
          <Gift className="w-2.5 h-2.5" /> NFT In Wallet
        </Badge>
      ) : inCustody ? (
        <>
          <Badge variant="outline" className="text-[8px] text-yellow-400 border-yellow-500/30 gap-1">
            <Gift className="w-2.5 h-2.5" /> NFT Ready — ASA {data.assetId}
          </Badge>
          {walletConnected && onClaim && (
            <Button
              size="sm"
              variant="outline"
              className="text-[9px] h-5 px-2 font-display uppercase tracking-wide border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
              onClick={() => onClaim(commanderId)}
              disabled={isClaiming}
            >
              {isClaiming ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Claim NFT"}
            </Button>
          )}
        </>
      ) : null}
    </div>
  );
}

function TierPriceTag({ tier }: { tier: CommanderTier }) {
  const { data } = useQuery<{ algoPrice: number; usdPrice: number }>({
    queryKey: ["/api/nft/commander-price", tier],
    queryFn: async () => {
      const res = await fetch(`/api/nft/commander-price/${tier}`);
      if (!res.ok) throw new Error("price unavailable");
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  if (!data) return null;

  return (
    <span className="text-[8px] font-mono text-cyan-400 block mt-0.5">
      {data.algoPrice.toFixed(3)} ALGO
    </span>
  );
}

export function CommanderPanel({
  player,
  onMintAvatar,
  onDeployDrone,
  onDeploySatellite,
  onSwitchCommander,
  onClaimCommanderNft,
  isMinting,
  isDeployingDrone,
  isDeployingSatellite,
  isClaimingCommanderNft,
  wallet,
  className,
}: CommanderPanelProps) {
  const [selectedTier, setSelectedTier] = useState<CommanderTier>("sentinel");
  const [showMintSection, setShowMintSection] = useState(false);

  const { data: selectedTierPrice } = useQuery<{ algoPrice: number; usdPrice: number; adminAddress: string }>({
    queryKey: ["/api/nft/commander-price", selectedTier],
    queryFn: async () => {
      const res = await fetch(`/api/nft/commander-price/${selectedTier}`);
      if (!res.ok) throw new Error("price unavailable");
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  if (!player) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground p-8", className)}>
        <Shield className="w-12 h-12 mb-4 opacity-30" />
        <p className="font-display uppercase tracking-wide">Connect wallet to access Commander</p>
      </div>
    );
  }

  const commanders = player.commanders || [];
  const hasCommander = commanders.length > 0;
  const activeCommander = player.commander;
  const activeDrones = player.drones.filter(d => {
    if (d.status !== "scouting") return true;
    return Date.now() - d.deployedAt < DRONE_SCOUT_DURATION_MS + 300000;
  });
  const now = Date.now();
  const activeSatellites = (player.satellites ?? []).filter(s => s.status === "active" && s.expiresAt > now);
  const isRealWallet = wallet?.isConnected && !!wallet?.address;
  const selectedInfo = COMMANDER_INFO[selectedTier];

  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="commander-panel">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">Commander</h2>
        </div>
        <p className="text-[10px] text-muted-foreground font-display uppercase tracking-wide">
          FRONTIER Burned: {player.totalFrontierBurned.toFixed(1)} | Balance: {player.frontier.toFixed(1)} | Avatars: {commanders.length}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {hasCommander && (
            <div data-testid="commander-info">
              <h3 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" /> Your Commanders ({commanders.length})
              </h3>

              {commanders.map((cmd, idx) => {
                const isActive = activeCommander?.id === cmd.id;
                return (
                  <Card key={cmd.id} className={cn("p-3 mb-2", isActive && "border-primary")} data-testid={`commander-card-${idx}`}>
                    <div className="flex items-center gap-3">
                      <img
                        src={COMMANDER_IMAGES[cmd.tier]}
                        alt={cmd.name}
                        className="w-14 h-14 rounded-md object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-display uppercase font-bold" style={{ color: TIER_COLORS[cmd.tier] }}>
                            {cmd.name}
                          </span>
                          {isActive && <Badge className="text-[8px] bg-primary/20 text-primary">ACTIVE</Badge>}
                        </div>
                        <Badge variant="outline" className="text-[9px] capitalize mb-1">{cmd.tier}</Badge>
                        <div className="grid grid-cols-3 gap-1 mt-1">
                          <div className="text-[10px]">
                            <span className="text-muted-foreground font-display uppercase">ATK</span>{" "}
                            <span className="font-mono font-bold">+{cmd.attackBonus}</span>
                          </div>
                          <div className="text-[10px]">
                            <span className="text-muted-foreground font-display uppercase">DEF</span>{" "}
                            <span className="font-mono font-bold">+{cmd.defenseBonus}</span>
                          </div>
                          <div className="text-[10px]">
                            <span className="text-muted-foreground font-display uppercase">Kills</span>{" "}
                            <span className="font-mono font-bold">{cmd.totalKills}</span>
                          </div>
                        </div>
                        <CommanderNftStatus
                          commanderId={cmd.id}
                          onClaim={onClaimCommanderNft}
                          isClaiming={isClaimingCommanderNft}
                          walletConnected={isRealWallet}
                        />
                      </div>
                      {!isActive && onSwitchCommander && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSwitchCommander(idx)}
                          className="text-[10px] font-display uppercase shrink-0"
                          data-testid={`button-switch-commander-${idx}`}
                        >
                          Set Active
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMintSection(!showMintSection)}
                className="w-full font-display uppercase tracking-wide text-xs mt-2"
                data-testid="button-toggle-mint"
              >
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                {showMintSection ? "Hide Mint" : "Mint Another Commander"}
              </Button>
            </div>
          )}

          {(!hasCommander || showMintSection) && (
            <div data-testid="mint-section">
              <h3 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" /> {hasCommander ? "Mint Another" : "Mint Your First Commander"}
              </h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(Object.entries(COMMANDER_INFO) as [CommanderTier, typeof COMMANDER_INFO[CommanderTier]][]).map(([tier, info]) => {
                  const isSelected = selectedTier === tier;
                  const canAfford = player.frontier >= info.mintCostFrontier;
                  return (
                    <button
                      key={tier}
                      onClick={() => setSelectedTier(tier)}
                      className={cn(
                        "p-2 rounded-md border text-center transition-colors",
                        isSelected ? "border-primary bg-primary/10" : "border-border hover-elevate"
                      )}
                      data-testid={`select-tier-${tier}`}
                    >
                      <img
                        src={COMMANDER_IMAGES[tier]}
                        alt={info.name}
                        className="w-14 h-14 mx-auto rounded-md object-cover mb-1.5"
                      />
                      <span className="text-[10px] font-display uppercase tracking-wide block font-bold" style={{ color: TIER_COLORS[tier] }}>
                        {info.name}
                      </span>
                      <span className={cn("text-[9px] font-mono block", canAfford ? "text-muted-foreground" : "text-destructive")}>
                        {info.mintCostFrontier} FRNTR
                      </span>
                      <TierPriceTag tier={tier} />
                    </button>
                  );
                })}
              </div>

              {selectedTier && (
                <Card className="p-3 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <img
                      src={COMMANDER_IMAGES[selectedTier]}
                      alt={selectedInfo.name}
                      className="w-10 h-10 rounded-md object-cover"
                    />
                    <div>
                      <span className="text-sm font-display uppercase font-bold block" style={{ color: TIER_COLORS[selectedTier] }}>
                        {selectedInfo.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground capitalize">{selectedTier} class</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                    <div className="p-1.5 rounded-md bg-muted/50">
                      <span className="text-muted-foreground font-display uppercase block">ATK Bonus</span>
                      <span className="font-mono font-bold">+{selectedInfo.baseAttackBonus}</span>
                    </div>
                    <div className="p-1.5 rounded-md bg-muted/50">
                      <span className="text-muted-foreground font-display uppercase block">DEF Bonus</span>
                      <span className="font-mono font-bold">+{selectedInfo.baseDefenseBonus}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    <span className="font-display uppercase tracking-wide">Ability:</span>{" "}
                    {selectedInfo.specialAbility}
                  </p>

                  {isRealWallet && selectedTierPrice && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-cyan-500/5 border border-cyan-500/20 mb-2">
                      <Gift className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-cyan-300 font-display uppercase tracking-wide">Commander NFT included</p>
                        <p className="text-[9px] text-muted-foreground">
                          Pay <span className="text-cyan-400 font-mono font-bold">{selectedTierPrice.algoPrice.toFixed(3)} ALGO</span>
                          {" "}(~${selectedTierPrice.usdPrice.toFixed(2)}) to mint a Blockchain NFT
                        </p>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => onMintAvatar(selectedTier)}
                    disabled={isMinting || player.frontier < selectedInfo.mintCostFrontier}
                    className="w-full font-display uppercase tracking-wide"
                    data-testid="button-mint-avatar"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {isMinting
                      ? "Minting…"
                      : isRealWallet && selectedTierPrice
                      ? `Mint · ${selectedInfo.mintCostFrontier} FRNTR + ${selectedTierPrice.algoPrice.toFixed(3)} ALGO`
                      : `Mint for ${selectedInfo.mintCostFrontier} FRNTR`}
                  </Button>
                </Card>
              )}
            </div>
          )}

          {activeCommander && (
            <div>
              <h3 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Special Attacks
              </h3>
              <p className="text-[10px] text-muted-foreground mb-2">Select a target plot on the map, then use a special attack from LandSheet</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(Object.entries(SPECIAL_ATTACK_INFO) as [SpecialAttackType, typeof SPECIAL_ATTACK_INFO[SpecialAttackType]][]).map(([type, info]) => {
                  const Icon = ATTACK_ICONS[type];
                  const isAvailable = info.requiredTier.includes(activeCommander.tier);
                  const record = player.specialAttacks.find(sa => sa.type === type);
                  const isOnCooldown = record ? (Date.now() - record.lastUsedTs) < info.cooldownMs : false;
                  const cooldownRemaining = record ? Math.max(0, info.cooldownMs - (Date.now() - record.lastUsedTs)) : 0;
                  const cooldownMin = Math.ceil(cooldownRemaining / 60000);

                  return (
                    <div
                      key={type}
                      className={cn(
                        "p-2.5 rounded-md border text-left",
                        !isAvailable ? "border-border opacity-40" : isOnCooldown ? "border-warning/40" : "border-border"
                      )}
                      data-testid={`attack-info-${type}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="w-3.5 h-3.5" style={{ color: isAvailable ? TIER_COLORS[activeCommander.tier] : undefined }} />
                        <span className="text-[10px] font-display uppercase tracking-wide font-bold">{info.name}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground block">{info.effect}</span>
                      <div className="flex items-center gap-2 mt-1 text-[9px] font-mono">
                        <span>{info.costFrontier} FRNTR</span>
                        {isOnCooldown && (
                          <span className="flex items-center gap-0.5 text-warning">
                            <Clock className="w-2.5 h-2.5" /> {cooldownMin}m
                          </span>
                        )}
                      </div>
                      {!isAvailable && (
                        <span className="text-[9px] text-destructive block mt-0.5">
                          Requires {info.requiredTier.join("/")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div data-testid="drone-section">
            <h3 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Radar className="w-3.5 h-3.5" /> Recon Drones ({activeDrones.length}/{MAX_DRONES})
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <img src={droneImg} alt="Recon Drone" className="w-10 h-10 rounded-md object-cover" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-muted-foreground block">
                  Deploy drones to scout enemy territory. Cost: {DRONE_MINT_COST_FRONTIER} FRNTR each.
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => onDeployDrone()}
                disabled={isDeployingDrone || activeDrones.length >= MAX_DRONES || player.frontier < DRONE_MINT_COST_FRONTIER}
                className="font-display uppercase tracking-wide text-xs shrink-0"
                data-testid="button-deploy-drone"
              >
                <Radio className="w-3.5 h-3.5 mr-1" />
                {isDeployingDrone ? "..." : "Deploy"}
              </Button>
            </div>
            {activeDrones.length > 0 ? (
              <div className="space-y-2">
                {activeDrones.map((drone, i) => (
                  <DroneCard key={drone.id} drone={drone} index={i} />
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Radar className="w-6 h-6 mx-auto mb-1 opacity-30" />
                <p className="text-[10px]">No drones deployed</p>
              </div>
            )}
          </div>

          <div data-testid="satellite-section">
            <h3 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Satellite className="w-3.5 h-3.5" /> Orbital Satellites ({activeSatellites.length}/{MAX_SATELLITES})
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-md bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center shrink-0">
                <Satellite className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-muted-foreground block">
                  +{SATELLITE_YIELD_BONUS * 100}% mining yield on all owned plots for 1 hour. Cost: {SATELLITE_DEPLOY_COST_FRONTIER} FRNTR.
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => onDeploySatellite()}
                disabled={isDeployingSatellite || activeSatellites.length >= MAX_SATELLITES || player.frontier < SATELLITE_DEPLOY_COST_FRONTIER}
                className="font-display uppercase tracking-wide text-xs shrink-0"
                data-testid="button-deploy-satellite"
              >
                <Satellite className="w-3.5 h-3.5 mr-1" />
                {isDeployingSatellite ? "..." : "Launch"}
              </Button>
            </div>
            {activeSatellites.length > 0 ? (
              <div className="space-y-2">
                {activeSatellites.map((sat, i) => (
                  <SatelliteCard key={sat.id} satellite={sat} index={i} />
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Satellite className="w-6 h-6 mx-auto mb-1 opacity-30" />
                <p className="text-[10px]">No satellites in orbit</p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
