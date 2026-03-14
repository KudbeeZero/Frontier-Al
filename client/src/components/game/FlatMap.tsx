import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type { LandParcel, BiomeType } from "@shared/schema";

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
  unclaimed: "#00ff44",    // green — visible but dim
  selected: "#00ff44",     // green when selected (owned or not)
  selectedGlow: "#00ff88",
  hover: "#00cc33",        // dim green hover
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

  const [camera, setCamera] = useState({ centerLat: 0, centerLng: 0, zoom: 1 });
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

  const getGlobeRadius = useCallback(
    (canvasW: number, canvasH: number) => {
      return Math.min(canvasW, canvasH) / 2 * cameraRef.current.zoom * 0.9;
    },
    []
  );

  const latLngToScreen = useCallback(
    (lat: number, lng: number, canvasW: number, canvasH: number): { x: number; y: number } | null => {
      const R = getGlobeRadius(canvasW, canvasH);
      const φ  = lat  * Math.PI / 180;
      const λ  = lng  * Math.PI / 180;
      const φ0 = cameraRef.current.centerLat * Math.PI / 180;
      const λ0 = cameraRef.current.centerLng * Math.PI / 180;

      const cosC =
        Math.sin(φ0) * Math.sin(φ) +
        Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0);
      if (cosC < 0) return null;

      const x = R * Math.cos(φ) * Math.sin(λ - λ0);
      const y = -R * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ - λ0));

      return { x: canvasW / 2 + x, y: canvasH / 2 + y };
    },
    [getGlobeRadius]
  );

  const screenToLatLng = useCallback(
    (sx: number, sy: number, canvasW: number, canvasH: number): { lat: number; lng: number } | null => {
      const R  = getGlobeRadius(canvasW, canvasH);
      const nx = (sx - canvasW / 2) / R;
      const ny = -(sy - canvasH / 2) / R;
      const ρ  = Math.sqrt(nx * nx + ny * ny);
      if (ρ > 1) return null;

      const c    = Math.asin(Math.min(1, ρ));
      const φ0   = cameraRef.current.centerLat * Math.PI / 180;
      const λ0   = cameraRef.current.centerLng * Math.PI / 180;
      const sinC = Math.sin(c);
      const cosC = Math.cos(c);

      const φ = Math.asin(cosC * Math.sin(φ0) + (ρ > 0 ? ny * sinC * Math.cos(φ0) / ρ : 0));
      const λ = λ0 + Math.atan2(nx * sinC, ρ * Math.cos(φ0) * cosC - ny * Math.sin(φ0) * sinC);

      return { lat: φ * 180 / Math.PI, lng: λ * 180 / Math.PI };
    },
    [getGlobeRadius]
  );

  const getPlotSize = useCallback(
    (canvasW: number, canvasH: number) => {
      const R = getGlobeRadius(canvasW, canvasH);
      return Math.max(3, R / 55);
    },
    [getGlobeRadius]
  );

  const findPlotAt = useCallback(
    (sx: number, sy: number) => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      
      const localX = sx - rect.left;
      const localY = sy - rect.top;
      
      const w = rect.width;
      const h = rect.height;

      const latLng = screenToLatLng(localX, localY, w, h);
      if (!latLng) return null;

      const plotSize = getPlotSize(w, h);
      const hitRadiusSq = Math.pow(Math.max(plotSize * 2.2, 18), 2);
      let closest = null;
      let minDistSq = Infinity;

      for (const p of parcels) {
        const s = latLngToScreen(p.lat, p.lng, w, h);
        if (!s) continue;
        const dx = localX - s.x;
        const dy = localY - s.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < hitRadiusSq && distSq < minDistSq) {
          minDistSq = distSq;
          closest = p;
        }
      }
      return closest;
    },
    [parcels, screenToLatLng, getPlotSize, latLngToScreen]
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
      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const R = getGlobeRadius(w, h);

      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, w, h);

      for (const star of stars) {
        ctx.fillStyle = `rgba(200, 220, 255, ${star.brightness})`;
        ctx.beginPath();
        ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

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
        const ss = shootingStars[i];
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life++;
        const alpha = 1 - ss.life / ss.maxLife;
        if (alpha <= 0) { shootingStars.splice(i, 1); continue; }
        const tailX = ss.x - ss.vx * 8;
        const tailY = ss.y - ss.vy * 8;
        const grad = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
        grad.addColorStop(1, `rgba(150, 200, 255, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }

      const atmosGrad = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.14);
      atmosGrad.addColorStop(0, "rgba(40, 120, 255, 0.50)");
      atmosGrad.addColorStop(0.4, "rgba(20, 80, 200, 0.20)");
      atmosGrad.addColorStop(1, "rgba(10, 40, 120, 0)");
      ctx.fillStyle = atmosGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      if (mapImageLoaded.current && mapImageRef.current) {
        ctx.globalAlpha = 0.9;
        ctx.drawImage(mapImageRef.current, cx - R, cy - R, R * 2, R * 2);
        if (nightImageLoaded.current && nightImageRef.current) {
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = 0.5;
          ctx.drawImage(nightImageRef.current, cx - R, cy - R, R * 2, R * 2);
          ctx.globalCompositeOperation = "source-over";
        }
        if (cloudsImageLoaded.current && cloudsImageRef.current) {
          ctx.globalAlpha = 0.25;
          ctx.drawImage(cloudsImageRef.current, cx - R, cy - R, R * 2, R * 2);
        }
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillStyle = "#0a1628";
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      }

      const gridAlpha = Math.min(0.08, 0.02 + cameraRef.current.zoom * 0.005);
      ctx.strokeStyle = `rgba(100, 200, 255, ${gridAlpha})`;
      ctx.lineWidth = 0.5;
      const drawGlobeGridLine = (pts: { lat: number; lng: number }[]) => {
        let started = false;
        ctx.beginPath();
        for (const pt of pts) {
          const s = latLngToScreen(pt.lat, pt.lng, w, h);
          if (!s) { started = false; continue; }
          if (!started) { ctx.moveTo(s.x, s.y); started = true; }
          else ctx.lineTo(s.x, s.y);
        }
        ctx.stroke();
      };
      for (let lng = -150; lng <= 180; lng += 30) {
        const pts = [];
        for (let lat = -90; lat <= 90; lat += 3) pts.push({ lat, lng });
        drawGlobeGridLine(pts);
      }

      const plotSize = getPlotSize(w, h);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      const playerPulse = 0.5 + Math.sin(Date.now() / 400) * 0.2;

      for (let i = 0; i < parcels.length; i++) {
        const p = parcels[i];
        const screenPos = latLngToScreen(p.lat, p.lng, w, h);
        if (!screenPos) continue;
        const { x, y } = screenPos;

        const isPlayerOwned = p.ownerId && currentPlayerId && p.ownerId === currentPlayerId;
        const isEnemyOwned = p.ownerId && !isPlayerOwned;
        const isSelected = p.id === selectedParcelId;
        const isHovered = p.id === hoveredPlotId;

        let size = plotSize;
        if (isPlayerOwned) size = plotSize * 1.4;
        else if (isEnemyOwned) size = plotSize * 1.2;

        let color = COLORS.unclaimed;
        let plotAlpha = 0.25;  // unclaimed: dim but visible green

        if (isSelected) {
          // Always show green when selected — same whether owned or not
          color = COLORS.player;
          size = plotSize * 1.8;
          plotAlpha = 0.9;
        } else if (isHovered) {
          color = COLORS.hover;
          size = plotSize * 1.5;
          plotAlpha = 0.75;
        } else if (isPlayerOwned) {
          const r = parseInt(COLORS.player.slice(1, 3), 16);
          const g = parseInt(COLORS.player.slice(3, 5), 16);
          const b = parseInt(COLORS.player.slice(5, 7), 16);
          const pr = Math.min(255, Math.round(r * (playerPulse + 0.15)));
          const pg = Math.min(255, Math.round(g * (playerPulse + 0.15)));
          const pb = Math.min(255, Math.round(b * (playerPulse + 0.15)));
          color = `rgb(${pr},${pg},${pb})`;
          plotAlpha = 0.7;
        } else if (isEnemyOwned) {
          color = COLORS.enemy;
          plotAlpha = 0.7;
        }

        if (isSelected) {
          ctx.shadowColor = COLORS.selectedGlow;
          ctx.shadowBlur = plotSize * 0.8;
        } else if (isPlayerOwned && !isHovered) {
          ctx.shadowColor = COLORS.playerGlow;
          ctx.shadowBlur = plotSize * 0.8;
        }

        ctx.globalAlpha = plotAlpha;
        if (isSelected) {
          ctx.strokeStyle = COLORS.player;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      }

      const selectedPlot = parcels.find(p => p.id === selectedParcelId);
      if (selectedPlot) {
        const screenPos = latLngToScreen(selectedPlot.lat, selectedPlot.lng, w, h);
        if (screenPos) {
          const { x, y } = screenPos;
          const ringSize = plotSize * 2.6;
          ctx.strokeStyle = `rgba(0,255,68,0.85)`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, ringSize, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = `rgba(0,255,68,0.25)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, ringSize * 1.45, 0, Math.PI * 2);
          ctx.stroke();

          selectedScreenPosRef.current = { x, y };
          const nowTs = Date.now();
          if (nowTs - lastPosUpdateRef.current > 50) {
            lastPosUpdateRef.current = nowTs;
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

      const limbGrad = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
      limbGrad.addColorStop(0, "rgba(0,0,0,0)");
      limbGrad.addColorStop(0.72, "rgba(0,0,10,0.08)");
      limbGrad.addColorStop(0.88, "rgba(0,5,30,0.42)");
      limbGrad.addColorStop(1.0, "rgba(0,10,40,0.82)");
      ctx.fillStyle = limbGrad;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      ctx.restore();

      ctx.strokeStyle = "rgba(60, 140, 255, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      const sats = orbitalSatsRef.current;
      for (const sat of sats) {
        sat.angle += sat.speed;
        sat.scanAngle += 0.03;
        const orbitR = R * sat.orbitRadius;
        const tiltY = Math.sin(sat.angle + sat.inclinationPhase) * sat.inclination;
        const sx = cx + Math.cos(sat.angle) * orbitR;
        const sy = cy + Math.sin(sat.angle) * orbitR * 0.35 + tiltY * orbitR * 0.4;
        const isBehind = Math.sin(sat.angle) > 0.15 && Math.abs(Math.cos(sat.angle)) < 0.85;
        sat.trailPositions.unshift({ x: sx, y: sy, alpha: isBehind ? 0.25 : 0.95 });
        if (sat.trailPositions.length > 18) sat.trailPositions.pop();
        if (sat.trailPositions.length > 1) {
          for (let ti = 1; ti < sat.trailPositions.length; ti++) {
            const t0 = sat.trailPositions[ti - 1];
            const t1 = sat.trailPositions[ti];
            const fade = 1 - ti / sat.trailPositions.length;
            ctx.strokeStyle = `rgba(0, 180, 255, ${fade * 0.35 * Math.min(t0.alpha, t1.alpha)})`;
            ctx.lineWidth = 2 * fade;
            ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.stroke();
          }
        }
        if (!isBehind) {
          const scanLen = sat.size * 3;
          const scanEndX = sx + Math.cos(sat.scanAngle) * scanLen;
          const scanEndY = sy + Math.sin(sat.scanAngle) * scanLen;
          const scanGrad = ctx.createLinearGradient(sx, sy, scanEndX, scanEndY);
          scanGrad.addColorStop(0, "rgba(0, 255, 200, 0.25)");
          scanGrad.addColorStop(1, "rgba(0, 255, 200, 0)");
          ctx.strokeStyle = scanGrad; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(scanEndX, scanEndY); ctx.stroke();
          ctx.fillStyle = "rgba(0, 200, 255, 0.8)";
          ctx.beginPath(); ctx.arc(sx, sy, sat.size / 8, 0, Math.PI * 2); ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [parcels, selectedParcelId, hoveredPlotId, currentPlayerId, getGlobeRadius, latLngToScreen, getPlotSize]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging.current = true;
    if (isDragging.current) {
      setCamera(prev => ({
        ...prev,
        centerLng: prev.centerLng - dx * (0.2 / prev.zoom),
        centerLat: Math.max(-85, Math.min(85, prev.centerLat + dy * (0.2 / prev.zoom))),
      }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    } else {
      const plot = findPlotAt(e.clientX, e.clientY);
      setHoveredPlotId(plot?.id || null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) {
      const plot = findPlotAt(e.clientX, e.clientY);
      if (plot) onParcelSelect(plot.id);
    }
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setCamera(prev => ({ ...prev, zoom: Math.max(0.8, Math.min(8, prev.zoom * delta)) }));
  };

  const handleResetView = () => setCamera({ centerLat: 0, centerLng: 0, zoom: 1 });

  const selectedPlot = parcels.find(p => p.id === selectedParcelId);

  const renderPopup = () => {
    if (!selectedPlot || !selectedScreenPos) return null;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const popupW = 160;
    const popupH = 110;
    const margin = 18;

    let px;
    let py;

    if (selectedScreenPos.x > rect.width / 2) {
      px = selectedScreenPos.x - popupW - margin;
    } else {
      px = selectedScreenPos.x + margin;
    }

    if (selectedScreenPos.y > rect.height / 2) {
      py = selectedScreenPos.y - popupH - margin;
    } else {
      py = selectedScreenPos.y + margin;
    }

    px = Math.max(10, Math.min(px, rect.width - popupW - 10));
    py = Math.max(10, Math.min(py, rect.height - popupH - 10));

    return (
      <div
        className="absolute pointer-events-none z-20"
        style={{ left: px, top: py }}
      >
        <div className="bg-card/90 backdrop-blur-md border border-primary/30 p-2.5 rounded shadow-2xl min-w-[160px]">
          <div className="text-[10px] font-display uppercase tracking-widest text-primary/70 mb-0.5">
            Sector {getSector(selectedPlot.lat, selectedPlot.lng)}
          </div>
          <div className="text-xs font-display uppercase tracking-wider text-foreground mb-1">
            {getPlotName(selectedPlot.plotId, selectedPlot.biome)}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] uppercase text-muted-foreground">{selectedPlot.biome}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`relative overflow-hidden cursor-crosshair ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="block"
      />
      {renderPopup()}
      <div className="absolute bottom-20 right-3 z-10 flex flex-col gap-2">
        <button
          onClick={handleResetView}
          className="p-2 bg-background/60 backdrop-blur border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
