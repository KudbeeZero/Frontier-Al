-- Migration: 0002_terraform_state
-- Adds terraform tracking columns to the parcels table.
-- These fields allow terraforming to update the same land asset in-place,
-- avoiding any burn/remint flow. Canonical state lives here; metadata endpoint
-- reads these fields to reflect the current land state dynamically.

ALTER TABLE "parcels"
  ADD COLUMN IF NOT EXISTS "terraform_status"   varchar(20)  NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "terraformed_at"     bigint,
  ADD COLUMN IF NOT EXISTS "terraform_level"    integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "terraform_type"     varchar(30),
  ADD COLUMN IF NOT EXISTS "metadata_version"   integer      NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "visual_state_revision" integer   NOT NULL DEFAULT 0;
