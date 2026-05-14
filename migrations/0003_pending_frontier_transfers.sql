-- Migration: 0003_pending_frontier_transfers
-- Adds a persistent retry queue for on-chain FRONTIER (FRNTR) ASA transfers.
-- Rows are inserted whenever a transfer is owed (welcome bonus, claim, mining yield)
-- and drained by the background worker (services/chain/transferQueue.ts).
-- Status lifecycle: pending → sent | failed

CREATE TABLE IF NOT EXISTS "pending_frontier_transfers" (
  "id"                   text          PRIMARY KEY,
  "recipient_address"    text          NOT NULL,
  "recipient_player_id"  text,
  "amount"               bigint        NOT NULL,
  "reason"               text          NOT NULL,
  "status"               varchar(10)   NOT NULL DEFAULT 'pending',
  "attempts"             integer       NOT NULL DEFAULT 0,
  "last_error"           text,
  "tx_id"                text,
  "created_at"           bigint        NOT NULL,
  "updated_at"           bigint        NOT NULL
);

CREATE INDEX IF NOT EXISTS "pending_frontier_transfers_status_idx"
  ON "pending_frontier_transfers" ("status");
