/** Fibonacci sphere plot coordinate */
export interface PlotCoord { plotId: number; lat: number; lng: number; }

/** Short-lived mining pulse emitted by GameLayout */
export interface LivePulse {
  id: string;
  lat: number;
  lng: number;
  startMs: number;
}
