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
 * Retry wrapper for background tasks that hit stale Neon connections.
 * Catches "Connection terminated" / ECONNRESET / timeout errors,
 * waits 600 ms for the pool to evict the dead client, then retries once.
 */
const CONN_ERR = /Connection terminated|ECONNRESET|connection timeout|ETIMEDOUT/i;

export async function withDbRetry<T>(fn: () => Promise<T>, label = "db"): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (CONN_ERR.test(msg)) {
      console.warn(`[db] ${label}: stale connection — retrying in 600 ms…`);
      await new Promise(r => setTimeout(r, 600));
      return fn();
    }
    throw err;
  }
}
