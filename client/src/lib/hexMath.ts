import type { HexCoord } from "@shared/schema";

export const HEX_SIZE = 40;
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
export const HEX_HEIGHT = 2 * HEX_SIZE;

export function axialToPixel(q: number, r: number): { x: number; y: number } {
  const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = HEX_SIZE * ((3 / 2) * r);
  return { x, y };
}

export function pixelToAxial(x: number, y: number): HexCoord {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / HEX_SIZE;
  const r = ((2 / 3) * y) / HEX_SIZE;
  return { q: Math.round(q), r: Math.round(r) };
}

export function cubeRound(x: number, y: number, z: number): { x: number; y: number; z: number } {
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { x: rx, y: ry, z: rz };
}

export function getHexCorners(cx: number, cy: number, size: number): { x: number; y: number }[] {
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: cx + size * Math.cos(angleRad),
      y: cy + size * Math.sin(angleRad),
    });
  }
  return corners;
}

export function getHexNeighbors(q: number, r: number): HexCoord[] {
  const directions = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];
  return directions.map((d) => ({ q: q + d.q, r: r + d.r }));
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export function generateHexGrid(radius: number): HexCoord[] {
  const hexes: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      hexes.push({ q, r });
    }
  }
  return hexes;
}
