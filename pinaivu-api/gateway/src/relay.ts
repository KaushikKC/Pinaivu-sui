/**
 * Server-side relay: does the full auction + node-call round trip in one
 * request.
 *
 * chat-relayer runs inside a Nitro Enclave, which has no general outbound
 * networking — only a fixed, pre-configured allowlist of hosts reachable
 * via VSOCK bridges (this gateway included). The node a client gets
 * dispatched to is decided dynamically at auction time and can be any
 * IP/port, so the enclave has no way to reach it directly. The gateway
 * has normal networking, so it does the node hop on the relayer's behalf
 * and returns the final content directly.
 *
 * This is separate from POST /v1/chat/completions, which stays exactly
 * as-is for developer clients (OpenAI-SDK-compatible: returns
 * { node_url, dispatch_token } and lets the caller hit the node itself).
 */
import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { requireKey } from "./auth.js";
import { recordDispatch } from "./usage.js";

const COORDINATOR_URL = process.env.COORDINATOR_URL ?? "https://localhost:4000";

function extractStringField(text: string, key: string): string | null {
  const m = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`));
  return m ? m[1] : null;
}

/**
 * Extract the raw JSON text of an object-valued field by brace-balancing,
 * never JSON.parse-ing it. dispatch_token.max_price_nanox carries u64
 * values (often u64::MAX) that JS Number can't round-trip exactly — see
 * the same precision note on POST /v1/chat/completions in server.ts.
 */
function extractRawObjectField(text: string, key: string): string | null {
  const marker = `"${key}":`;
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) return null;
  let i = markerIdx + marker.length;
  while (i < text.length && text[i] !== "{") i++;
  if (i >= text.length) return null;
  const start = i;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export default async function relayRoutes(app: FastifyInstance) {
  app.post("/v1/relay/inference", { preHandler: requireKey }, async (req: any, reply) => {
    const ctx = req.keyCtx;
    const body = req.body as Record<string, unknown>;

    // Step 1: run the auction via the coordinator (same call shape as
    // POST /v1/chat/completions).
    const dispatchBody = {
      model: body.model,
      messages: body.messages,
      client_pubkey_hex: body.client_pubkey_hex,
      session_id: body.session_id,
    };

    const dispatchRes = await fetch(`${COORDINATOR_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // @ts-ignore — Node.js TLS option
      dispatcher: undefined,
      body: JSON.stringify(dispatchBody),
    }).catch(
      () => new Response(JSON.stringify({ error: "coordinator unreachable" }), { status: 503 }),
    );

    const dispatchText = await dispatchRes.text();
    if (!dispatchRes.ok) {
      return reply.code(dispatchRes.status).type("application/json").send(dispatchText);
    }

    const nodeUrl = extractStringField(dispatchText, "node_url");
    const sessionId = extractStringField(dispatchText, "session_id");
    const requestId = extractStringField(dispatchText, "request_id") ?? randomUUID();
    const dispatchTokenRaw = extractRawObjectField(dispatchText, "dispatch_token");

    if (!nodeUrl || !sessionId || !dispatchTokenRaw) {
      return reply.code(502).send({ error: "malformed dispatch response from coordinator" });
    }

    recordDispatch(requestId, ctx, (body.model as string) ?? "unknown");

    // Step 2: call the winning node directly — this is the hop the
    // enclave-bound relayer can't make itself.
    const memwalPart =
      typeof body.memwal_context === "string"
        ? `,"memwal_context":${JSON.stringify(body.memwal_context)}`
        : "";
    const inferenceBodyJson =
      `{"dispatch_token":${dispatchTokenRaw},` +
      `"session_id":${JSON.stringify(sessionId)},` +
      `"session_key":${JSON.stringify(body.session_key ?? "")},` +
      `"new_user_message":${JSON.stringify(body.new_user_message ?? "")}` +
      `${memwalPart}}`;

    const nodeRes = await fetch(`${nodeUrl.replace(/\/+$/, "")}/v1/inference`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: inferenceBodyJson,
    }).catch(() => new Response(JSON.stringify({ error: "node unreachable" }), { status: 503 }));

    const nodeText = await nodeRes.text();
    return reply.code(nodeRes.status).type("application/json").send(nodeText);
  });
}
