import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./db-schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
