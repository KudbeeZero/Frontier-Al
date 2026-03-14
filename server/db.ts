import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./db-schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Strip the sslmode param from the connection string — we configure SSL
// explicitly below via the `ssl` object. Leaving sslmode=require in the URL
// causes pg-connection-string to emit a SECURITY WARNING about upcoming
// semantic changes in pg v9 / pg-connection-string v3, which pollutes logs.
function sanitizeDbUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    // Non-URL connection strings (e.g. key=value format) — return as-is.
    return url;
  }
}

const pool = new Pool({
  connectionString: sanitizeDbUrl(process.env.DATABASE_URL),
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 15000,
  // Drop idle connections after 10 s — well under Neon's ~5-minute idle-kill
  // threshold. This prevents the pool from holding stale sockets that Neon
  // has already terminated on its side, which causes "Connection terminated
  // unexpectedly" errors in background tasks.
  idleTimeoutMillis: 10_000,
  allowExitOnIdle: false,
  // Disable TCP keepalive — we want the pool to release connections quickly,
  // not hold onto them. keepAlive here competes with Neon's own pooler and
  // produces stale connections during low-traffic windows.
  keepAlive: false,
});

pool.on("error", (err) => {
  // These are transient — the pool removes the dead client automatically
  // and creates a fresh one for the next query. No action needed.
  if ((err as NodeJS.ErrnoException).code === "ECONNRESET" ||
      err.message.includes("Connection terminated")) {
    console.warn("[db] Pool client terminated by remote host — will reconnect automatically");
  } else {
    console.error("[db] Unexpected pool error:", err.message);
  }
});

export const db = drizzle(pool, { schema });

/**
 * Retry wrapper for background tasks and API routes that hit stale Neon
 * connections. Catches "Connection terminated" / ECONNRESET / timeout errors
 * and retries up to maxRetries times with exponential backoff.
 * Neon compute endpoints can take 1-2 s to wake from sleep on first request
 * after a server restart — three retries with 600 ms / 1.2 s / 2.4 s backoff
 * covers the cold-start window without blocking long.
 */
const CONN_ERR = /Connection terminated|ECONNRESET|connection timeout|ETIMEDOUT/i;

export async function withDbRetry<T>(fn: () => Promise<T>, label = "db", maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (CONN_ERR.test(msg)) {
        const delay = 600 * Math.pow(2, attempt); // 600 ms → 1200 ms → 2400 ms
        console.warn(`[db] ${label}: stale connection — retrying in ${delay} ms… (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        lastErr = err;
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

/**
 * Warm-up ping — sends a trivial query to wake Neon's compute endpoint before
 * the server begins accepting traffic. Safe to call at startup; no-ops on error.
 */
export async function warmUpDb(): Promise<void> {
  try {
    await withDbRetry(() => pool.query("SELECT 1"), "warmup", 5);
    console.log("[db] Connection warm-up OK");
  } catch (err) {
    console.warn("[db] Connection warm-up failed (server will still start):", (err as Error).message);
  }
}
