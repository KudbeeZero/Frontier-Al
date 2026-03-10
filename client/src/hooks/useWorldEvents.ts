import { useQuery } from "@tanstack/react-query";
import type { WorldEvent, WorldEventFilters } from "@shared/worldEvents";

async function fetchWorldEvents(filters: WorldEventFilters = {}): Promise<WorldEvent[]> {
  const params = new URLSearchParams();
  if (filters.start)  params.set("start",  String(filters.start));
  if (filters.end)    params.set("end",    String(filters.end));
  if (filters.limit)  params.set("limit",  String(filters.limit));
  if (filters.types?.length) params.set("types", filters.types.join(","));
  const res = await fetch(`/api/world/events?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export function useWorldEvents(filters: WorldEventFilters = {}) {
  const key = JSON.stringify(filters);
  return useQuery<WorldEvent[]>({
    queryKey: ["/api/world/events", key],
    queryFn: () => fetchWorldEvents(filters),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useRecentWorldEvents() {
  return useQuery<WorldEvent[]>({
    queryKey: ["/api/world/events/recent"],
    queryFn: async () => {
      const res = await fetch("/api/world/events/recent");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

export function useLiveWorldEvents() {
  return useQuery<WorldEvent[]>({
    queryKey: ["/api/world/events/live"],
    queryFn: async () => {
      const res = await fetch("/api/world/events/recent");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5_000,
    staleTime: 3_000,
  });
}
