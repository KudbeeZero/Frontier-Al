import { Buffer } from "buffer";

if (typeof window !== "undefined") {
  if (!window.Buffer) window.Buffer = Buffer;
  if (!window.global) window.global = globalThis;
}

if (typeof globalThis.Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}

if (typeof (globalThis as any).process === "undefined") {
  (globalThis as any).process = { env: {}, version: "", browser: true };
}

// ── API base-URL interceptor ─────────────────────────────────────────────────
// In production (split-host deployment) set VITE_API_URL to the backend origin
// (e.g. https://frontier-api.onrender.com).  All relative /api, /nft, and
// /faction requests will be transparently rewritten to absolute URLs so the
// Vercel-hosted SPA can reach the separate Node/Express server.
// No change needed for local dev — the Vite proxy already handles it.
(function patchFetchForApiBase() {
  const apiBase: string =
    typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_API_URL
      ? ((import.meta as any).env.VITE_API_URL as string).replace(/\/$/, "")
      : "";

  if (!apiBase || typeof window === "undefined") return;

  const _RELATIVE_PREFIXES = ["/api", "/nft", "/faction"];

  const origFetch = window.fetch.bind(window);

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    if (typeof input === "string") {
      const isRelativeApiPath = _RELATIVE_PREFIXES.some((p) =>
        input.startsWith(p),
      );
      if (isRelativeApiPath) {
        return origFetch(`${apiBase}${input}`, init);
      }
    }
    return origFetch(input, init);
  };
})();
