export interface PlotCoord {
  plotId: number;
  lat: number;
  lng: number;
}

export function generateFibonacciSphere(count: number): PlotCoord[] {
  const plots: PlotCoord[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;

    const lat = Math.asin(y) * (180 / Math.PI);
    const lng = ((theta * 180) / Math.PI) % 360;
    const normalizedLng = lng > 180 ? lng - 360 : lng;

    plots.push({
      plotId: i + 1,
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
