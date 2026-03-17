import * as THREE from "three";

// ── Globe geometry ────────────────────────────────────────────────────────────
export const GLOBE_RADIUS = 2;
export const PLOT_COUNT = 21000;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Polar exclusion latitude — must match server/sphereUtils.ts POLAR_EXCLUSION_LAT.
 * Plots above this latitude (abs) are skipped, creating clean circular polar cap voids.
 */
export const POLAR_EXCLUSION_LAT = 75;

// ── Tile fill palette — neon gameplay zone colors ─────────────────────────────
export const COLOR_PLAYER         = new THREE.Color("#00ffaa"); // bright mint-green — your territory
export const COLOR_ENEMY          = new THREE.Color("#ff4400"); // hot orange-red — enemy territory
export const COLOR_BATTLE         = new THREE.Color("#ff0055"); // hot pink-red — active battle
export const COLOR_SELECTED       = new THREE.Color("#ffe566"); // bright gold — selected plot highlight
export const COLOR_BORDER_OWNED   = new THREE.Color("#ffffff"); // white outline on owned
export const COLOR_BORDER_UNOWNED = new THREE.Color("#4fc3f7"); // bright cyan grid — visible on all terrain
export const COLOR_SUBDIVIDED     = new THREE.Color(0x111820); // neutral dark for subdivided macro-plots

// ── Biome colors — neon zone aesthetic ───────────────────────────────────────
// forest   = Storm Belt    | desert   = Canyon Zone  | mountain = AI Nexus
// plains   = Launch Dist.  | water    = Aquatic Rift | tundra   = Ice Sector
// volcanic = Volcanic Core | swamp    = Arena District
export const BIOME_COLORS: Record<string, THREE.Color> = {
  forest:   new THREE.Color("#39ff14"), // Storm Belt → electric green
  desert:   new THREE.Color("#ff8a00"), // Canyon Zone → signal orange
  mountain: new THREE.Color("#c000ff"), // AI Nexus → ion purple
  plains:   new THREE.Color("#00ffd5"), // Launch District → orbital teal
  water:    new THREE.Color("#00ccff"), // Aquatic Rift → neon cyan
  tundra:   new THREE.Color("#bfe9ff"), // Ice Sector → pale blue
  volcanic: new THREE.Color("#ff5a36"), // Volcanic Core → hot orange-red
  swamp:    new THREE.Color("#ff4dca"), // Arena District → neon magenta
};

// ── Plot size variants — subtle natural variety without overlap artifacts ─────
export const SIZE_VARIANTS = [1.0, 1.04, 0.96, 1.06, 0.98, 1.02, 0.95, 1.05];

// ── Battle arc rendering ──────────────────────────────────────────────────────
export const ARC_LIFT_BASE   = 1.4;
export const ARC_LIFT_SCALE  = 0.6;
export const PROJECTILE_SIZE = 0.018;
export const ARC_TUBE_RADIUS = 0.006;
export const ARC_SEGMENTS    = 48;
export const FADE_DURATION   = 1500;

// ── Mining pulse ──────────────────────────────────────────────────────────────
export const PULSE_DURATION = 600;

// ── Orbital zone events ───────────────────────────────────────────────────────
export const ORBITAL_ZONE_COLORS: Record<string, string> = {
  ATMOSPHERIC_BURST: "#ff6622",
  IMPACT_STRIKE:     "#ff1744",
  METEOR_SHOWER:     "#ff9944",
  SINGLE_BOLIDE:     "#ffcc22",
  COMET_PASS:        "#aaddff",
  ORBITAL_DEBRIS:    "#aaaaaa",
};
export const ZONE_BASE_RADIUS = 0.12;

// ── Satellite orbit ───────────────────────────────────────────────────────────
export const SAT_ORBIT_RADIUS  = GLOBE_RADIUS + 0.45;
export const SAT_ORBIT_SPEED   = 0.003; // radians per second (visual)
export const SAT_SPHERE_RADIUS = 0.035;

// ── Stream camera ─────────────────────────────────────────────────────────────
/** How long the stream camera dwells on each battle hotspot (ms). */
export const STREAM_DWELL_MS = 15_000;

// ── Camera fly-to ─────────────────────────────────────────────────────────────
export const FLY_DISTANCE = GLOBE_RADIUS * 2.8;
export const FLY_SPEED    = 0.055;
export const FLY_DONE_SQ  = 0.0004;

// ── PlotOverlay sizing ────────────────────────────────────────────────────────
export const FILL_SIZE   = GLOBE_RADIUS * 0.022;
export const BORDER_SIZE = GLOBE_RADIUS * 0.026;

// ── SubParcel sizing ──────────────────────────────────────────────────────────
export const SUB_FILL_SIZE   = GLOBE_RADIUS * 0.010;
export const SUB_BORDER_SIZE = GLOBE_RADIUS * 0.011;
export const SUB_SPACING     = GLOBE_RADIUS * 0.011;
export const MAX_SUB_TILES   = 9 * 500;
