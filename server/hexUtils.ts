export interface HexCoord {
  q: number;
  r: number;
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
