/**
 * server/db.ts
 *
 * Single database connection shared across the whole server process.
 * Uses the `pg` Pool driver so that Drizzle can participate in
 * manual transactions via db.transaction().
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./db-schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Provision a PostgreSQL database first.");
}

// Single pool instance — shared by all requests.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep a modest pool size; Drizzle transactions will borrow a single
  // connection for the life of the transaction.
  max: 10,
});

export const db = drizzle(pool, { schema });

/** Drizzle database type — useful for typing transaction callbacks. */
export type DB = typeof db;
