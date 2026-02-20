import { useState } from "react";
import { Shield, Swords, Zap, Target, Radio, Crosshair, Skull, Radar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Player, CommanderTier, SpecialAttackType } from "@shared/schema";
import { COMMANDER_INFO, SPECIAL_ATTACK_INFO, DRONE_MINT_COST_FRONTIER, MAX_DRONES, DRONE_SCOUT_DURATION_MS } from "@shared/schema";
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
  onSwitchCommander?: (index: number) => void;
  isMinting: boolean;
  isDeployingDrone: boolean;
  className?: string;
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

export function CommanderPanel({ player, onMintAvatar, onDeployDrone, onSwitchCommander, isMinting, isDeployingDrone, className }: CommanderPanelProps) {
  const [selectedTier, setSelectedTier] = useState<CommanderTier>("sentinel");
  const [showMintSection, setShowMintSection] = useState(false);

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
                    </button>
                  );
                })}
              </div>

              {selectedTier && (
                <Card className="p-3 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <img
                      src={COMMANDER_IMAGES[selectedTier]}
                      alt={COMMANDER_INFO[selectedTier].name}
                      className="w-10 h-10 rounded-md object-cover"
                    />
                    <div>
                      <span className="text-sm font-display uppercase font-bold block" style={{ color: TIER_COLORS[selectedTier] }}>
                        {COMMANDER_INFO[selectedTier].name}
                      </span>
                      <span className="text-[10px] text-muted-foreground capitalize">{selectedTier} class</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                    <div className="p-1.5 rounded-md bg-muted/50">
                      <span className="text-muted-foreground font-display uppercase block">ATK Bonus</span>
                      <span className="font-mono font-bold">+{COMMANDER_INFO[selectedTier].baseAttackBonus}</span>
                    </div>
                    <div className="p-1.5 rounded-md bg-muted/50">
                      <span className="text-muted-foreground font-display uppercase block">DEF Bonus</span>
                      <span className="font-mono font-bold">+{COMMANDER_INFO[selectedTier].baseDefenseBonus}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    <span className="font-display uppercase tracking-wide">Ability:</span>{" "}
                    {COMMANDER_INFO[selectedTier].specialAbility}
                  </p>
                  <Button
                    onClick={() => onMintAvatar(selectedTier)}
                    disabled={isMinting || player.frontier < COMMANDER_INFO[selectedTier].mintCostFrontier}
                    className="w-full font-display uppercase tracking-wide"
                    data-testid="button-mint-avatar"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {isMinting ? "Minting..." : `Mint for ${COMMANDER_INFO[selectedTier].mintCostFrontier} FRNTR`}
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
        </div>
      </ScrollArea>
    </div>
  );
}
