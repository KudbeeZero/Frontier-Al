/**
 * OrbitalCanvas.tsx
 *
 * Lightweight canvas overlay that renders cosmetic orbital streaks on the 2D
 * FlatMap view. Uses screen-space coordinates (no lat/lng projection) since
 * meteors/comets are sky phenomena that cross the full viewport.
 *
 * Design constraints:
 *  - Positioned absolutely on top of FlatMap, pointer-events: none
 *  - No WebGL — plain 2D canvas with globalCompositeOperation additive blend
 *  - Mobile-safe: max 4 concurrent streaks, no heavy fill ops
 *  - Does NOT affect tabIndex or tap-highlight (no DOM interaction)
 */

import { useRef, useEffect } from "react";
import type { OrbitalEvent } from "@shared/schema";

const STREAK_COLORS: Record<string, [number, number, number]> = {
  METEOR_SHOWER:    [255, 153, 68],
  SINGLE_BOLIDE:    [255, 204, 34],
  COMET_PASS:       [170, 221, 255],
  ORBITAL_DEBRIS:   [200, 200, 200],
  ATMOSPHERIC_BURST:[255, 102, 136],
  IMPACT_STRIKE:    [255, 34, 68],
};

interface StreakState {
  id: string;
  // Normalized screen coords [0,1]
  x0: number; y0: number;
  x1: number; y1: number;
  color: [number, number, number];
  t: number;          // current progress [0,1]
  duration: number;   // total ms
  startMs: number;
  intensity: number;
  isImpact: boolean;
}

/** Simple seeded float from a seed value (no state needed). */
function seededFloat(seed: number, offset: number): number {
  const x = Math.sin(seed + offset) * 10000;
  return x - Math.floor(x);
}

interface OrbitalCanvasProps {
  events: OrbitalEvent[];
  className?: string;
}

export function OrbitalCanvas({ events, className }: OrbitalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const streaksRef = useRef<StreakState[]>([]);

  // Sync events → streak state
  useEffect(() => {
    const now = Date.now();
    // Remove expired streaks
    streaksRef.current = streaksRef.current.filter(
      (s) => now < s.startMs + s.duration
    );

    // Add new events that don't already have a streak
    const existingIds = new Set(streaksRef.current.map((s) => s.id));
    for (const evt of events) {
      if (existingIds.has(evt.id)) continue;
      if (evt.startAt > now || evt.endAt < now) continue;

      const seed  = evt.seed;
      const color = STREAK_COLORS[evt.type] ?? [255, 255, 255];

      // Generate random screen-space trajectory from seed
      // (same seed → same visual on all clients for cosmetic events)
      const x0 = seededFloat(seed, 1);
      const y0 = seededFloat(seed, 2) * 0.6; // start in upper 60%
      const x1 = x0 + (seededFloat(seed, 3) - 0.3) * 0.8; // diagonal drift
      const y1 = y0 + seededFloat(seed, 4) * 0.5 + 0.2;   // moves downward

      streaksRef.current.push({
        id:        evt.id,
        x0, y0, x1: Math.max(0, Math.min(1, x1)), y1: Math.max(0, Math.min(1, y1)),
        color,
        t:         Math.max(0, (now - evt.startAt) / (evt.endAt - evt.startAt)),
        duration:  evt.endAt - evt.startAt,
        startMs:   evt.startAt,
        intensity: evt.intensity,
        isImpact:  !evt.cosmetic,
      });
    }
  }, [events]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;

      const W = canvas!.width;
      const H = canvas!.height;
      const now = Date.now();

      ctx.clearRect(0, 0, W, H);

      const activeStreaks = streaksRef.current.filter(
        (s) => now < s.startMs + s.duration
      );

      for (const s of activeStreaks) {
        const rawT = Math.min(1, (now - s.startMs) / s.duration);
        // Ease-in to look like acceleration
        const t = rawT * rawT;

        // Trail: head at t, tail at max(0, t - trailLen)
        const trailLen = 0.08 + s.intensity * 0.15;
        const headT    = t;
        const tailT    = Math.max(0, headT - trailLen);

        const hx = (s.x0 + (s.x1 - s.x0) * headT) * W;
        const hy = (s.y0 + (s.y1 - s.y0) * headT) * H;
        const tx = (s.x0 + (s.x1 - s.x0) * tailT) * W;
        const ty = (s.y0 + (s.y1 - s.y0) * tailT) * H;

        // Fade out in last 20% of duration
        const alpha = rawT > 0.8
          ? (1 - rawT) / 0.2 * s.intensity
          : Math.min(1, rawT / 0.05) * s.intensity;

        const [r, g, b] = s.color;
        const gradient  = ctx.createLinearGradient(tx, ty, hx, hy);
        gradient.addColorStop(0, `rgba(${r},${g},${b},0)`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},${alpha.toFixed(2)})`);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle  = gradient;
        ctx.lineWidth    = s.isImpact ? 3 : Math.max(1, s.intensity * 2);
        ctx.lineCap      = "round";
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();

        // Impact: draw a small glow at the head
        if (s.isImpact && rawT > 0.7) {
          const glowAlpha = ((rawT - 0.7) / 0.3) * alpha;
          ctx.globalAlpha = glowAlpha;
          ctx.fillStyle   = `rgb(${r},${g},${b})`;
          ctx.beginPath();
          ctx.arc(hx, hy, 4 * s.intensity, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Clean up expired streaks
      streaksRef.current = activeStreaks;

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        canvas.width  = e.contentRect.width;
        canvas.height = e.contentRect.height;
      }
    });
    const parent = canvas.parentElement;
    if (parent) obs.observe(parent);
    return () => obs.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position:              "absolute",
        inset:                 0,
        width:                 "100%",
        height:                "100%",
        pointerEvents:         "none",
        // No outline / tap highlight so we don't affect FlatMap touch handling
        outline:               "none",
        WebkitTapHighlightColor: "transparent",
        zIndex:                5,
      }}
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}
