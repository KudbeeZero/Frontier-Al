import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type { LandParcel } from "@shared/schema";

interface FlatMapProps {
  parcels: LandParcel[];
  selectedParcelId: string | null;
  currentPlayerId: string | null;
  onParcelSelect: (parcelId: string) => void;
  className?: string;
  onLocateTerritory?: () => void;
  onFindEnemyTarget?: () => void;
  hasOwnedPlots?: boolean;
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
}: FlatMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const [hoveredPlotId, setHoveredPlotId] = useState<string | null>(null);

  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef(0);

  const plotIndex = useMemo(() => {
    const map = new Map<string, LandParcel>();
    parcels.forEach((p) => map.set(p.id, p));
    return map;
  }, [parcels]);

  const getPlotColor = useCallback(
    (p: LandParcel) => {
      if (p.id === selectedParcelId) return COLORS.selected;
      if (p.id === hoveredPlotId) return COLORS.hover;
      if (p.ownerId) {
        if (currentPlayerId && p.ownerId === currentPlayerId) {
          return COLORS.player;
        }
        return COLORS.enemy;
      }
      return COLORS.unclaimed;
    },
    [selectedParcelId, currentPlayerId, hoveredPlotId]
  );

  const latLngToScreen = useCallback(
    (lat: number, lng: number, canvasW: number, canvasH: number) => {
      const mapW = canvasW * camera.zoom;
      const mapH = canvasH * camera.zoom;
      const x = ((lng + 180) / 360) * mapW + camera.x;
      const y = ((90 - lat) / 180) * mapH + camera.y;
      return { x, y };
    },
    [camera]
  );

  const screenToLatLng = useCallback(
    (sx: number, sy: number, canvasW: number, canvasH: number) => {
      const mapW = canvasW * camera.zoom;
      const mapH = canvasH * camera.zoom;
      const lng = ((sx - camera.x) / mapW) * 360 - 180;
      const lat = 90 - ((sy - camera.y) / mapH) * 180;
      return { lat, lng };
    },
    [camera]
  );

  const getPlotSize = useCallback(
    (canvasW: number) => {
      const baseSize = Math.max(2, (canvasW * camera.zoom) / 320);
      return baseSize;
    },
    [camera.zoom]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let pulse = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;

      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, w, h);

      const plotSize = getPlotSize(w);
      const playerPulse = Math.sin(pulse * 2) * 0.15 + 0.85;
      pulse += 0.02;

      const selectedPlot = selectedParcelId ? plotIndex.get(selectedParcelId) : null;

      for (let i = 0; i < parcels.length; i++) {
        const p = parcels[i];
        const { x, y } = latLngToScreen(p.lat, p.lng, w, h);

        if (x < -plotSize * 2 || x > w + plotSize * 2 || y < -plotSize * 2 || y > h + plotSize * 2) continue;

        const isPlayerOwned = p.ownerId && currentPlayerId && p.ownerId === currentPlayerId;
        const isEnemyOwned = p.ownerId && !isPlayerOwned;
        const isSelected = p.id === selectedParcelId;
        const isHovered = p.id === hoveredPlotId;

        let size = plotSize;
        if (isPlayerOwned) size = plotSize * 1.4;
        else if (isEnemyOwned) size = plotSize * 1.2;

        let color = COLORS.unclaimed;
        if (isSelected) {
          color = COLORS.selected;
          size = plotSize * 1.8;
        } else if (isHovered) {
          color = isPlayerOwned ? COLORS.playerGlow : isEnemyOwned ? COLORS.enemyGlow : COLORS.hover;
          size = plotSize * 1.5;
        } else if (isPlayerOwned) {
          const r = parseInt(COLORS.player.slice(1, 3), 16);
          const g = parseInt(COLORS.player.slice(3, 5), 16);
          const b = parseInt(COLORS.player.slice(5, 7), 16);
          const pr = Math.min(255, Math.round(r * (playerPulse + 0.15)));
          const pg = Math.min(255, Math.round(g * (playerPulse + 0.15)));
          const pb = Math.min(255, Math.round(b * (playerPulse + 0.15)));
          color = `rgb(${pr},${pg},${pb})`;
        } else if (isEnemyOwned) {
          color = COLORS.enemy;
        }

        if (isPlayerOwned && !isSelected && !isHovered) {
          ctx.shadowColor = COLORS.playerGlow;
          ctx.shadowBlur = plotSize * 0.8;
        } else if (isSelected) {
          ctx.shadowColor = "#ffffff";
          ctx.shadowBlur = plotSize * 1.5;
        } else {
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = color;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }

      if (selectedPlot) {
        const { x, y } = latLngToScreen(selectedPlot.lat, selectedPlot.lng, w, h);
        const ringSize = plotSize * 2.5;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, ringSize, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, ringSize * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [parcels, selectedParcelId, hoveredPlotId, currentPlayerId, camera, getPlotSize, latLngToScreen, plotIndex]);

  const findPlotAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const w = rect.width;
      const h = rect.height;
      const plotSize = getPlotSize(w);
      const hitRadius = Math.max(plotSize * 1.2, 8);

      let closest: LandParcel | null = null;
      let closestDist = Infinity;

      for (const p of parcels) {
        const { x, y } = latLngToScreen(p.lat, p.lng, w, h);
        const dx = sx - x;
        const dy = sy - y;
        const dist = dx * dx + dy * dy;
        if (dist < hitRadius * hitRadius && dist < closestDist) {
          closest = p;
          closestDist = dist;
        }
      }
      return closest;
    },
    [parcels, latLngToScreen, getPlotSize]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons > 0) {
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          isDragging.current = true;
        }
        setCamera((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
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
        if (plot) {
          onParcelSelect(plot.id);
        }
      }
      isDragging.current = false;
    },
    [findPlotAt, onParcelSelect]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;

    setCamera((prev) => {
      const newZoom = Math.max(0.5, Math.min(15, prev.zoom * zoomFactor));
      const scale = newZoom / prev.zoom;
      return {
        zoom: newZoom,
        x: mx - (mx - prev.x) * scale,
        y: my - (my - prev.y) * scale,
      };
    });
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
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current > 0) {
        const scale = dist / lastPinchDist.current;
        setCamera((prev) => ({
          ...prev,
          zoom: Math.max(0.5, Math.min(15, prev.zoom * scale)),
        }));
      }
      lastPinchDist.current = dist;
    }
  }, []);

  const centerOnPlot = useCallback(
    (plot: LandParcel) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const targetZoom = 5;
      const mapW = w * targetZoom;
      const mapH = h * targetZoom;
      const px = ((plot.lng + 180) / 360) * mapW;
      const py = ((90 - plot.lat) / 180) * mapH;
      setCamera({
        zoom: targetZoom,
        x: w / 2 - px,
        y: h / 2 - py,
      });
    },
    []
  );

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
    setCamera({ x: 0, y: 0, zoom: 1 });
  }, []);

  useEffect(() => {
    if (selectedParcelId) {
      const plot = plotIndex.get(selectedParcelId);
      if (plot) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const { x, y } = latLngToScreen(plot.lat, plot.lng, rect.width, rect.height);
          if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
            centerOnPlot(plot);
          }
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
