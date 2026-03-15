# ENV_VARS.md — Required Environment Variables

## Backend (Railway)

| Variable | Purpose | Example / Notes |
|----------|---------|-----------------|
| DATABASE_URL | Neon PostgreSQL connection string | `postgres://user:pass@host/db?sslmode=require` |
| ALGORAND_ADMIN_MNEMONIC | Admin wallet mnemonic | 25-word phrase |
| ALGORAND_ADMIN_ADDRESS | Admin wallet address | Algorand public address |
| SESSION_SECRET | express-session secret | random 64-char string |
| PUBLIC_BASE_URL | Railway service base URL (used for NFT metadata URLs) | `https://api.ascendancyalgo.xyz` |
| ALGORAND_NETWORK | `testnet` or `mainnet` | `mainnet` |
| UPSTASH_REDIS_REST_URL | Upstash Redis REST URL | `https://....upstash.io` |
| UPSTASH_REDIS_REST_TOKEN | Upstash Redis REST token | |
| CLIENT_ORIGIN | Vercel frontend URL for CORS | `https://ascendancyalgo.xyz` |
| NODE_ENV | Environment flag | `production` |
| PORT | Server listen port (Railway injects automatically) | `5000` |
| AI_ENABLED | Enable/disable AI faction turns | `false` |
| FORCE_NEW_ASA | Force new ASA creation on startup | `false` |
| ADMIN_KEY | Admin API key for privileged endpoints | random secret string |
| ALGOD_URL | Custom Algorand node URL (optional, defaults to algonode) | `https://mainnet-api.algonode.cloud` |
| INDEXER_URL | Custom Algorand indexer URL (optional, defaults to algonode) | `https://mainnet-idx.algonode.cloud` |
| ALGOD_TOKEN | Algorand node API token (optional) | |
| INDEXER_TOKEN | Algorand indexer API token (optional) | |

## Frontend (Vercel)

| Variable | Purpose | Must be prefixed VITE_ |
|----------|---------|------------------------|
| VITE_WS_URL | WebSocket endpoint base URL | `wss://api.ascendancyalgo.xyz` |
| VITE_ALGOD_URL | Algorand node URL override (optional, defaults to testnet algonode) | `https://mainnet-api.algonode.cloud` |
| VITE_INDEXER_URL | Algorand indexer URL override (optional, defaults to testnet algonode) | `https://mainnet-idx.algonode.cloud` |

## Flags

- **CLIENT_ORIGIN**: Not currently set — must be configured for cross-origin deployment
- **VITE_WS_URL**: New — required for cross-domain WebSocket from Vercel → Railway
- **VITE_ALGOD_URL / VITE_INDEXER_URL**: Currently default to testnet URLs; must be overridden for mainnet
- **SESSION_SECRET**: Listed as required in chain config validation but session middleware is not currently initialized — verify if sessions are needed before go-live
- **AI_ENABLED**: Should be `false` for initial multiplayer launch
