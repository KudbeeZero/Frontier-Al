import * as THREE from "three";

// Tile fill palette — neon gameplay zone colors
export const COLOR_PLAYER   = new THREE.Color("#00ffaa"); // bright mint-green — your territory
export const COLOR_ENEMY    = new THREE.Color("#ff4400"); // hot orange-red — enemy territory
export const COLOR_BATTLE   = new THREE.Color("#ff0055"); // hot pink-red — active battle
// Border colors
export const COLOR_BORDER_OWNED   = new THREE.Color("#ffffff"); // white outline on owned
export const COLOR_BORDER_UNOWNED = new THREE.Color("#4fc3f7"); // bright cyan grid — visible on all terrain

// Neon gameplay zone colors per biome key — DB values unchanged, display only.
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
