export interface PlotCoord {
  plotId: number;
  lat: number;
  lng: number;
}

/**
 * Plots above this latitude (abs) are excluded to create the clean circular
 * polar voids visible on the globe — both north and south caps are empty.
 */
export const POLAR_EXCLUSION_LAT = 75;

/**
 * Generates a Fibonacci sphere distribution of exactly `count` plots,
 * excluding the polar caps (|lat| > POLAR_EXCLUSION_LAT).
 *
 * We over-generate candidate points and accept only those in the playable
 * latitude band, stopping once we have exactly `count` valid plots.
 * The golden-angle spiral ensures near-uniform density across the globe.
 */
export function generateFibonacciSphere(count: number): PlotCoord[] {
  const plots: PlotCoord[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  // Over-generate: polar caps cover ~sin(75°) ≈ 96.6% of the sphere by area,
  // so we lose ~3.4% of points. A 1.1× multiplier gives comfortable headroom.
  const candidates = Math.ceil(count * 1.1);

  for (let i = 0; i < candidates && plots.length < count; i++) {
    const y = 1 - (i / (candidates - 1)) * 2;
    const theta = goldenAngle * i;

    const lat = Math.asin(y) * (180 / Math.PI);
    if (Math.abs(lat) > POLAR_EXCLUSION_LAT) continue; // skip polar caps

    const lng = ((theta * 180) / Math.PI) % 360;
    const normalizedLng = lng > 180 ? lng - 360 : lng;

    plots.push({
      plotId: plots.length + 1,
      lat,
      lng: normalizedLng,
    });
  }

  return plots;
}

export function sphereDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearbyPlots(
  targetLat: number,
  targetLng: number,
  allPlots: PlotCoord[],
  maxDistance: number = 0.05
): PlotCoord[] {
  return allPlots.filter((p) => {
    const dist = sphereDistance(targetLat, targetLng, p.lat, p.lng);
    return dist > 0 && dist < maxDistance;
  });
}
