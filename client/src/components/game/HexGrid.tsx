import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { LandParcel } from "@shared/schema";
import { biomeColors } from "@shared/schema";
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
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredParcel, setHoveredParcel] = useState<string | null>(null);

  const getCanvasSize = useCallback(() => {
    if (containerRef.current) {
      return {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      };
    }
    return { width: 800, height: 600 };
  }, []);

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

  const drawHex = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      parcel: LandParcel,
      isSelected: boolean,
      isHovered: boolean
    ) => {
      const { x: worldX, y: worldY } = axialToPixel(parcel.q, parcel.r);
      const screen = worldToScreen(worldX, worldY);
      const corners = getHexCorners(screen.x, screen.y, HEX_SIZE * scale * 0.95);

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();

      const gradient = ctx.createRadialGradient(
        screen.x,
        screen.y,
        0,
        screen.x,
        screen.y,
        HEX_SIZE * scale
      );
      const baseColor = biomeColors[parcel.biome];
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, adjustBrightness(baseColor, -30));
      ctx.fillStyle = gradient;
      ctx.fill();

      if (parcel.ownerId) {
        const isPlayerOwned = parcel.ownerId === currentPlayerId;
        const ownerColor = isPlayerOwned ? OWNER_COLORS.player : OWNER_COLORS.ai;
        
        ctx.strokeStyle = ownerColor;
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.stroke();

        if (isPlayerOwned) {
          ctx.shadowColor = ownerColor;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = ownerColor;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (isSelected) {
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#00ffff";
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (isHovered && !isSelected) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (parcel.activeBattleId) {
        ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
        ctx.fill();
        
        const pulseScale = 0.5 + 0.5 * Math.sin(Date.now() / 200);
        ctx.fillStyle = `rgba(255, 100, 100, ${0.2 * pulseScale})`;
        ctx.fill();
      }

      if (parcel.improvements.includes("fortress")) {
        drawIcon(ctx, screen.x, screen.y - 5, "fortress", scale);
      } else if (parcel.improvements.includes("mine")) {
        drawIcon(ctx, screen.x, screen.y - 5, "mine", scale);
      }

      if (parcel.defenseLevel > 5) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.font = `${10 * scale}px JetBrains Mono`;
        ctx.textAlign = "center";
        ctx.fillText(`${parcel.defenseLevel}`, screen.x, screen.y + 15 * scale);
      }
    },
    [worldToScreen, scale, currentPlayerId]
  );

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = getCanvasSize();
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim();
    ctx.fillStyle = "hsl(220 20% 6%)";
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
      drawHex(ctx, parcel, isSelected, isHovered);
    }
  }, [parcels, selectedParcelId, hoveredParcel, offset, scale, getCanvasSize, drawHex]);

  useEffect(() => {
    render();
    const animationFrame = requestAnimationFrame(function animate() {
      render();
      requestAnimationFrame(animate);
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [render]);

  useEffect(() => {
    const handleResize = () => render();
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
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.min(3, Math.max(0.3, prev * delta)));
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden bg-background cursor-grab", isDragging && "cursor-grabbing", className)}
      data-testid="hex-grid-container"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setHoveredParcel(null);
        }}
        onWheel={handleWheel}
        data-testid="hex-grid-canvas"
      />
      
      <div className="absolute bottom-4 left-4 flex items-center gap-2 p-2 backdrop-blur-md bg-card/80 border border-card-border rounded-md">
        <span className="text-xs text-muted-foreground font-mono">
          Zoom: {Math.round(scale * 100)}%
        </span>
      </div>
    </div>
  );
}

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
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

  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
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

function drawIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: string,
  scale: number
) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.font = `${12 * scale}px sans-serif`;
  ctx.textAlign = "center";
  
  if (type === "fortress") {
    ctx.fillText("⚔", x, y);
  } else if (type === "mine") {
    ctx.fillText("⛏", x, y);
  }
}
