/**
 * SelectedPlotPanel — unified plot action surface.
 *
 * Renders the correct variant based on device:
 *  - Mobile  → MobilePlotSheet (slides above BottomNav)
 *  - Desktop → Floating card panel with smart edge-aware positioning
 *
 * This is the primary entry point for all plot interactions:
 * claim, manage, future attack/defend/commander assignment.
 */

import { X, MapPin, Shield, Trees, Mountain, Flame, Droplets, Snowflake, Zap, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobilePlotSheet } from "./MobilePlotSheet";
import { DEFAULT_DESKTOP_POSITION, type PanelPositionHint } from "@/lib/plotPanelPosition";
import { ZClass } from "@/lib/uiLayers";
import { biomeColors } from "@shared/schema";
import type { LandParcel, Player, BiomeType } from "@shared/schema";

// ─── Biome display helpers (shared with MobilePlotSheet) ─────────────────────

const BIOME_ICONS: Record<BiomeType, React.ElementType> = {
  forest: Trees,
  desert: Flame,
  mountain: Mountain,
  plains: MapPin,
  water: Droplets,
  tundra: Snowflake,
  volcanic: Zap,
  swamp: Droplets,
};

const BIOME_LABELS: Record<BiomeType, string> = {
  forest: "Forest",
  desert: "Desert",
  mountain: "Mountain",
  plains: "Plains",
  water: "Ocean",
  tundra: "Tundra",
  volcanic: "Volcanic",
  swamp: "Swamp",
};

function richnessBadge(richness: number): { label: string; className: string } {
  if (richness >= 80) return { label: "Rich", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
  if (richness >= 50) return { label: "Moderate", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  return { label: "Sparse", className: "bg-muted/50 text-muted-foreground border-border" };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SelectedPlotPanelProps {
  parcel: LandParcel;
  player: Player | null;
  isOpen: boolean;

  onClaim: () => void;
  isClaiming: boolean;
  isWalletConnected: boolean;

  /** True when this player is eligible for their one free first-plot claim */
  isFreeClaimEligible?: boolean;

  /** Opens the full LandSheet for owned plots */
  onOpenFullSheet?: () => void;

  onClose: () => void;

  /**
   * Optional hint for smart desktop panel positioning.
   * Pass normalised (0–1) plot screen-space coordinates.
   */
  positionHint?: PanelPositionHint;
}

// ─── Desktop Panel ────────────────────────────────────────────────────────────

function DesktopPlotPanel({
  parcel,
  player,
  isOpen,
  onClaim,
  isClaiming,
  isWalletConnected,
  isFreeClaimEligible = false,
  onOpenFullSheet,
  onClose,
  positionHint,
}: SelectedPlotPanelProps) {
  const isOwnedByPlayer = !!player && parcel.ownerId === player.id;
  const isEnemyOwned = !!parcel.ownerId && parcel.ownerId !== player?.id;
  const isUnclaimed = !parcel.ownerId;

  const BiomeIcon = BIOME_ICONS[parcel.biome] ?? MapPin;
  const biomeColor = biomeColors[parcel.biome] ?? "#555";
  const biomeLabel = BIOME_LABELS[parcel.biome] ?? parcel.biome;
  const { label: richnessLabel, className: richnessClass } = richnessBadge(parcel.richness);

  const claimPrice = parcel.purchasePriceAlgo;
  const priceLabel = isFreeClaimEligible ? "FREE" : claimPrice !== null ? `${claimPrice} ALGO` : "—";

  // Use default top-right position when no hint
  const cssPosition = DEFAULT_DESKTOP_POSITION;

  let ownershipBadge: { label: string; className: string };
  if (isOwnedByPlayer) {
    ownershipBadge = { label: "Owned by You", className: "bg-green-500/20 text-green-400 border-green-500/30" };
  } else if (isEnemyOwned) {
    ownershipBadge = { label: parcel.ownerType === "ai" ? "AI Territory" : "Enemy Territory", className: "bg-red-500/20 text-red-400 border-red-500/30" };
  } else {
    ownershipBadge = { label: "Unclaimed", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" };
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="desktop-panel"
          className={cn(
            "hidden md:flex fixed flex-col w-80",
            ZClass.selectedPlotPanel,
            "bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-2xl",
            "overflow-hidden max-h-[calc(100vh-120px)]"
          )}
          style={cssPosition}
          initial={{ opacity: 0, scale: 0.95, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          data-testid="selected-plot-panel-desktop"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-border/50 flex-shrink-0"
            style={{ borderLeftColor: biomeColor, borderLeftWidth: 3 }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${biomeColor}33` }}
              >
                <BiomeIcon className="w-4.5 h-4.5" style={{ color: biomeColor }} />
              </div>
              <div>
                <p className="font-display uppercase tracking-wider text-sm font-semibold text-foreground">
                  {biomeLabel} Plot #{parcel.plotId}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {parcel.lat.toFixed(2)}°, {parcel.lng.toFixed(2)}°
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] font-mono uppercase", ownershipBadge.className)}>
                {ownershipBadge.label}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px] font-mono uppercase", richnessClass)}>
                {richnessLabel} Yield
              </Badge>
              {parcel.isSubdivided && (
                <Badge variant="outline" className="text-[10px] font-mono uppercase bg-purple-500/15 text-purple-400 border-purple-500/25">
                  Subdivided
                </Badge>
              )}
            </div>

            {/* Resource yields */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-display">Iron</p>
                <p className="text-xs font-mono font-semibold text-orange-400">{(parcel.richness * 0.01).toFixed(2)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-display">Fuel</p>
                <p className="text-xs font-mono font-semibold text-blue-400">{(parcel.richness * 0.008).toFixed(2)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-display">Crystal</p>
                <p className="text-xs font-mono font-semibold text-purple-400">{(parcel.richness * 0.005).toFixed(2)}</p>
              </div>
            </div>

            {/* Defense */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5" />
              <span>Defense Level {parcel.defenseLevel}</span>
            </div>

            {/* Pricing block — unclaimed */}
            {isUnclaimed && (
              <div className={cn(
                "rounded-xl p-3 border",
                isFreeClaimEligible
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-muted/20 border-border"
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">
                      {isFreeClaimEligible ? "First Plot — No Cost" : "Claim Price"}
                    </p>
                    <p className={cn(
                      "text-xl font-display font-bold",
                      isFreeClaimEligible ? "text-emerald-400" : "text-foreground"
                    )}>
                      {priceLabel}
                    </p>
                  </div>
                  {isFreeClaimEligible && (
                    <Badge className="bg-emerald-500 text-white text-[10px] font-display uppercase">
                      Free
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Owned hint */}
            {isOwnedByPlayer && (
              <div className="rounded-xl p-3 bg-green-500/10 border border-green-500/25 text-xs text-green-400">
                <p className="font-display uppercase tracking-wider text-[10px] mb-0.5">Your Territory</p>
                <p className="text-muted-foreground text-[11px]">Open the full panel to manage this plot.</p>
              </div>
            )}

            {/* Enemy warning */}
            {isEnemyOwned && (
              <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/25 flex items-start gap-2 text-xs text-red-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-display uppercase tracking-wider text-[10px] mb-0.5">
                    {parcel.ownerType === "ai" ? "AI Faction Territory" : "Hostile Territory"}
                  </p>
                  <p className="text-muted-foreground text-[11px]">Battle actions available in a future update.</p>
                </div>
              </div>
            )}
          </div>

          {/* CTA — always visible at panel bottom */}
          <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-border/50 bg-card/90 space-y-2">
            {isUnclaimed && player && (isFreeClaimEligible || isWalletConnected) && (
              <Button
                size="lg"
                className={cn(
                  "w-full font-display uppercase tracking-widest",
                  isFreeClaimEligible
                    ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-primary hover:bg-primary/90"
                )}
                onClick={onClaim}
                disabled={isClaiming}
                data-testid="desktop-panel-claim-btn"
              >
                {isClaiming ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Claiming…
                  </span>
                ) : isFreeClaimEligible ? (
                  "Claim Free Plot"
                ) : (
                  `Claim for ${priceLabel}`
                )}
              </Button>
            )}

            {isUnclaimed && (!player || (!isFreeClaimEligible && !isWalletConnected)) && (
              <Button size="lg" variant="outline" className="w-full font-display uppercase tracking-widest" disabled>
                Connect Wallet to Claim
              </Button>
            )}

            {isOwnedByPlayer && onOpenFullSheet && (
              <Button
                size="lg"
                variant="outline"
                className="w-full font-display uppercase tracking-widest"
                onClick={onOpenFullSheet}
                data-testid="desktop-panel-manage-btn"
              >
                Manage Plot
              </Button>
            )}

            {isEnemyOwned && (
              <Button size="lg" variant="outline" className="w-full font-display uppercase tracking-widest opacity-50 cursor-not-allowed" disabled>
                Attack (Coming Soon)
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Unified component ────────────────────────────────────────────────────────

/**
 * SelectedPlotPanel renders the correct variant automatically:
 * - Mobile: MobilePlotSheet (above BottomNav, z-55)
 * - Desktop: floating card (top-right, z-55)
 */
export function SelectedPlotPanel(props: SelectedPlotPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobilePlotSheet
        parcel={props.parcel}
        player={props.player}
        isOpen={props.isOpen}
        onClaim={props.onClaim}
        isClaiming={props.isClaiming}
        isWalletConnected={props.isWalletConnected}
        isFreeClaimEligible={props.isFreeClaimEligible}
        onOpenFullSheet={props.onOpenFullSheet}
        onClose={props.onClose}
      />
    );
  }

  return <DesktopPlotPanel {...props} />;
}
