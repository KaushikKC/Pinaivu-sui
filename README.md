# Pinaivu

**Decentralised AI inference on Sui.**

Pinaivu is an open protocol for private, verifiable, and censorship-resistant AI inference. GPU node operators compete in a real-time marketplace to serve requests. Every response is cryptographically signed by a coordinator running inside an AWS Nitro Enclave, and settlements are executed on-chain via Sui Move smart contracts — so users can verify exactly which node served their query and how much was paid, without trusting any single party.

## Architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────┐
│   Web UI    │────▶│   API Gateway         │────▶│ Coordinator │
│ (Next.js)   │     │   (Fastify)           │     │ (Nitro      │
│             │     │                       │     │  Enclave)   │
│  Explorer   │     │  Auth · Rate Limit    │     │             │
│  Dashboard  │     │  Usage Tracking       │     │  Auction    │
└──────┬──────┘     └───────────────────────┘     │  Dispatch   │
       │                                          │  Settlement │
       │            ┌───────────────────────┐     │  Receipts   │
       │            │   Chat Relayer        │     └──────┬──────┘
       │            │   (Rust · Enclave)    │            │
       │            │                       │       libp2p
       │            │  Memory · Encryption  │      gossipsub
       │            │  Walrus Storage       │            │
       │            └───────────────────────┘     ┌──────┴──────┐
       │                                          │  GPU Nodes  │
       │            ┌───────────────────────┐     │  (Rust)     │
       └───────────▶│   Explorer Indexer    │     │             │
                    │   (Rust)              │     │  Ollama     │
                    │                       │     │  Bidding    │
                    │  Receipts · Archive   │     │  Inference  │
                    └───────────────────────┘     └─────────────┘
                                                        │
                                                  ┌─────┴─────┐
                                                  │ Sui Move  │
                                                  │ Contracts │
                                                  │           │
                                                  │ Enclave   │
                                                  │ Vault     │
                                                  │ Receipts  │
                                                  └───────────┘
```

## How it works

1. **User sends a prompt** through the web UI or API.
2. **Coordinator broadcasts an auction** over a libp2p gossipsub mesh to all connected GPU nodes.
3. **Nodes bid** with their price, latency, and reputation score.
4. **Coordinator picks the winner**, issues a cryptographically signed dispatch token, and returns the node's URL to the client.
5. **Client sends the prompt directly to the node** with the dispatch token (the node verifies the coordinator's signature before serving).
6. **Node runs inference** via Ollama and returns the response.
7. **Coordinator signs a routing receipt** (Ed25519 over request ID, output hash, payouts, timestamp) and triggers on-chain settlement.
8. **Sui Move vault contract** verifies the receipt signature and pays the node from the treasury.

Every step is verifiable: the receipt is stored on-chain, archived to Walrus, and browsable in the explorer.

## Repository structure

| Directory | Description | Tech |
|-----------|-------------|------|
| [`contracts/`](./contracts) | Sui Move smart contracts — enclave registration, receipt verification, vault settlement | Move |
| [`coordinator/`](./coordinator) | Coordinator enclave — auction engine, libp2p mesh, receipt signing, settlement worker | Rust · Nitro Enclave |
| [`node/`](./node) | GPU node daemon — connects to coordinator, bids on requests, runs inference via Ollama | Rust |
| [`relayer/`](./relayer) | Chat relayer — stateful sessions, cross-session memory (pgvector), Walrus-backed context, encryption | Rust · Nitro Enclave |
| [`indexer/`](./indexer) | Explorer indexer — reads coordinator receipts, REST API, Walrus archival cron | Rust |
| [`pinaivu-api/`](./pinaivu-api) | API gateway + developer dashboard — key management, usage analytics, model catalog | TypeScript · Fastify · Next.js |
| [`web/`](./web) | Chat UI + explorer — ChatGPT-style interface, inference detail pages, receipt browser | TypeScript · Next.js |

## Key features

- **Private inference** — prompts are encrypted end-to-end. The coordinator runs inside an AWS Nitro Enclave with attestation; even the operator cannot see user data.
- **Verifiable receipts** — every inference produces an Ed25519-signed routing receipt with the output hash, serving node, and payout details. Verifiable offline against the enclave attestation document.
- **On-chain settlement** — Sui Move contracts hold a treasury vault. The coordinator submits `vault::settle` transactions that pay nodes in SUI, authenticated by the receipt signature. No trusted intermediary.
- **Decentralised GPU marketplace** — nodes compete on price, latency, and reputation. The auction runs over libp2p gossipsub with sub-second dispatch.
- **Cross-session memory** — the chat relayer maintains encrypted conversation history across sessions using pgvector embeddings and Walrus decentralised storage.
- **Walrus archival** — receipts are batched and archived to Walrus for permanent, decentralised storage.
- **OpenAI-compatible API** — the gateway exposes `POST /v1/chat/completions` with standard bearer auth, so existing tools and SDKs work out of the box.

## Quickstart (local development)

### Prerequisites

- Rust (latest stable)
- Node.js 18+
- PostgreSQL 16 with [pgvector](https://github.com/pgvector/pgvector)
- Redis
- [Ollama](https://ollama.com) with at least one model pulled

### 1. Database setup

```bash
createdb pinaivu      # gateway
createdb chatrelayer  # relayer (needs pgvector)
createdb indexer      # explorer indexer

psql chatrelayer -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 2. Start the gateway

```bash
cd pinaivu-api/gateway
cp .env.example .env   # fill in COORDINATOR_URL, ADMIN_SECRET
npm install && npm run dev
# Listening on http://localhost:4001
```

### 3. Start the indexer

```bash
cd indexer
cp .env.example .env   # fill in DATABASE_URL
cargo run
# Listening on http://localhost:3100
```

### 4. Start a GPU node

```bash
cd node
INSECURE_COORDINATOR=1 cargo run -- \
  --coordinator-addr /ip4/<COORDINATOR_IP>/tcp/4001/p2p/<PEER_ID> \
  --coordinator-http https://<COORDINATOR_IP>:4000 \
  --model llama3.1:8b-instruct-q4_K_M \
  --payout-address <YOUR_SUI_ADDRESS>
```

### 5. Start the web UI

```bash
cd web
cp .env.example .env.local  # fill in PINAIVU_API_URL, PINAIVU_API_KEY
npm install && npm run dev
# Open http://localhost:3000
```

### 6. Send a message

Open `http://localhost:3000`, type a message, and watch it flow through the full stack:

**Web → Gateway → Coordinator → Node → Ollama → Response → Settlement**

Click **"View details"** on any response to see the cryptographic receipt, or visit **`/explorer`** to browse all receipts.

## Smart contracts (Sui Move)

The contracts are deployed on Sui Testnet:

| Module | Purpose |
|--------|---------|
| `pinaivu::enclave` | Registers the coordinator's NSM-attested Ed25519 key and PCRs on-chain |
| `pinaivu::receipts` | BCS-encoded receipt verification — `verify_signature` checks the coordinator's Ed25519 signature over (request_id, output_hash, payouts) |
| `pinaivu::vault` | Treasury settlement — `settle` verifies the receipt and pays the node; `top_up` funds the vault; `refund` is the deadline-elapsed recovery path |

## API reference

### Gateway (`api.pinaivu.com`)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /v1/chat/completions` | Bearer | OpenAI-compatible inference dispatch |
| `GET /v1/models` | — | List available models from connected nodes |
| `GET /v1/nodes` | — | List connected GPU nodes |
| `GET /enclave_health` | — | Coordinator enclave status, uptime, on-chain ID |
| `GET /v1/usage?days=30` | Bearer | Per-key usage statistics |

### Explorer Indexer (`explorer.pinaivu.com`)

| Endpoint | Description |
|----------|-------------|
| `GET /api/r/:request_id` | Full receipt + payment details |
| `GET /api/nodes/:peer_id` | Node profile + recent receipts |
| `GET /api/recent?limit=20` | Latest receipts |

## Security model

- **Coordinator** runs inside an AWS Nitro Enclave. Its Ed25519 signing key is generated inside the enclave and never leaves. The NSM attestation document binds the key to specific PCR measurements.
- **TLS certificates** are generated inside the enclave. The TLS fingerprint is included in `/enclave_health` for certificate pinning.
- **Dispatch tokens** are signed by the coordinator and verified by nodes before serving — a compromised client cannot forge a dispatch.
- **Routing receipts** are signed over (request_id, aggregated_output_hash, payouts, timestamp). The on-chain vault contract verifies this signature before releasing funds.
- **Memory encryption** uses per-owner HKDF-derived AES-256-GCM keys. Session blobs stored on Walrus are encrypted at rest.

## Environment variables

Each service has a `.env.example` with documented variables. See [`env-vars.md`](./env-vars.md) in the project root for a complete deployment reference.

## License

MIT
