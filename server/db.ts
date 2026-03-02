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
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      ssl: { rejectUnauthorized: false },
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
