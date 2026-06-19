# Pinaivu API Platform

API gateway + developer dashboard for the Pinaivu decentralized inference network.

## Architecture

```
Client
  │  Authorization: Bearer sk-pnv-...
  ▼
Gateway  :4001       ← this repo
  │  validates key, rate limits, tracks usage
  │  proxies to coordinator
  ▼
Coordinator  :4000   ← separate repo (Pinaivu-AI/Coordinator)
  │  auction, routing, Nitro Enclave
  ▼
GPU Nodes
```

## Services

| Service | Port | Purpose |
|---|---|---|
| `gateway/` | 4001 | API key auth, rate limiting, usage, key management |
| `dashboard/` | 3000 | Developer console (Next.js) |

Both share the same Postgres and Redis as the coordinator.

## Local dev

```bash
# 1. Start database (skip if coordinator's docker-compose is already running)
docker compose up -d

# 2. Run migrations
psql $DATABASE_URL -f gateway/migrations/001_api_platform.sql

# 3. Start gateway
cd gateway
cp .env.example .env
npm install
npm run dev

# 4. Start dashboard (new terminal)
cd dashboard
cp .env.local.example .env.local
npm install
npm run dev
# Open http://localhost:3000/setup
```

## Environment variables

### Gateway (`gateway/.env`)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Shared Postgres — same as coordinator |
| `REDIS_URL` | Shared Redis — same as coordinator |
| `COORDINATOR_URL` | Where the coordinator HTTPS endpoint is |
| `ADMIN_SECRET` | Secret for key management endpoints |
| `PORT` | Gateway port (default 4001) |

### Dashboard (`dashboard/.env.local`)
| Variable | Description |
| `GATEWAY_URL` | Gateway address (default http://localhost:4001) |
| `COORDINATOR_URL` | Coordinator address (for health + models) |
| `ADMIN_SECRET` | Same secret as gateway |
| `DASHBOARD_ACCOUNT_ID` | Your operator account UUID |
| `DASHBOARD_API_KEY` | Your API key (for usage stats) |
