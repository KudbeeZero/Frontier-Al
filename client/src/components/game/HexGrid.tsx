import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { LandParcel } from "@shared/schema";
import { axialToPixel, getHexCorners, HEX_SIZE } from "@/lib/hexMath";

interface HexGridProps {
  parcels: LandParcel[];
  selectedParcelId: string | null;
  currentPlayerId: string | null;
  onParcelSelect: (parcelId: string) => void;
  className?: string;
}

const OWNER_COLORS = {
  player: "#00d4aa",
  ai: "#ff6b6b",
  neutral: "transparent",
};

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;

const TERRAIN_PALETTES: Record<string, { base: string; light: string; dark: string; accent: string }> = {
  forest: { base: "#2d5a27", light: "#4a8542", dark: "#1a3d18", accent: "#1e4d1a" },
  plains: { base: "#7a9e4f", light: "#a8c76a", dark: "#5a7a3a", accent: "#8fb058" },
  mountain: { base: "#6b6b7a", light: "#9a9aaa", dark: "#4a4a58", accent: "#7a7a8a" },
  desert: { base: "#c4a35a", light: "#e8c87a", dark: "#a88a45", accent: "#d4b368" },
  water: { base: "#2a6a9a", light: "#4a9acd", dark: "#1a4a6a", accent: "#3a8ab8" },
};

function seededRandom(seed: number) {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function HexGrid({
  parcels,
  selectedParcelId,
  currentPlayerId,
  onParcelSelect,
  className,
}: HexGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.7);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredParcel, setHoveredParcel] = useState<string | null>(null);
  const animationTime = useRef(0);
  const lastFrameTime = useRef(0);
  const hasWaterTiles = useRef(false);
  
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const touchStartTime = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const getCanvasSize = useCallback(() => {
    if (containerRef.current) {
      return {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      };
    }
    return { width: 800, height: 600 };
  }, []);

  const calculateMapBounds = useCallback(() => {
    if (parcels.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const parcel of parcels) {
      const { x, y } = axialToPixel(parcel.q, parcel.r);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return { minX: minX - HEX_SIZE, maxX: maxX + HEX_SIZE, minY: minY - HEX_SIZE, maxY: maxY + HEX_SIZE };
  }, [parcels]);

  const fitMapToView = useCallback(() => {
    const { width, height } = getCanvasSize();
    const bounds = calculateMapBounds();
    const mapWidth = bounds.maxX - bounds.minX;
    const mapHeight = bounds.maxY - bounds.minY;
    
    const scaleX = (width * 0.85) / mapWidth;
    const scaleY = (height * 0.85) / mapHeight;
    const newScale = Math.min(scaleX, scaleY, MAX_SCALE);
    
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    setScale(Math.max(MIN_SCALE, newScale));
    setOffset({ x: -centerX, y: -centerY });
  }, [getCanvasSize, calculateMapBounds]);

  useEffect(() => {
    if (parcels.length > 0) {
      hasWaterTiles.current = parcels.some(p => p.biome === "water");
      const timer = setTimeout(fitMapToView, 100);
      return () => clearTimeout(timer);
    }
  }, [parcels.length > 0]);

  const worldToScreen = useCallback(
    (x: number, y: number) => {
      const { width, height } = getCanvasSize();
      return {
        x: (x + offset.x) * scale + width / 2,
        y: (y + offset.y) * scale + height / 2,
      };
    },
    [offset, scale, getCanvasSize]
  );

  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      const { width, height } = getCanvasSize();
      return {
        x: (screenX - width / 2) / scale - offset.x,
        y: (screenY - height / 2) / scale - offset.y,
      };
    },
    [offset, scale, getCanvasSize]
  );

  const findParcelAtPoint = useCallback(
    (screenX: number, screenY: number): LandParcel | null => {
      const world = screenToWorld(screenX, screenY);
      
      for (const parcel of parcels) {
        const { x: cx, y: cy } = axialToPixel(parcel.q, parcel.r);
        const dx = world.x - cx;
        const dy = world.y - cy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < HEX_SIZE * 0.9) {
          return parcel;
        }
      }
      return null;
    },
    [parcels, screenToWorld]
  );

  const zoomAtPoint = useCallback((centerX: number, centerY: number, zoomFactor: number) => {
    const worldBefore = screenToWorld(centerX, centerY);
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * zoomFactor));
    
    const { width, height } = getCanvasSize();
    const newOffsetX = (centerX - width / 2) / newScale - worldBefore.x;
    const newOffsetY = (centerY - height / 2) / newScale - worldBefore.y;
    
    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  }, [scale, screenToWorld, getCanvasSize]);

  const handleZoomIn = () => {
    const { width, height } = getCanvasSize();
    zoomAtPoint(width / 2, height / 2, 1.3);
  };

  const handleZoomOut = () => {
    const { width, height } = getCanvasSize();
    zoomAtPoint(width / 2, height / 2, 0.7);
  };

  const drawTerrainTexture = useCallback((
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    hexSize: number,
    biome: string,
    seed: number,
    time: number
  ) => {
    const palette = TERRAIN_PALETTES[biome] || TERRAIN_PALETTES.plains;
    const detailScale = Math.min(1, scale);
    
    ctx.save();
    
    if (biome === "forest") {
      const treeCount = Math.floor(4 + seededRandom(seed) * 6);
      for (let i = 0; i < treeCount; i++) {
        const angle = seededRandom(seed + i) * Math.PI * 2;
        const dist = seededRandom(seed + i + 100) * hexSize * 0.6;
        const tx = cx + Math.cos(angle) * dist;
        const ty = cy + Math.sin(angle) * dist;
        const treeSize = (3 + seededRandom(seed + i + 200) * 4) * detailScale;
        
        ctx.beginPath();
        ctx.arc(tx, ty, treeSize, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? palette.dark : palette.accent;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(tx - treeSize * 0.3, ty - treeSize * 0.3, treeSize * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(palette.light, 0.4);
        ctx.fill();
      }
    } else if (biome === "mountain") {
      const peakCount = Math.floor(2 + seededRandom(seed) * 3);
      for (let i = 0; i < peakCount; i++) {
        const px = cx + (seededRandom(seed + i) - 0.5) * hexSize * 0.8;
        const py = cy + (seededRandom(seed + i + 50) - 0.5) * hexSize * 0.8;
        const peakSize = (8 + seededRandom(seed + i + 100) * 8) * detailScale;
        
        ctx.beginPath();
        ctx.moveTo(px, py - peakSize);
        ctx.lineTo(px - peakSize * 0.7, py + peakSize * 0.5);
        ctx.lineTo(px + peakSize * 0.7, py + peakSize * 0.5);
        ctx.closePath();
        ctx.fillStyle = palette.light;
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(px, py - peakSize);
        ctx.lineTo(px + peakSize * 0.7, py + peakSize * 0.5);
        ctx.lineTo(px, py + peakSize * 0.3);
        ctx.closePath();
        ctx.fillStyle = palette.dark;
        ctx.fill();
        
        if (peakSize > 10 * detailScale) {
          ctx.beginPath();
          ctx.moveTo(px, py - peakSize);
          ctx.lineTo(px - peakSize * 0.2, py - peakSize * 0.6);
          ctx.lineTo(px + peakSize * 0.2, py - peakSize * 0.5);
          ctx.closePath();
          ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
          ctx.fill();
        }
      }
    } else if (biome === "water") {
      const waveCount = 3;
      for (let i = 0; i < waveCount; i++) {
        const waveY = cy + (i - 1) * hexSize * 0.25;
        ctx.beginPath();
        ctx.moveTo(cx - hexSize * 0.7, waveY);
        
        for (let x = -0.7; x <= 0.7; x += 0.1) {
          const wx = cx + x * hexSize;
          const wy = waveY + Math.sin(x * 6 + time + i) * 2 * detailScale;
          ctx.lineTo(wx, wy);
        }
        
        ctx.strokeStyle = i === 1 ? hexToRgba(palette.light, 0.4) : hexToRgba(palette.accent, 0.25);
        ctx.lineWidth = 1.5 * detailScale;
        ctx.stroke();
      }
      
      const sparkleCount = Math.floor(2 + seededRandom(seed) * 3);
      for (let i = 0; i < sparkleCount; i++) {
        const sx = cx + (seededRandom(seed + i) - 0.5) * hexSize;
        const sy = cy + (seededRandom(seed + i + 50) - 0.5) * hexSize * 0.6;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 * detailScale, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fill();
      }
    } else if (biome === "desert") {
      const duneCount = Math.floor(2 + seededRandom(seed) * 2);
      for (let i = 0; i < duneCount; i++) {
        const dx = cx + (seededRandom(seed + i) - 0.5) * hexSize * 0.6;
        const dy = cy + (seededRandom(seed + i + 50) - 0.3) * hexSize * 0.6;
        const duneWidth = (15 + seededRandom(seed + i + 100) * 10) * detailScale;
        const duneHeight = (3 + seededRandom(seed + i + 150) * 3) * detailScale;
        
        ctx.beginPath();
        ctx.moveTo(dx - duneWidth, dy);
        ctx.quadraticCurveTo(dx, dy - duneHeight, dx + duneWidth, dy);
        ctx.strokeStyle = hexToRgba(palette.light, 0.5);
        ctx.lineWidth = 2 * detailScale;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(dx - duneWidth * 0.8, dy + 2);
        ctx.quadraticCurveTo(dx, dy + 2 + duneHeight * 0.5, dx + duneWidth * 0.8, dy + 2);
        ctx.strokeStyle = hexToRgba(palette.dark, 0.4);
        ctx.lineWidth = 1.5 * detailScale;
        ctx.stroke();
      }
    } else if (biome === "plains") {
      const grassCount = Math.floor(6 + seededRandom(seed) * 8);
      for (let i = 0; i < grassCount; i++) {
        const gx = cx + (seededRandom(seed + i) - 0.5) * hexSize * 0.8;
        const gy = cy + (seededRandom(seed + i + 50) - 0.5) * hexSize * 0.8;
        const grassHeight = (4 + seededRandom(seed + i + 100) * 4) * detailScale;
        
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx - 1, gy - grassHeight);
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + 1, gy - grassHeight * 0.8);
        ctx.strokeStyle = hexToRgba(palette.dark, 0.5);
        ctx.lineWidth = 1 * detailScale;
        ctx.stroke();
      }
    }
    
    ctx.restore();
  }, [scale]);

  const drawHex = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      parcel: LandParcel,
      isSelected: boolean,
      isHovered: boolean,
      time: number
    ) => {
      const { x: worldX, y: worldY } = axialToPixel(parcel.q, parcel.r);
      const screen = worldToScreen(worldX, worldY);
      const hexScale = HEX_SIZE * scale * 0.95;
      const corners = getHexCorners(screen.x, screen.y, hexScale);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();
      ctx.clip();

      const palette = TERRAIN_PALETTES[parcel.biome] || TERRAIN_PALETTES.plains;
      const gradient = ctx.createRadialGradient(
        screen.x - hexScale * 0.3,
        screen.y - hexScale * 0.3,
        0,
        screen.x,
        screen.y,
        hexScale * 1.2
      );
      gradient.addColorStop(0, palette.light);
      gradient.addColorStop(0.4, palette.base);
      gradient.addColorStop(1, palette.dark);
      ctx.fillStyle = gradient;
      ctx.fillRect(screen.x - hexScale, screen.y - hexScale, hexScale * 2, hexScale * 2);

      const seed = parcel.q * 1000 + parcel.r;
      drawTerrainTexture(ctx, screen.x, screen.y, hexScale, parcel.biome, seed, time);

      ctx.restore();

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();

      if (parcel.ownerId) {
        const isPlayerOwned = parcel.ownerId === currentPlayerId;
        const ownerColor = isPlayerOwned ? OWNER_COLORS.player : OWNER_COLORS.ai;
        
        ctx.strokeStyle = ownerColor;
        ctx.lineWidth = isSelected ? 4 : 3;
        ctx.stroke();

        if (isPlayerOwned) {
          ctx.shadowColor = ownerColor;
          ctx.shadowBlur = 12;
          ctx.strokeStyle = ownerColor;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (isSelected) {
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 4;
        ctx.shadowColor = "#00ffff";
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (isHovered && !isSelected) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (parcel.activeBattleId) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 6; i++) {
          ctx.lineTo(corners[i].x, corners[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 50, 50, 0.3)";
        ctx.fill();
        ctx.restore();
      }

      if (parcel.defenseLevel > 1 && scale > 0.5) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.font = `bold ${Math.max(10, 12 * scale)}px JetBrains Mono`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 4;
        ctx.fillText(`${parcel.defenseLevel}`, screen.x, screen.y + hexScale * 0.35);
        ctx.shadowBlur = 0;
      }

      if (parcel.improvements && parcel.improvements.length > 0 && scale > 0.4) {
        const impIcons: Record<string, string> = {
          turret: "\u25B2",
          shield_gen: "\u25C6",
          mine_drill: "\u25BC",
          storage_depot: "\u25A0",
          radar: "\u25CE",
          fortress: "\u2605",
        };
        const iconSize = Math.max(8, 10 * scale);
        const spacing = iconSize * 1.4;
        const startX = screen.x - ((parcel.improvements.length - 1) * spacing) / 2;
        const iconY = screen.y - hexScale * 0.3;

        for (let i = 0; i < parcel.improvements.length; i++) {
          const imp = parcel.improvements[i];
          const ix = startX + i * spacing;

          ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
          ctx.beginPath();
          ctx.arc(ix, iconY, iconSize * 0.6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = imp.type === "turret" ? "#ff6b6b" :
                          imp.type === "shield_gen" ? "#6bc5ff" :
                          imp.type === "mine_drill" ? "#ffb86b" :
                          imp.type === "storage_depot" ? "#b8b8b8" :
                          imp.type === "radar" ? "#6bff9a" :
                          "#ffd700";
          ctx.font = `bold ${iconSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(impIcons[imp.type] || "\u2022", ix, iconY);
        }
      }

      if (parcel.ironStored + parcel.fuelStored + parcel.crystalStored > 0 && parcel.ownerId && scale > 0.5) {
        const total = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
        const pct = total / parcel.storageCapacity;
        const barWidth = hexScale * 0.8;
        const barHeight = 3 * Math.min(1, scale);
        const barX = screen.x - barWidth / 2;
        const barY = screen.y + hexScale * 0.5;

        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = pct > 0.8 ? "#ff6b6b" : pct > 0.5 ? "#ffb86b" : "#6bff9a";
        ctx.fillRect(barX, barY, barWidth * pct, barHeight);
      }
    },
    [worldToScreen, scale, currentPlayerId, drawTerrainTexture]
  );

  const render = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = getCanvasSize();
    const dpr = window.devicePixelRatio || 1;
    
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, "hsl(220 25% 8%)");
    bgGradient.addColorStop(1, "hsl(220 20% 5%)");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    drawGridBackground(ctx, width, height, offset, scale);

    const sortedParcels = [...parcels].sort((a, b) => {
      if (a.id === selectedParcelId) return 1;
      if (b.id === selectedParcelId) return -1;
      return 0;
    });

    for (const parcel of sortedParcels) {
      const isSelected = parcel.id === selectedParcelId;
      const isHovered = parcel.id === hoveredParcel;
      drawHex(ctx, parcel, isSelected, isHovered, time);
    }
  }, [parcels, selectedParcelId, hoveredParcel, offset, scale, getCanvasSize, drawHex]);

  useEffect(() => {
    let animationId: number;
    let isRunning = true;
    
    const animate = (timestamp: number) => {
      if (!isRunning) return;
      
      const deltaTime = timestamp - lastFrameTime.current;
      
      if (hasWaterTiles.current) {
        animationTime.current = timestamp * 0.001;
        render(animationTime.current);
        animationId = requestAnimationFrame(animate);
      } else {
        if (deltaTime > 100 || lastFrameTime.current === 0) {
          render(0);
          lastFrameTime.current = timestamp;
        }
      }
    };
    
    render(animationTime.current);
    
    if (hasWaterTiles.current) {
      animationId = requestAnimationFrame(animate);
    }
    
    return () => {
      isRunning = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [render]);

  useEffect(() => {
    if (!hasWaterTiles.current) {
      render(0);
    }
  }, [offset, scale, selectedParcelId, hoveredParcel, parcels]);

  useEffect(() => {
    const handleResize = () => render(animationTime.current);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [render]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setOffset((prev) => ({
        x: prev.x + dx / scale,
        y: prev.y + dy / scale,
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      const parcel = findParcelAtPoint(x, y);
      setHoveredParcel(parcel?.id || null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = Math.abs(e.clientX - dragStart.x);
      const dy = Math.abs(e.clientY - dragStart.y);
      
      if (dx < 5 && dy < 5) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const parcel = findParcelAtPoint(x, y);
          if (parcel) {
            onParcelSelect(parcel.id);
          }
        }
      }
    }
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    
    zoomAtPoint(x, y, delta);
  };

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 1) {
      touchStartTime.current = Date.now();
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      lastTouchDistance.current = getTouchDistance(e.touches);
      lastTouchCenter.current = getTouchCenter(e.touches);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStart.x;
      const dy = e.touches[0].clientY - dragStart.y;
      setOffset((prev) => ({
        x: prev.x + dx / scale,
        y: prev.y + dy / scale,
      }));
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      const currentDistance = getTouchDistance(e.touches);
      const currentCenter = getTouchCenter(e.touches);
      
      if (lastTouchDistance.current !== null && lastTouchCenter.current !== null) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const centerX = currentCenter.x - rect.left;
          const centerY = currentCenter.y - rect.top;
          
          const distanceDelta = currentDistance / lastTouchDistance.current;
          zoomAtPoint(centerX, centerY, distanceDelta);
        }
      }
      
      lastTouchDistance.current = currentDistance;
      lastTouchCenter.current = currentCenter;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartPos.current && e.changedTouches.length === 1) {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = Math.abs(endX - touchStartPos.current.x);
      const dy = Math.abs(endY - touchStartPos.current.y);
      const elapsed = Date.now() - touchStartTime.current;
      
      if (dx < 15 && dy < 15 && elapsed < 300) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = endX - rect.left;
          const y = endY - rect.top;
          const parcel = findParcelAtPoint(x, y);
          if (parcel) {
            onParcelSelect(parcel.id);
          }
        }
      }
    }
    
    setIsDragging(false);
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
    touchStartPos.current = null;
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden bg-background touch-none", className)}
      data-testid="hex-grid-container"
    >
      <canvas
        ref={canvasRef}
        className={cn("w-full h-full", isDragging ? "cursor-grabbing" : "cursor-grab")}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setHoveredParcel(null);
        }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-testid="hex-grid-canvas"
      />
      
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomIn}
          className="h-10 w-10 bg-card/90 backdrop-blur-sm border border-card-border shadow-lg"
          data-testid="button-zoom-in"
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomOut}
          className="h-10 w-10 bg-card/90 backdrop-blur-sm border border-card-border shadow-lg"
          data-testid="button-zoom-out"
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={fitMapToView}
          className="h-10 w-10 bg-card/90 backdrop-blur-sm border border-card-border shadow-lg"
          data-testid="button-fit-map"
        >
          <Maximize2 className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="absolute bottom-4 left-4 px-3 py-1.5 backdrop-blur-md bg-card/80 border border-card-border rounded-md">
        <span className="text-xs text-muted-foreground font-mono">
          {Math.round(scale * 100)}%
        </span>
      </div>
    </div>
  );
}

function drawGridBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offset: { x: number; y: number },
  scale: number
) {
  const gridSize = 50 * scale;
  const startX = (offset.x * scale + width / 2) % gridSize;
  const startY = (offset.y * scale + height / 2) % gridSize;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
  ctx.lineWidth = 1;

  for (let x = startX; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = startY; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}
