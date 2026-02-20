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
  selected: "#ffffff",
  hover: "#888888",
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

  const starsRef = useRef<{ x: number; y: number; size: number; brightness: number; twinkleSpeed: number }[]>([]);
  const shootingStarsRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; length: number }[]>([]);
  const nextShootingStarRef = useRef(Math.random() * 200 + 100);

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

  useEffect(() => {
    const img = new Image();
    img.src = "/images/map-background.jpg";
    img.onload = () => {
      mapImageRef.current = img;
      mapImageLoaded.current = true;
    };
  }, []);

  const plotIndex = useMemo(() => {
    const map = new Map<string, LandParcel>();
    parcels.forEach((p) => map.set(p.id, p));
    return map;
  }, [parcels]);

  // Compute the globe's pixel radius from canvas dimensions and zoom level.
  // The 0.9 factor leaves a small margin so the atmosphere glow is visible.
  const getGlobeRadius = useCallback(
    (canvasW: number, canvasH: number) => {
      return Math.min(canvasW, canvasH) / 2 * camera.zoom * 0.9;
    },
    [camera.zoom]
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
      const φ0 = camera.centerLat * Math.PI / 180;
      const λ0 = camera.centerLng * Math.PI / 180;

      // cos(angular distance from center) — negative means behind the globe
      const cosC =
        Math.sin(φ0) * Math.sin(φ) +
        Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0);
      if (cosC < 0) return null;

      const x = R * Math.cos(φ) * Math.sin(λ - λ0);
      const y = -R * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ - λ0));

      return { x: canvasW / 2 + x, y: canvasH / 2 + y };
    },
    [camera, getGlobeRadius]
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
      const φ0   = camera.centerLat * Math.PI / 180;
      const λ0   = camera.centerLng * Math.PI / 180;
      const sinC = Math.sin(c);
      const cosC = Math.cos(c);

      const φ = Math.asin(cosC * Math.sin(φ0) + (ρ > 0 ? ny * sinC * Math.cos(φ0) / ρ : 0));
      const λ = λ0 + Math.atan2(nx * sinC, ρ * Math.cos(φ0) * cosC - ny * Math.sin(φ0) * sinC);

      return { lat: φ * 180 / Math.PI, lng: λ * 180 / Math.PI };
    },
    [camera, getGlobeRadius]
  );

  const getPlotSize = useCallback(
    (canvasW: number, canvasH: number) => {
      const R = getGlobeRadius(canvasW, canvasH);
      return Math.max(2, R / 90);
    },
    [getGlobeRadius]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let pulse = 0;
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
        const twinkle = Math.sin(pulse * star.twinkleSpeed) * 0.3 + 0.7;
        const alpha   = star.brightness * twinkle;
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
        ctx.fill();
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

      // Map image as the globe face (flat image stretched into the circle —
      // not a pixel-perfect warp, but gives the correct visual impression of
      // a globe with a visible surface texture).
      if (mapImageLoaded.current && mapImageRef.current) {
        ctx.globalAlpha = 0.45;
        ctx.drawImage(mapImageRef.current, cx - R, cy - R, R * 2, R * 2);
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillStyle = "#0a1628";
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      }

      // ── Lat/Lng grid lines using the orthographic projection ───────────────
      const gridAlpha = Math.min(0.18, 0.06 + camera.zoom * 0.015);
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

      // ── Plots ─────────────────────────────────────────────────────────────
      const plotSize   = getPlotSize(w, h);
      const playerPulse = Math.sin(pulse * 2) * 0.15 + 0.85;
      pulse += 0.02;

      const selectedPlot = selectedParcelId ? plotIndex.get(selectedParcelId) : null;

      for (let i = 0; i < parcels.length; i++) {
        const p         = parcels[i];
        const screenPos = latLngToScreen(p.lat, p.lng, w, h);
        if (!screenPos) continue; // back hemisphere — not visible
        const { x, y } = screenPos;

        const isPlayerOwned = p.ownerId && currentPlayerId && p.ownerId === currentPlayerId;
        const isEnemyOwned  = p.ownerId && !isPlayerOwned;
        const isSelected    = p.id === selectedParcelId;
        const isHovered     = p.id === hoveredPlotId;

        let size  = plotSize;
        if (isPlayerOwned) size = plotSize * 1.4;
        else if (isEnemyOwned) size = plotSize * 1.2;

        let color = COLORS.unclaimed;
        if (isSelected) {
          color = COLORS.selected;
          size  = plotSize * 1.8;
        } else if (isHovered) {
          color = isPlayerOwned ? COLORS.playerGlow : isEnemyOwned ? COLORS.enemyGlow : COLORS.hover;
          size  = plotSize * 1.5;
        } else if (isPlayerOwned) {
          const r  = parseInt(COLORS.player.slice(1, 3), 16);
          const g  = parseInt(COLORS.player.slice(3, 5), 16);
          const b  = parseInt(COLORS.player.slice(5, 7), 16);
          const pr = Math.min(255, Math.round(r * (playerPulse + 0.15)));
          const pg = Math.min(255, Math.round(g * (playerPulse + 0.15)));
          const pb = Math.min(255, Math.round(b * (playerPulse + 0.15)));
          color = `rgb(${pr},${pg},${pb})`;
        } else if (isEnemyOwned) {
          color = COLORS.enemy;
        }

        if (isPlayerOwned && !isSelected && !isHovered) {
          ctx.shadowColor = COLORS.playerGlow;
          ctx.shadowBlur  = plotSize * 0.8;
        } else if (isSelected) {
          ctx.shadowColor = "#ffffff";
          ctx.shadowBlur  = plotSize * 1.5;
        } else {
          ctx.shadowColor = "transparent";
          ctx.shadowBlur  = 0;
        }

        ctx.fillStyle = color;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);

        ctx.shadowColor = "transparent";
        ctx.shadowBlur  = 0;
      }

      // Selected plot rings
      if (selectedPlot) {
        const screenPos = latLngToScreen(selectedPlot.lat, selectedPlot.lng, w, h);
        if (screenPos) {
          const { x, y } = screenPos;
          const ringSize  = plotSize * 2.5;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth   = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, ringSize, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = "rgba(255,255,255,0.3)";
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.arc(x, y, ringSize * 1.5, 0, Math.PI * 2);
          ctx.stroke();

          selectedScreenPosRef.current = { x, y };
          const now = Date.now();
          if (now - lastPosUpdateRef.current > 50) {
            lastPosUpdateRef.current = now;
            setSelectedScreenPos({ x, y });
          }
        } else {
          if (selectedScreenPosRef.current) {
            selectedScreenPosRef.current = null;
            setSelectedScreenPos(null);
          }
        }
      } else {
        if (selectedScreenPosRef.current) {
          selectedScreenPosRef.current = null;
          setSelectedScreenPos(null);
        }
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

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [parcels, selectedParcelId, hoveredPlotId, currentPlayerId, camera, getPlotSize, getGlobeRadius, latLngToScreen, plotIndex]);

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
    if (currentPlayerId) {
      const owned = parcels.find((p) => p.ownerId === currentPlayerId);
      if (owned) centerOnPlot(owned);
    }
  }, [onLocateTerritory, currentPlayerId, parcels, centerOnPlot]);

  const handleFindEnemy = useCallback(() => {
    if (onFindEnemyTarget) onFindEnemyTarget();
  }, [onFindEnemyTarget]);

  const handleResetView = useCallback(() => {
    setCamera({ centerLat: 0, centerLng: 0, zoom: 1 });
  }, []);

  // Auto-rotate globe to bring a newly selected plot into view if it is on the back hemisphere.
  useEffect(() => {
    if (selectedParcelId) {
      const plot = plotIndex.get(selectedParcelId);
      if (plot) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect      = canvas.getBoundingClientRect();
          const screenPos = latLngToScreen(plot.lat, plot.lng, rect.width, rect.height);
          if (!screenPos) centerOnPlot(plot);
        }
      }
    }
  }, [selectedParcelId, plotIndex, latLngToScreen, centerOnPlot]);

  return (
    <div ref={containerRef} className={className} style={{ position: "relative", overflow: "hidden" }} data-testid="flat-map">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        style={{ width: "100%", height: "100%", touchAction: "none" }}
        data-testid="map-canvas"
      />

      {selectedParcelId && selectedScreenPos && (() => {
        const plot = plotIndex.get(selectedParcelId);
        if (!plot) return null;
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return null;
        const popupW = 200;
        const popupH = 140;
        let px = selectedScreenPos.x + 20;
        let py = selectedScreenPos.y - popupH / 2;
        if (px + popupW > containerRect.width  - 10) px = selectedScreenPos.x - popupW - 20;
        if (py < 10)                                  py = 10;
        if (py + popupH > containerRect.height - 10)  py = containerRect.height - popupH - 10;
        const sectorKey  = getSector(plot.lat, plot.lng);
        const sectorName = SECTOR_NAMES[sectorKey] || "Unknown Sector";
        const plotName   = getPlotName(plot.plotId, plot.biome as BiomeType);
        const ownerName  = plot.ownerId ? (playerMap.get(plot.ownerId) || "Unknown") : "Unclaimed";
        const isPlayer   = plot.ownerId === currentPlayerId;
        const isEnemy    = plot.ownerId && !isPlayer;
        const statusColor = isPlayer ? "#00ff44" : isEnemy ? "#ff2222" : "#888";
        const statusText  = isPlayer ? "YOUR BASE" : isEnemy ? "HOSTILE" : "UNCLAIMED";
        const biomeColor  = biomeColors[plot.biome as BiomeType] || "#666";

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
