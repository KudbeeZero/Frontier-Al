-- Add faction alignment columns to players table
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "player_faction_id" varchar(20);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "faction_joined_at" bigint;
