/**
 * server/db.ts
 *
 * Single database connection shared across the whole server process.
 * Uses the `pg` Pool driver so that Drizzle can participate in
 * manual transactions via db.transaction().
 *
 * NOTE: This module intentionally does NOT throw when DATABASE_URL is absent.
 * The throw is deferred to DbStorage's constructor so that importing this
 * module does not break MemStorage, which runs without a database.
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./db-schema";

// Only create the pool when DATABASE_URL is present.
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
  : null;

// Cast to the full type so callers don't need null-checks everywhere.
// DbStorage's constructor guards against using this when pool is null.
export const db = pool
  ? drizzle(pool, { schema })
  : (null as unknown as ReturnType<typeof drizzle<typeof schema>>);

/** Drizzle database type — useful for typing transaction callbacks. */
export type DB = ReturnType<typeof drizzle<typeof schema>>;
