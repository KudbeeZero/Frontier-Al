CREATE TABLE "ai_faction_identities" (
	"faction_name" varchar(20) PRIMARY KEY NOT NULL,
	"asset_id" bigint,
	"mint_tx_id" text,
	"minted_at" bigint,
	"explorer_url" text
);
--> statement-breakpoint
CREATE TABLE "battles" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"attacker_id" varchar(36) NOT NULL,
	"defender_id" varchar(36),
	"target_parcel_id" varchar(36) NOT NULL,
	"attacker_power" real NOT NULL,
	"defender_power" real NOT NULL,
	"troops_committed" integer NOT NULL,
	"crystal_burned" integer DEFAULT 0 NOT NULL,
	"influence_damage" integer DEFAULT 0 NOT NULL,
	"resources_burned" jsonb NOT NULL,
	"start_ts" bigint NOT NULL,
	"resolve_ts" bigint NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"outcome" varchar(20),
	"rand_factor" real,
	"commander_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "game_events" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"type" varchar(30) NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"parcel_id" varchar(36),
	"battle_id" varchar(36),
	"description" text NOT NULL,
	"ts" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_meta" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"initialized" boolean DEFAULT false NOT NULL,
	"current_turn" integer DEFAULT 1 NOT NULL,
	"last_update_ts" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mint_idempotency" (
	"key" text PRIMARY KEY NOT NULL,
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
	"asset_id" bigint,
	"tx_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orbital_events" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"type" varchar(30) NOT NULL,
	"cosmetic" boolean DEFAULT false NOT NULL,
	"start_at" bigint NOT NULL,
	"end_at" bigint NOT NULL,
	"seed" integer DEFAULT 0 NOT NULL,
	"intensity" real DEFAULT 0.5 NOT NULL,
	"trajectory" jsonb NOT NULL,
	"target_parcel_id" varchar(36),
	"effects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcels" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"plot_id" integer NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"x" real DEFAULT 0 NOT NULL,
	"y" real DEFAULT 0 NOT NULL,
	"z" real DEFAULT 0 NOT NULL,
	"biome" varchar(20) NOT NULL,
	"richness" integer NOT NULL,
	"owner_id" varchar(36),
	"owner_type" varchar(10),
	"defense_level" integer DEFAULT 1 NOT NULL,
	"iron_stored" real DEFAULT 0 NOT NULL,
	"fuel_stored" real DEFAULT 0 NOT NULL,
	"crystal_stored" real DEFAULT 0 NOT NULL,
	"storage_capacity" integer DEFAULT 200 NOT NULL,
	"last_mine_ts" bigint DEFAULT 0 NOT NULL,
	"active_battle_id" varchar(36),
	"yield_multiplier" real DEFAULT 1 NOT NULL,
	"improvements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"purchase_price_algo" real,
	"frontier_accumulated" real DEFAULT 0 NOT NULL,
	"last_frontier_claim_ts" bigint DEFAULT 0 NOT NULL,
	"frontier_per_day" real DEFAULT 1 NOT NULL,
	"captured_from_faction" varchar(20),
	"captured_at" bigint,
	"handover_count" integer DEFAULT 0 NOT NULL,
	"influence" integer DEFAULT 100 NOT NULL,
	"influence_repair_rate" real DEFAULT 2 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"address" varchar(100) DEFAULT 'PLAYER_WALLET' NOT NULL,
	"name" varchar(100) NOT NULL,
	"iron" integer DEFAULT 0 NOT NULL,
	"fuel" integer DEFAULT 0 NOT NULL,
	"crystal" integer DEFAULT 0 NOT NULL,
	"frontier" integer DEFAULT 0 NOT NULL,
	"is_ai" boolean DEFAULT false NOT NULL,
	"ai_behavior" varchar(20),
	"total_iron_mined" integer DEFAULT 0 NOT NULL,
	"total_fuel_mined" integer DEFAULT 0 NOT NULL,
	"total_crystal_mined" real DEFAULT 0 NOT NULL,
	"total_frontier_earned" real DEFAULT 0 NOT NULL,
	"total_frontier_burned" real DEFAULT 0 NOT NULL,
	"attacks_won" integer DEFAULT 0 NOT NULL,
	"attacks_lost" integer DEFAULT 0 NOT NULL,
	"territories_captured" integer DEFAULT 0 NOT NULL,
	"commanders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_commander_index" integer DEFAULT 0 NOT NULL,
	"special_attacks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"drones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"satellites" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"welcome_bonus_received" boolean DEFAULT false NOT NULL,
	"frntr_balance_micro" bigint DEFAULT 0 NOT NULL,
	"frntr_ready_micro" bigint DEFAULT 0 NOT NULL,
	"frntr_claimed_micro" bigint DEFAULT 0 NOT NULL,
	"morale_debuff_until" bigint DEFAULT 0 NOT NULL,
	"attack_cooldown_until" bigint DEFAULT 0 NOT NULL,
	"consecutive_losses" integer DEFAULT 0 NOT NULL,
	"testnet_progress" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"treasury" real DEFAULT 1000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plot_nfts" (
	"plot_id" integer PRIMARY KEY NOT NULL,
	"asset_id" bigint,
	"minted_to_address" text,
	"minted_at" bigint
);
--> statement-breakpoint
CREATE INDEX "battles_status_resolve_idx" ON "battles" USING btree ("status","resolve_ts");--> statement-breakpoint
CREATE INDEX "battles_attacker_idx" ON "battles" USING btree ("attacker_id");--> statement-breakpoint
CREATE INDEX "battles_defender_idx" ON "battles" USING btree ("defender_id");--> statement-breakpoint
CREATE INDEX "game_events_ts_idx" ON "game_events" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "orbital_events_active_idx" ON "orbital_events" USING btree ("resolved","end_at");--> statement-breakpoint
CREATE INDEX "parcels_owner_id_idx" ON "parcels" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "parcels_coords_idx" ON "parcels" USING btree ("x","y","z");