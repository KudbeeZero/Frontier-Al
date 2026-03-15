// ─────────────────────────────────────────────────────────────────────────────
// Barrel re-export — decomposed storage module.
// External consumers import `storage` and `IStorage` from "./storage".
// ─────────────────────────────────────────────────────────────────────────────

export type { IStorage } from "./storage/interface";
export { MemStorage }    from "./storage/mem";
export { DbStorage }     from "./storage/db";

import type { IStorage } from "./storage/interface";
import { DbStorage }     from "./storage/db";

// ── Singleton ────────────────────────────────────────────────────────────────
// DATABASE_URL is required — throw a clear fatal error if missing so the
// process exits immediately with an actionable message.
export const storage: IStorage = process.env.DATABASE_URL
  ? new DbStorage()
  : (() => {
      throw new Error(
        "[FATAL] DATABASE_URL is not set. FRONTIER requires a PostgreSQL database to run. " +
        "Set DATABASE_URL in your environment variables before starting the server."
      );
    })();
