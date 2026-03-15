# MIGRATION_NOTES.md — Replit Artifact Extraction

## .replit — Extracted Intent
**Original purpose:** Replit IDE configuration — run commands, Nix packages, port mappings, deployment target, workflow definitions, and environment variables for dev/production.
**Key configuration:**
- Run command: `npm run dev`
- Build: `npm run build`
- Start: `node ./dist/index.cjs`
- Default PORT: 5000 (dev), 3000 (production)
- Deployment target: Cloud Run
- Nix packages: nodejs-20, python-3.11, postgresql-16
- Port mappings: 3000→80, 5000→5000, 5002→9000
**Migrated to:** Railway (`railway.toml`) for backend; Vercel (`vercel.json`) for frontend
**Action required:** Set PORT env var on Railway (Railway injects PORT automatically). Verify build/start commands match `railway.toml`.

## replit.md — Extracted Intent
**Original purpose:** Replit-specific project documentation describing architecture, key files, and behavioral notes for the Replit IDE agent.
**Migrated to:** Existing `CLAUDE.md` and project README cover this intent
**Action required:** None — documentation was Replit-agent-facing only. General architecture docs already exist elsewhere.
