/**
 * server/db.ts
 *
 * Single database connection shared across the whole server process.
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./db-schema";

let pool: Pool | null = null;

// Task 7: Prevent server crash if DB is unavailable
try {
  if (process.env.DATABASE_URL) {
    // pg v8.x warns when sslmode=require is used without uselibpqcompat=true.
    // We append it here to silence the "SECURITY WARNING" about future breaking changes.
    let connectionString = process.env.DATABASE_URL;
    if (connectionString.includes("sslmode=require") && !connectionString.includes("uselibpqcompat=true")) {
      connectionString += (connectionString.includes("?") ? "&" : "?") + "uselibpqcompat=true";
    }

    pool = new Pool({
      connectionString,
      max: 3,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: true,          // Allow the process to exit if the pool is idle
    });
    
    pool.on("error", (err) => {
      console.error("Unexpected error on idle database client", err);
    });
  } else {
    console.log("DATABASE_URL not found, falling back to MemStorage");
  }
} catch (err) {
  console.error("Failed to initialize database pool:", err);
}

export const db = pool
  ? drizzle(pool, { schema })
  : (null as unknown as ReturnType<typeof drizzle<typeof schema>>);

export type DB = ReturnType<typeof drizzle<typeof schema>>;
