/**
 * MobilePlotSheet — mobile-only bottom sheet for selected plot actions.
 *
 * Appears ABOVE the BottomNav (fixed at bottom-16 = 64px offset).
 * Contains plot details, ownership state, pricing, and the primary claim CTA.
 * Designed as a reusable Plot Action Surface for future commander/battle actions.
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Shield, Zap, Flame, Gem, Droplets, Snowflake, Trees, Mountain, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LandParcel, Player, BiomeType } from "@shared/schema";
import { biomeColors } from "@shared/schema";
import { ZClass } from "@/lib/uiLayers";

// ─── Biome display helpers ──────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MobilePlotSheetProps {
  parcel: LandParcel;
  player: Player | null;
  isOpen: boolean;

  // Claim/purchase
  onClaim: () => void;
  isClaiming: boolean;
  isWalletConnected: boolean;

  /** When true, show "FREE" badge and price as 0 (first-plot entitlement) */
  isFreeClaimEligible?: boolean;

  // Owned plot actions
  onOpenFullSheet?: () => void;

  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function richnessBadge(richness: number): { label: string; className: string } {
  if (richness >= 80) return { label: "Rich", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
  if (richness >= 50) return { label: "Moderate", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  return { label: "Sparse", className: "bg-muted/50 text-muted-foreground border-border" };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MobilePlotSheet({
  parcel,
  player,
  isOpen,
  onClaim,
  isClaiming,
  isWalletConnected,
  isFreeClaimEligible = false,
  onOpenFullSheet,
  onClose,
}: MobilePlotSheetProps) {
  const isOwnedByPlayer = !!player && parcel.ownerId === player.id;
  const isEnemyOwned = !!parcel.ownerId && parcel.ownerId !== player?.id;
  const isUnclaimed = !parcel.ownerId;

  const BiomeIcon = BIOME_ICONS[parcel.biome] ?? MapPin;
  const biomeColor = biomeColors[parcel.biome] ?? "#555";
  const biomeLabel = BIOME_LABELS[parcel.biome] ?? parcel.biome;
  const { label: richnessLabel, className: richnessClass } = richnessBadge(parcel.richness);

  const showClaimCta = isUnclaimed && player && isWalletConnected;
  const claimPrice = parcel.purchasePriceAlgo;
  const priceLabel = isFreeClaimEligible ? "FREE" : claimPrice !== null ? `${claimPrice} ALGO` : "—";

  // Ownership badge
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
        <>
          {/* Backdrop — tap outside to close */}
          <motion.div
            key="backdrop"
            className="md:hidden fixed inset-0 z-[54] bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet — sits above BottomNav (bottom-16 = 64px) */}
          <motion.div
            key="sheet"
            className={cn(
              "md:hidden fixed left-0 right-0 bottom-16",
              ZClass.plotSheet,
              "flex flex-col max-h-[60vh]",
              "bg-card border-t border-border rounded-t-2xl shadow-2xl",
              "overflow-hidden"
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header bar with biome color accent */}
            <div
              className="flex items-center justify-between px-4 py-2 flex-shrink-0 border-b border-border/50"
              style={{ borderLeftColor: biomeColor, borderLeftWidth: 3 }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${biomeColor}33` }}
                >
                  <BiomeIcon className="w-4 h-4" style={{ color: biomeColor }} />
                </div>
                <div>
                  <p className="font-display uppercase tracking-wider text-xs font-semibold text-foreground">
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

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {/* Status badges */}
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

              {/* Resource yield row */}
              <div className="grid grid-cols-3 gap-2">
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

              {/* Defence indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="w-3.5 h-3.5" />
                <span>Defense Level {parcel.defenseLevel}</span>
              </div>

              {/* Pricing section — for unclaimed plots */}
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
                        "text-lg font-display font-bold tracking-wide",
                        isFreeClaimEligible ? "text-emerald-400" : "text-foreground"
                      )}>
                        {priceLabel}
                      </p>
                    </div>
                    {isFreeClaimEligible && (
                      <Badge className="bg-emerald-500 text-white text-[10px] font-display uppercase">
                        Free Starter
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Owned by player — show manage hint */}
              {isOwnedByPlayer && (
                <div className="rounded-xl p-3 bg-green-500/10 border border-green-500/25 text-xs text-green-400">
                  <p className="font-display uppercase tracking-wider text-[10px] mb-0.5">Your Territory</p>
                  <p className="text-muted-foreground text-[11px]">Tap Manage to access mining, upgrades, and more.</p>
                </div>
              )}

              {/* Enemy territory warning */}
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

              {/* Not logged in notice */}
              {!player && (
                <div className="rounded-xl p-3 bg-muted/20 border border-border text-xs text-muted-foreground text-center">
                  Connect wallet to claim this plot
                </div>
              )}
            </div>

            {/* Sticky CTA — pinned at bottom of sheet, always visible */}
            <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-border/50 bg-card">
              {showClaimCta && (
                <Button
                  size="lg"
                  className={cn(
                    "w-full h-12 font-display uppercase tracking-widest text-sm",
                    isFreeClaimEligible
                      ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-primary hover:bg-primary/90"
                  )}
                  onClick={onClaim}
                  disabled={isClaiming}
                  data-testid="mobile-sheet-claim-btn"
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

              {isOwnedByPlayer && onOpenFullSheet && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full h-12 font-display uppercase tracking-widest text-sm"
                  onClick={onOpenFullSheet}
                  data-testid="mobile-sheet-manage-btn"
                >
                  Manage Plot
                </Button>
              )}

              {isEnemyOwned && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full h-12 font-display uppercase tracking-widest text-sm opacity-50 cursor-not-allowed"
                  disabled
                >
                  Attack (Coming Soon)
                </Button>
              )}

              {!player && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full h-12 font-display uppercase tracking-widest text-sm"
                  disabled
                >
                  Connect Wallet to Claim
                </Button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
