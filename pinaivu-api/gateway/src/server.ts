/**
 * Pinaivu API Gateway
 *
 * Sits in front of the coordinator enclave. Handles:
 *   - API key authentication  (Bearer sk-pnv-...)
 *   - Per-key rate limiting   (Redis)
 *   - Usage tracking          (Postgres api_usage)
 *   - Key + account management
 *   - Proxying to coordinator
 */

import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { resolveKey, checkRpm } from "./auth.js";
import { recordDispatch } from "./usage.js";
import keysRoutes from "./keys.js";
import usageRoutes from "./usage.js";
import { randomUUID } from "crypto";

const COORDINATOR_URL = process.env.COORDINATOR_URL ?? "https://localhost:4000";
const PORT            = Number(process.env.PORT ?? 4001);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// ── Auth hook — runs before any /v1/* route that needs a key ──────────────────
async function requireKey(req: any, reply: any) {
  const auth = req.headers["authorization"] as string | undefined;
  const raw  = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!raw) return reply.code(401).send({ error: "Authorization header required" });

  const ctx = await resolveKey(raw);
  if (!ctx) return reply.code(401).send({ error: "Invalid or revoked API key" });

  const allowed = await checkRpm(ctx);
  if (!allowed) return reply.code(429).send({ error: "Rate limit exceeded" });

  req.keyCtx = ctx;
}

// ── Public coordinator pass-through (no auth) ─────────────────────────────────
for (const path of ["/health", "/enclave_health", "/get_attestation", "/v1/models", "/v1/nodes"]) {
  app.get(path, async (req, reply) => {
    const res = await proxyGet(path);
    return reply.code(res.status).headers(safeHeaders(res)).send(await res.text());
  });
}

// ── Protected: POST /v1/chat/completions ──────────────────────────────────────
app.post("/v1/chat/completions", { preHandler: requireKey }, async (req: any, reply) => {
  const ctx  = req.keyCtx;
  const body = req.body as Record<string, unknown>;

  // Forward to coordinator (no auth header needed — coordinator trusts gateway)
  const res = await proxyPost("/v1/chat/completions", body);
  const data = await res.json() as Record<string, unknown>;

  // Record usage fire-and-forget (tokens=0 until CompletionAck)
  const requestId = (data.request_id as string) ?? randomUUID();
  recordDispatch(requestId, ctx, (body.model as string) ?? "unknown");

  return reply.code(res.status).send(data);
});

// ── Protected: GET /v1/usage ──────────────────────────────────────────────────
await app.register(usageRoutes);
app.addHook("preHandler", async (req: any, reply) => {
  if (req.url?.startsWith("/v1/usage")) await requireKey(req, reply);
});

// ── Admin: key + account management ──────────────────────────────────────────
await app.register(keysRoutes);

// ── Proxy helpers ─────────────────────────────────────────────────────────────
async function proxyGet(path: string) {
  return fetch(`${COORDINATOR_URL}${path}`, {
    // @ts-ignore — Node.js TLS option
    dispatcher: undefined,
  }).catch(() => new Response(JSON.stringify({ error: "coordinator unreachable" }), { status: 503 }));
}

async function proxyPost(path: string, body: unknown) {
  return fetch(`${COORDINATOR_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // @ts-ignore
    dispatcher: undefined,
  }).catch(() => new Response(JSON.stringify({ error: "coordinator unreachable" }), { status: 503 }));
}

function safeHeaders(res: Response): Record<string, string> {
  const h: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    if (k !== "transfer-encoding") h[k] = v;
  });
  return h;
}

// ── Boot ──────────────────────────────────────────────────────────────────────
await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`Gateway listening on :${PORT}  →  coordinator at ${COORDINATOR_URL}`);
