import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type { LandParcel, BiomeType } from "@shared/schema";
import { biomeColors } from "@shared/schema";

const SECTOR_NAMES: Record<string, string> = {
  "NW": "Arctic Command",
  "NE": "Nordic Sector",
  "CW": "Atlantic Zone",
  "CE": "Central Theater",
  "SW": "Southern Front",
  "SE": "Pacific Rim",
};

function getSector(lat: number, lng: number): string {
  const ns = lat > 20 ? "N" : lat < -20 ? "S" : "C";
  const ew = lng < 0 ? "W" : "E";
  return ns + ew;
}

function getPlotName(plotId: number, biome: BiomeType): string {
  const prefixes: Record<BiomeType, string[]> = {
    forest: ["Ironwood", "Timberfall", "Greenhollow", "Darkroot"],
    desert: ["Dustmarch", "Sunblast", "Sandrift", "Dryreach"],
    mountain: ["Stonepeak", "Ironridge", "Frostcrag", "Highforge"],
    plains: ["Flatwind", "Openfield", "Grassmere", "Goldstretch"],
    water: ["Tidehaven", "Deepcove", "Saltmere", "Wavecrest"],
    tundra: ["Frostheim", "Iceveil", "Snowdrift", "Coldreach"],
    volcanic: ["Emberpeak", "Ashfall", "Magmacore", "Firegate"],
    swamp: ["Bogmire", "Murkfen", "Rothollow", "Gloommarsh"],
  };
  const names = prefixes[biome] || prefixes.plains;
  return `${names[plotId % names.length]}-${plotId}`;
}

interface PlayerInfo {
  id: string;
  name: string;
}

interface FlatMapProps {
  parcels: LandParcel[];
  selectedParcelId: string | null;
  currentPlayerId: string | null;
  onParcelSelect: (parcelId: string) => void;
  className?: string;
  onLocateTerritory?: () => void;
  onFindEnemyTarget?: () => void;
  hasOwnedPlots?: boolean;
  players?: PlayerInfo[];
}

const COLORS = {
  player: "#00ff44",
  playerGlow: "#00ff88",
  enemy: "#ff2222",
  enemyGlow: "#ff6644",
  unclaimed: "#1a1a1a",
  selected: "#00e5ff",     // cyan — replaces white to eliminate the "white square" artifact
  selectedGlow: "#00b8cc", // darker cyan for shadow glow
  hover: "#6699bb",        // muted blue-grey instead of plain grey
  background: "#050508",
  grid: "#111115",
};

export function FlatMap({
  parcels,
  selectedParcelId,
  currentPlayerId,
  onParcelSelect,
  className,
  onLocateTerritory,
  onFindEnemyTarget,
  hasOwnedPlots,
  players,
}: FlatMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const [hoveredPlotId, setHoveredPlotId] = useState<string | null>(null);
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const mapImageLoaded = useRef(false);
  const nightImageRef = useRef<HTMLImageElement | null>(null);
  const nightImageLoaded = useRef(false);
  const cloudsImageRef = useRef<HTMLImageElement | null>(null);
  const cloudsImageLoaded = useRef(false);
  const selectedScreenPosRef = useRef<{ x: number; y: number } | null>(null);
  const [selectedScreenPos, setSelectedScreenPos] = useState<{ x: number; y: number } | null>(null);
  const lastPosUpdateRef = useRef(0);

  // Globe camera: centerLat/centerLng is the point at the center of the visible globe face
  const [camera, setCamera] = useState({ centerLat: 0, centerLng: 0, zoom: 1 });
  // Keep a ref for use inside pointer handlers without stale closure issues
  const cameraRef = useRef(camera);
  useEffect(() => { cameraRef.current = camera; }, [camera]);

  const playerMap = useMemo(() => {
    const m = new Map<string, string>();
    players?.forEach(p => m.set(p.id, p.name));
    return m;
  }, [players]);

  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef(0);
  const pulseRef = useRef(0);

  const starsRef = useRef<{ x: number; y: number; size: number; brightness: number; twinkleSpeed: number }[]>([]);
  const shootingStarsRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; length: number }[]>([]);
  const nextShootingStarRef = useRef(Math.random() * 200 + 100);

  const satelliteImgRef = useRef<HTMLImageElement | null>(null);
  const satelliteImgLoaded = useRef(false);

  interface OrbitalSat {
    angle: number;
    speed: number;
    inclination: number;
    inclinationPhase: number;
    orbitRadius: number;
    size: number;
    trailPositions: { x: number; y: number; alpha: number }[];
    scanAngle: number;
  }

  const orbitalSatsRef = useRef<OrbitalSat[]>([]);

  if (starsRef.current.length === 0) {
    for (let i = 0; i < 120; i++) {
      starsRef.current.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 1.5 + 0.5,
        brightness: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 3 + 1,
      });
    }
  }

  if (orbitalSatsRef.current.length === 0) {
    orbitalSatsRef.current = [
      { angle: 0, speed: 0.006, inclination: 0.35, inclinationPhase: 0, orbitRadius: 1.22, size: 28, trailPositions: [], scanAngle: 0 },
      { angle: Math.PI * 0.7, speed: 0.004, inclination: 0.5, inclinationPhase: Math.PI / 3, orbitRadius: 1.30, size: 22, trailPositions: [], scanAngle: 0 },
      { angle: Math.PI * 1.4, speed: 0.005, inclination: 0.2, inclinationPhase: Math.PI * 0.8, orbitRadius: 1.18, size: 25, trailPositions: [], scanAngle: 0 },
    ];
  }

  useEffect(() => {
    const albedo = new Image();
    albedo.src = "/textures/planets/ascendancy/planet_albedo.png";
    albedo.onload = () => {
      mapImageRef.current = albedo;
      mapImageLoaded.current = true;
    };
    const night = new Image();
    night.src = "/textures/planets/ascendancy/planet_night_lights.png";
    night.onload = () => {
      nightImageRef.current = night;
      nightImageLoaded.current = true;
    };
    const clouds = new Image();
    clouds.src = "/textures/planets/ascendancy/planet_clouds.png";
    clouds.onload = () => {
      cloudsImageRef.current = clouds;
      cloudsImageLoaded.current = true;
    };
    const satImg = new Image();
    satImg.src = "/images/satellite.png";
    satImg.onload = () => {
      satelliteImgRef.current = satImg;
      satelliteImgLoaded.current = true;
    };
  }, []);

  const plotIndex = useMemo(() => {
    const map = new Map<string, LandParcel>();
    parcels.forEach((p) => map.set(p.id, p));
    return map;
  }, [parcels]);

  // Compute the globe's pixel radius from canvas dimensions and zoom level.
  // The 0.9 factor leaves a small margin so the atmosphere glow is visible.
  // Uses cameraRef so the render loop never needs to restart just because zoom changed.
  const getGlobeRadius = useCallback(
    (canvasW: number, canvasH: number) => {
      return Math.min(canvasW, canvasH) / 2 * cameraRef.current.zoom * 0.9;
    },
    [] // cameraRef is a stable ref — no deps needed
  );

  /**
   * Orthographic globe projection.
   * Maps a lat/lng to a 2-D screen position by projecting onto the visible
   * hemisphere centered on camera.centerLat / camera.centerLng.
   * Returns null when the point is on the back hemisphere (not visible).
   */
  const latLngToScreen = useCallback(
    (lat: number, lng: number, canvasW: number, canvasH: number): { x: number; y: number } | null => {
      const R = getGlobeRadius(canvasW, canvasH);
      const φ  = lat  * Math.PI / 180;
      const λ  = lng  * Math.PI / 180;
      // Read from cameraRef so this callback stays stable across camera updates
      const φ0 = cameraRef.current.centerLat * Math.PI / 180;
      const λ0 = cameraRef.current.centerLng * Math.PI / 180;

      // cos(angular distance from center) — negative means behind the globe
      const cosC =
        Math.sin(φ0) * Math.sin(φ) +
        Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0);
      if (cosC < 0) return null;

      const x = R * Math.cos(φ) * Math.sin(λ - λ0);
      const y = -R * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ - λ0));

      return { x: canvasW / 2 + x, y: canvasH / 2 + y };
    },
    [getGlobeRadius] // getGlobeRadius is stable; cameraRef never changes reference
  );

  /**
   * Inverse orthographic projection.
   * Maps a screen pixel back to lat/lng.
   * Returns null if the pixel is outside the globe circle.
   */
  const screenToLatLng = useCallback(
    (sx: number, sy: number, canvasW: number, canvasH: number): { lat: number; lng: number } | null => {
      const R  = getGlobeRadius(canvasW, canvasH);
      const nx = (sx - canvasW / 2) / R;
      const ny = -(sy - canvasH / 2) / R;
      const ρ  = Math.sqrt(nx * nx + ny * ny);
      if (ρ > 1) return null;

      const c    = Math.asin(Math.min(1, ρ));
      // Read from cameraRef so this callback stays stable across camera updates
      const φ0   = cameraRef.current.centerLat * Math.PI / 180;
      const λ0   = cameraRef.current.centerLng * Math.PI / 180;
      const sinC = Math.sin(c);
      const cosC = Math.cos(c);

      const φ = Math.asin(cosC * Math.sin(φ0) + (ρ > 0 ? ny * sinC * Math.cos(φ0) / ρ : 0));
      const λ = λ0 + Math.atan2(nx * sinC, ρ * Math.cos(φ0) * cosC - ny * Math.sin(φ0) * sinC);

      return { lat: φ * 180 / Math.PI, lng: λ * 180 / Math.PI };
    },
    [getGlobeRadius] // getGlobeRadius is stable; cameraRef never changes reference
  );

  const getPlotSize = useCallback(
    (canvasW: number, canvasH: number) => {
      const R = getGlobeRadius(canvasW, canvasH);
      return Math.max(2, R / 78);
    },
    [getGlobeRadius]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const stars = starsRef.current;
    const shootingStars = shootingStarsRef.current;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const needsResize =
        canvas.width  !== Math.round(rect.width  * dpr) ||
        canvas.height !== Math.round(rect.height * dpr);
      if (needsResize) {
        canvas.width  = rect.width  * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width  = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w  = rect.width;
      const h  = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const R  = getGlobeRadius(w, h);

      // ── Space background ──────────────────────────────────────────────────
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, w, h);

      // ── Stars ─────────────────────────────────────────────────────────────
      for (const star of stars) {
        const twinkle = Math.sin(pulseRef.current * star.twinkleSpeed) * 0.3 + 0.7;
        const alpha   = star.brightness * twinkle;
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
        ctx.fillRect(star.x * w, star.y * h, star.size, star.size);
      }

      // ── Shooting stars ────────────────────────────────────────────────────
      nextShootingStarRef.current--;
      if (nextShootingStarRef.current <= 0) {
        const angle = Math.random() * 0.4 + 0.2;
        const speed = Math.random() * 4 + 3;
        shootingStars.push({
          x: Math.random() * w * 0.8,
          y: Math.random() * h * 0.3,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: Math.random() * 30 + 20,
          length: Math.random() * 40 + 30,
        });
        nextShootingStarRef.current = Math.random() * 300 + 150;
      }
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss    = shootingStars[i];
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life++;
        const alpha = 1 - ss.life / ss.maxLife;
        if (alpha <= 0) { shootingStars.splice(i, 1); continue; }
        const tailX = ss.x - ss.vx * 8;
        const tailY = ss.y - ss.vy * 8;
        const grad  = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
        grad.addColorStop(1, `rgba(150, 200, 255, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }

      // ── Atmosphere glow ring (drawn outside the globe circle) ─────────────
      const atmosGrad = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.14);
      atmosGrad.addColorStop(0,   "rgba(40, 120, 255, 0.50)");
      atmosGrad.addColorStop(0.4, "rgba(20,  80, 200, 0.20)");
      atmosGrad.addColorStop(1,   "rgba(10,  40, 120, 0)");
      ctx.fillStyle = atmosGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2);
      ctx.fill();

      // ── Everything below is clipped to the globe circle ───────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // Map image as the globe face — equirectangular textures scroll with
      // camera rotation by offsetting by the camera's lng/lat position.
      // Each texture is drawn twice (offset ± texW) to handle dateline wrap.
      if (mapImageLoaded.current && mapImageRef.current) {
        const lng = cameraRef.current.centerLng;
        const lat = cameraRef.current.centerLat;
        const W = R * 2;
        const H = R * 2;

        // Horizontal scroll: wrap longitude so dateline never causes a gap
        let xOff = -(lng / 360) * W;
        xOff = ((xOff % W) + W) % W;
        xOff = xOff - W;

        // Vertical scroll: subtle + clamped to prevent polar banding
        let yOff = (lat / 180) * (R * 0.35);
        yOff = Math.max(-R * 0.35, Math.min(R * 0.35, yOff));

        // Draw img three times horizontally to cover the dateline seam
        const drawWrapped = (img: HTMLImageElement, alpha: number, op = "source-over", extraX = 0, extraY = 0) => {
          ctx.globalCompositeOperation = op as GlobalCompositeOperation;
          ctx.globalAlpha = alpha;
          const x0 = cx - R + xOff + extraX;
          const y0 = cy - R + yOff + extraY;
          ctx.drawImage(img, x0,      y0, W, H);
          ctx.drawImage(img, x0 + W,  y0, W, H);
          ctx.drawImage(img, x0 - W,  y0, W, H);
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1.0;
        };

        drawWrapped(mapImageRef.current, 0.9);

        if (nightImageLoaded.current && nightImageRef.current) {
          drawWrapped(nightImageRef.current, 0.5, "screen");
        }

        if (cloudsImageLoaded.current && cloudsImageRef.current) {
          // Clouds drift at slightly different rate for subtle parallax
          drawWrapped(cloudsImageRef.current, 0.25, "source-over", W * 0.02, 0);
        }
      } else {
        ctx.fillStyle = "#0a1628";
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      }

      // ── Lat/Lng grid lines using the orthographic projection ───────────────
      const gridAlpha = Math.min(0.08, 0.02 + cameraRef.current.zoom * 0.005); // Reduced grid opacity
      ctx.strokeStyle = `rgba(100, 200, 255, ${gridAlpha})`;
      ctx.lineWidth   = 0.5;

      const drawGlobeGridLine = (pts: { lat: number; lng: number }[]) => {
        let started = false;
        ctx.beginPath();
        for (const pt of pts) {
          const s = latLngToScreen(pt.lat, pt.lng, w, h);
          if (!s) { started = false; continue; }
          if (!started) { ctx.moveTo(s.x, s.y); started = true; }
          else            ctx.lineTo(s.x, s.y);
        }
        ctx.stroke();
      };

      // Latitude parallels (every 30°)
      /* Grid rendering disabled per request
      for (let lat = -60; lat <= 60; lat += 30) {
        const pts: { lat: number; lng: number }[] = [];
        for (let lng = -180; lng <= 180; lng += 3) pts.push({ lat, lng });
        drawGlobeGridLine(pts);
      }
      // Longitude meridians (every 30°)
      for (let lng = -150; lng <= 180; lng += 30) {
        const pts: { lat: number; lng: number }[] = [];
        for (let lat = -90; lat <= 90; lat += 3) pts.push({ lat, lng });
        drawGlobeGridLine(pts);
      }
      */

      // ── Plots ─────────────────────────────────────────────────────────────
      const plotSize = getPlotSize(w, h);
      pulseRef.current += 0.02;

      // OPTIMIZATION: Disable expensive shadows during plot loop
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      
      const selectedPlot = selectedParcelId ? plotIndex.get(selectedParcelId) : undefined;

      for (let i = 0; i < parcels.length; i++) {
        const p = parcels[i];
        
        const isPlayerOwned = p.ownerId && currentPlayerId && p.ownerId === currentPlayerId;
        const isSelected    = p.id === selectedParcelId;
        
        // Only render owned plots or the selected plot
        if (!isPlayerOwned && !isSelected) continue;

        const screenPos = latLngToScreen(p.lat, p.lng, w, h);
        if (!screenPos) continue; 
        const { x, y } = screenPos;

        const isEnemyOwned  = p.ownerId && !isPlayerOwned;
        const isHovered     = p.id === hoveredPlotId;

        let size = plotSize;
        let plotAlpha = 0.3;
        let color = COLORS.unclaimed;

        if (isSelected) {
          color = COLORS.selected;
          size = plotSize * 1.8;
          plotAlpha = 0.9;
        } else if (isHovered) {
          color = isPlayerOwned ? COLORS.playerGlow : isEnemyOwned ? COLORS.enemyGlow : COLORS.hover;
          size = plotSize * 1.5;
          plotAlpha = 0.8;
        } else if (isPlayerOwned) {
          color = COLORS.player;
          plotAlpha = 0.6;
        } else if (isEnemyOwned) {
          color = COLORS.enemy;
          plotAlpha = 0.6;
        }

        ctx.globalAlpha = plotAlpha;
        if (isSelected) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
        ctx.globalAlpha = 1.0;
      }

      // Selected plot rings — cyan, not white
      if (selectedPlot) {
        const screenPos = latLngToScreen(selectedPlot.lat, selectedPlot.lng, w, h);
        if (screenPos) {
          const { x, y } = screenPos;
          // Pulse driven by pulseRef so the ring animates
          const ringPulse = Math.sin(pulseRef.current * 2) * 0.15 + 0.85;
          const ringSize  = plotSize * 2.2;
          ctx.strokeStyle = `rgba(0,229,255,${(ringPulse * 0.85).toFixed(2)})`;
          ctx.lineWidth   = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, ringSize, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = `rgba(0,184,204,${(ringPulse * 0.25).toFixed(2)})`;
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.arc(x, y, ringSize * 1.45, 0, Math.PI * 2);
          ctx.stroke();

          selectedScreenPosRef.current = { x, y };
          const now = Date.now();
          if (now - lastPosUpdateRef.current > 100) {
            lastPosUpdateRef.current = now;
            setSelectedScreenPos({ x, y });
          }
        } else {
          setSelectedScreenPos(null);
        }
      } else {
        setSelectedScreenPos(null);
      }

      // ── Limb darkening — sphere shading applied on top of everything ───────
      // Darkens the edges so the disc looks like a sphere rather than a flat circle.
      const limbGrad = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
      limbGrad.addColorStop(0,    "rgba(0,0,0,0)");
      limbGrad.addColorStop(0.72, "rgba(0,0,10,0.08)");
      limbGrad.addColorStop(0.88, "rgba(0,5,30,0.42)");
      limbGrad.addColorStop(1.0,  "rgba(0,10,40,0.82)");
      ctx.fillStyle = limbGrad;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      ctx.restore(); // ← end globe clip

      // ── Globe border ring ─────────────────────────────────────────────────
      ctx.strokeStyle = "rgba(60, 140, 255, 0.55)";
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // ── Orbital satellites ─────────────────────────────────────────────────
      const sats = orbitalSatsRef.current;
      for (const sat of sats) {
        sat.angle += sat.speed;
        sat.scanAngle += 0.03;

        const orbitR = R * sat.orbitRadius;
        const tiltY = Math.sin(sat.angle + sat.inclinationPhase) * sat.inclination;
        const sx = cx + Math.cos(sat.angle) * orbitR;
        const sy = cy + Math.sin(sat.angle) * orbitR * 0.35 + tiltY * orbitR * 0.4;

        const isBehind = Math.sin(sat.angle) > 0.15 && Math.abs(Math.cos(sat.angle)) < 0.85;
        const depthAlpha = isBehind ? 0.25 : 0.95;

        sat.trailPositions.unshift({ x: sx, y: sy, alpha: depthAlpha });
        if (sat.trailPositions.length > 18) sat.trailPositions.pop();

        if (sat.trailPositions.length > 1) {
          for (let ti = 1; ti < sat.trailPositions.length; ti++) {
            const t0 = sat.trailPositions[ti - 1];
            const t1 = sat.trailPositions[ti];
            const fade = 1 - ti / sat.trailPositions.length;
            ctx.strokeStyle = `rgba(0, 180, 255, ${fade * 0.35 * Math.min(t0.alpha, t1.alpha)})`;
            ctx.lineWidth = 2 * fade;
            ctx.beginPath();
            ctx.moveTo(t0.x, t0.y);
            ctx.lineTo(t1.x, t1.y);
            ctx.stroke();
          }
        }

        if (!isBehind) {
          const scanLen = sat.size * 3;
          const scanDir = sat.scanAngle;
          const scanEndX = sx + Math.cos(scanDir) * scanLen;
          const scanEndY = sy + Math.sin(scanDir) * scanLen;
          const scanGrad = ctx.createLinearGradient(sx, sy, scanEndX, scanEndY);
          scanGrad.addColorStop(0, "rgba(0, 255, 200, 0.25)");
          scanGrad.addColorStop(1, "rgba(0, 255, 200, 0)");
          ctx.strokeStyle = scanGrad;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(scanEndX, scanEndY);
          ctx.stroke();

          ctx.fillStyle = `rgba(0, 200, 255, ${0.15 + Math.sin(pulseRef.current * 4) * 0.1})`;
          ctx.beginPath();
          ctx.arc(sx, sy, sat.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }

        if (satelliteImgLoaded.current && satelliteImgRef.current) {
          ctx.globalAlpha = depthAlpha;
          const drawSize = isBehind ? sat.size * 0.6 : sat.size;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(sat.angle + Math.PI * 0.25);
          ctx.drawImage(satelliteImgRef.current, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
          ctx.restore();
          ctx.globalAlpha = 1.0;
        } else {
          ctx.fillStyle = `rgba(180, 200, 220, ${depthAlpha})`;
          ctx.fillRect(sx - 3, sy - 1, 6, 2);
          ctx.fillRect(sx - 1, sy - 4, 2, 8);
        }

        if (!isBehind) {
          ctx.fillStyle = `rgba(255, 80, 80, ${0.6 + Math.sin(pulseRef.current * 6) * 0.4})`;
          ctx.beginPath();
          ctx.arc(sx + sat.size * 0.2, sy - sat.size * 0.2, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  // camera is intentionally omitted — the render loop reads cameraRef.current on
  // every frame instead, so there is no need to restart the loop on each drag/zoom.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcels, selectedParcelId, hoveredPlotId, currentPlayerId, getPlotSize, latLngToScreen, plotIndex]);

  const findPlotAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect      = canvas.getBoundingClientRect();
      const sx        = clientX - rect.left;
      const sy        = clientY - rect.top;
      const w         = rect.width;
      const h         = rect.height;
      const plotSize  = getPlotSize(w, h);
      const hitRadius = Math.max(plotSize * 1.2, 8);

      let closest: LandParcel | null = null;
      let closestDist = Infinity;

      for (const p of parcels) {
        const screenPos = latLngToScreen(p.lat, p.lng, w, h);
        if (!screenPos) continue; // back hemisphere
        const { x, y } = screenPos;
        const dx   = sx - x;
        const dy   = sy - y;
        const dist = dx * dx + dy * dy;
        if (dist < hitRadius * hitRadius && dist < closestDist) {
          closest     = p;
          closestDist = dist;
        }
      }
      return closest;
    },
    [parcels, latLngToScreen, getPlotSize]
  );

  const handlePointerLeave = useCallback(() => {
    setHoveredPlotId(null);
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = "grab";
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = false;
    lastMouse.current  = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons > 0) {
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDragging.current = true;

        // Convert pixel drag to globe rotation.
        // degPerPx: at the equator, moving R pixels spans 180°.
        const canvas = canvasRef.current;
        if (canvas) {
          const rect     = canvas.getBoundingClientRect();
          const R        = Math.min(rect.width, rect.height) / 2 * cameraRef.current.zoom * 0.9;
          const degPerPx = 180 / (Math.PI * R);
          setCamera((prev) => ({
            ...prev,
            centerLng: ((prev.centerLng - dx * degPerPx) + 540) % 360 - 180,
            centerLat: Math.max(-85, Math.min(85, prev.centerLat + dy * degPerPx)),
          }));
          canvas.style.cursor = "grabbing";
        }
        lastMouse.current = { x: e.clientX, y: e.clientY };
      } else {
        const plot = findPlotAt(e.clientX, e.clientY);
        setHoveredPlotId(plot?.id || null);
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = plot ? "pointer" : "grab";
      }
    },
    [findPlotAt]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) {
        const plot = findPlotAt(e.clientX, e.clientY);
        if (plot) onParcelSelect(plot.id);
      }
      isDragging.current = false;
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = "grab";
    },
    [findPlotAt, onParcelSelect]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setCamera((prev) => ({
      ...prev,
      zoom: Math.max(0.5, Math.min(8, prev.zoom * zoomFactor)),
    }));
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current > 0) {
        const scale = dist / lastPinchDist.current;
        setCamera((prev) => ({
          ...prev,
          zoom: Math.max(0.5, Math.min(8, prev.zoom * scale)),
        }));
      }
      lastPinchDist.current = dist;
    }
  }, []);

  // Rotate the globe so the given plot is centered on screen.
  const centerOnPlot = useCallback((plot: LandParcel) => {
    setCamera((prev) => ({
      ...prev,
      centerLat: plot.lat,
      centerLng: plot.lng,
    }));
  }, []);

  const handleLocate = useCallback(() => {
    if (onLocateTerritory) onLocateTerritory();
    // Centering is handled by the selectedParcelId effect after GameLayout sets the new random plot
  }, [onLocateTerritory]);

  const handleFindEnemy = useCallback(() => {
    if (onFindEnemyTarget) onFindEnemyTarget();
  }, [onFindEnemyTarget]);

  const handleResetView = useCallback(() => {
    setCamera({ centerLat: 0, centerLng: 0, zoom: 1 });
  }, []);

  // Auto-rotate globe to center on a newly selected plot.
  // Always centers so that locate/enemy/battle-link actions always bring the plot into view.
  useEffect(() => {
    if (selectedParcelId) {
      const plot = plotIndex.get(selectedParcelId);
      if (plot) centerOnPlot(plot);
    }
  }, [selectedParcelId, plotIndex, centerOnPlot]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        // Prevent the wrapper div from showing its own focus ring or tap flash
        outline: "none",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
      }}
      data-testid="flat-map"
    >
      <canvas
        ref={canvasRef}
        // tabIndex={-1} makes the element programmatically focusable but removes it from
        // the tab order. Combined with outline:none this suppresses the browser focus ring
        // on click/tap in Chrome, Firefox, and Safari without affecting pointer events.
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        style={{
          width: "100%",
          height: "100%",
          touchAction: "none",
          outline: "none",
          // Suppress mobile browser tap-highlight (the white flash on iOS Safari)
          WebkitTapHighlightColor: "transparent",
          userSelect: "none",
        }}
        data-testid="map-canvas"
      />

      {false && selectedParcelId && selectedScreenPos && (() => {
        const plot = (selectedParcelId && plotIndex) ? plotIndex.get(selectedParcelId as string) : undefined;
        const cRect = containerRef.current?.getBoundingClientRect();
        if (!plot || !selectedScreenPos || !cRect) return null;
        const popupW = 200;
        const popupH = 140;
        const sPos = selectedScreenPos as { x: number; y: number };
        let px = sPos.x + 20;
        let py = sPos.y - popupH / 2;
        if (px + popupW > cRect.width - 10) px = sPos.x - popupW - 20;
        if (py < 10) py = 10;
        if (py + popupH > cRect.height - 10) py = cRect.height - popupH - 10;
        const sectorKey = getSector(plot.lat, plot.lng);
        const sectorName = SECTOR_NAMES[sectorKey] || "Unknown Sector";
        const plotName = getPlotName(plot.plotId, plot.biome as BiomeType);
        const ownerIdVal = plot.ownerId as string | null;
        const ownerName = ownerIdVal ? (playerMap.get(ownerIdVal) || "Unknown") : "Unclaimed";
        const isPlayer = !!(currentPlayerId && ownerIdVal === currentPlayerId);
        const isEnemy = !!(ownerIdVal && !isPlayer);
        const statusColor = isPlayer ? "#00ff44" : isEnemy ? "#ff2222" : "#888";
        const statusText = isPlayer ? "YOUR BASE" : isEnemy ? "HOSTILE" : "UNCLAIMED";
        const biomeColor = biomeColors[plot.biome as BiomeType] || "#666";

        return (
          <div
            className="absolute z-20 pointer-events-none"
            style={{ left: px, top: py, width: popupW }}
            data-testid="floating-plot-info"
          >
            <div className="backdrop-blur-lg bg-black/85 rounded-lg border border-white/15 shadow-2xl overflow-hidden">
              <div className="px-3 py-1.5 flex items-center justify-between" style={{ borderBottom: `2px solid ${statusColor}` }}>
                <span className="text-[10px] font-display uppercase tracking-widest font-bold" style={{ color: statusColor }}>{statusText}</span>
                <span className="text-[9px] font-mono text-white/50">#{plot.plotId}</span>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                <div>
                  <span className="text-xs font-display uppercase tracking-wide font-bold text-white block">{plotName}</span>
                  <span className="text-[9px] text-white/40 font-display uppercase">{sectorName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: biomeColor }} />
                  <span className="text-[10px] text-white/70 capitalize">{plot.biome}</span>
                  <span className="text-[9px] text-white/40 ml-auto">Rich: {plot.richness}%</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
                  <div className="flex justify-between">
                    <span className="text-white/40 font-display uppercase">Defense</span>
                    <span className="text-white font-mono">{plot.defenseLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40 font-display uppercase">Yield</span>
                    <span className="text-white font-mono">{plot.yieldMultiplier.toFixed(1)}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40 font-display uppercase">FRNTR/h</span>
                    <span className="text-cyan-400 font-mono">{(plot.frontierPerDay / 24).toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40 font-display uppercase">Owner</span>
                    <span className="text-white font-mono truncate ml-1" style={{ maxWidth: 60 }}>{ownerName}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="absolute bottom-20 left-3 z-10 pointer-events-none" data-testid="color-legend">
        <div className="backdrop-blur-md bg-black/70 rounded-md px-3 py-2.5 text-[10px] font-display uppercase tracking-wider space-y-1.5 border border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.player }} />
            <span className="text-green-400">Your Territory</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.enemy }} />
            <span className="text-red-400">Enemy Territory</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.unclaimed, border: "1px solid #333" }} />
            <span className="text-gray-500">Unclaimed</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-20 right-3 z-10 flex flex-col gap-2">
        <button
          onClick={handleResetView}
          className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-md text-xs font-display uppercase tracking-wide flex items-center gap-1.5 shadow-lg backdrop-blur-sm border border-white/10"
          data-testid="button-reset-view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Reset View
        </button>
        {hasOwnedPlots && onLocateTerritory && (
          <button
            onClick={handleLocate}
            className="bg-green-600/90 hover:bg-green-500 text-white px-3 py-2 rounded-md text-xs font-display uppercase tracking-wide flex items-center gap-1.5 shadow-lg"
            data-testid="button-locate-territory"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            My Bases
          </button>
        )}
        {onFindEnemyTarget && (
          <button
            onClick={handleFindEnemy}
            className="bg-red-600/90 hover:bg-red-500 text-white px-3 py-2 rounded-md text-xs font-display uppercase tracking-wide flex items-center gap-1.5 shadow-lg"
            data-testid="button-find-enemy"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Find Targets
          </button>
        )}
      </div>
    </div>
  );
}
