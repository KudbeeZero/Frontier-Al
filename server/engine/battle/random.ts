/**

- server/engine/battle/random.ts
- 
- Deterministic pseudo-random number generator for the FRONTIER Battle Engine.
- No crypto dependency — only pure arithmetic so outcomes are reproducible
- across both MemStorage and DbStorage.
  */

/**

- Mulberry32 — fast 32-bit PRNG with good statistical properties.
- Returns a function that yields floats in [0, 1).
- 
- @see https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
  */
  export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
  s |= 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  }

/**

- Derive a stable 32-bit integer seed from one or more string/number parts.
- Uses djb2-style hashing so the result is deterministic across JS engines.
- 
- Usage:
- const seed = hashSeed(battle.id, battle.startTs);
  */
  export function hashSeed(…parts: (string | number)[]): number {
  const combined = parts.map(String).join(”|”);
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
  hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
  }

/**

- Return a random integer in the closed interval [min, max].
  */
  export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
  }