/**
 * Account and API key management.
 * All mutating routes require x-admin-secret header.
 */

import { randomBytes, createHash } from "crypto";
import type { FastifyInstance } from "fastify";
import sql from "./db.js";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

function verifyAdmin(req: { headers: Record<string, string | string[] | undefined> }) {
  const provided = req.headers["x-admin-secret"];
  if (!ADMIN_SECRET || provided !== ADMIN_SECRET) {
    throw { statusCode: 401, message: "Unauthorized" };
  }
}

function generateKey(): { raw: string; hash: string; prefix: string } {
  const suffix = randomBytes(36).toString("base64url").slice(0, 48);
  const raw    = `sk-pnv-${suffix}`;
  const hash   = createHash("sha256").update(raw).digest("hex");
  return { raw, hash, prefix: raw.slice(0, 16) };
}

export default async function keysRoutes(app: FastifyInstance) {
  // ── Accounts ───────────────────────────────────────────────────────────────

  app.post("/v1/accounts", async (req, reply) => {
    verifyAdmin(req);
    const body = req.body as { email?: string; wallet_addr?: string } | null ?? {};
    // Idempotent: re-running setup with the same email returns the existing
    // account instead of failing on the accounts_email_key unique constraint.
    const [row] = await sql`
      INSERT INTO accounts (email, wallet_addr)
      VALUES (${body.email ?? null}, ${body.wallet_addr ?? null})
      ON CONFLICT (email) DO UPDATE
        SET wallet_addr = COALESCE(EXCLUDED.wallet_addr, accounts.wallet_addr)
      RETURNING id, credits_nanox, tier
    `;
    return reply.send(row);
  });

  // ── Keys ───────────────────────────────────────────────────────────────────

  app.post("/v1/keys", async (req, reply) => {
    verifyAdmin(req);
    const body = req.body as {
      account_id: string;
      name?:      string;
      rpm_limit?: number;
      daily_limit?: number;
    };
    const { raw, hash, prefix } = generateKey();
    const [row] = await sql`
      INSERT INTO api_keys (account_id, key_hash, key_prefix, name, rpm_limit, daily_limit)
      VALUES (
        ${body.account_id},
        ${hash},
        ${prefix},
        ${body.name ?? null},
        ${body.rpm_limit  ?? 60},
        ${body.daily_limit ?? 10000}
      )
      RETURNING id, key_prefix, name, rpm_limit, daily_limit, created_at
    `;
    return reply.send({ ...row, key: raw });
  });

  app.get("/v1/keys", async (req, reply) => {
    verifyAdmin(req);
    const { account_id } = req.query as { account_id?: string };
    if (!account_id) return reply.code(400).send({ error: "account_id required" });
    const rows = await sql`
      SELECT id, key_prefix, name, rpm_limit, daily_limit, created_at, last_used_at
      FROM   api_keys
      WHERE  account_id = ${account_id} AND revoked_at IS NULL
      ORDER  BY created_at DESC
    `;
    return reply.send(rows);
  });

  app.delete("/v1/keys/:id", async (req, reply) => {
    verifyAdmin(req);
    const { id } = req.params as { id: string };
    const result = await sql`
      UPDATE api_keys SET revoked_at = NOW()
      WHERE  id = ${id} AND revoked_at IS NULL
    `;
    return reply.send({ revoked: result.count > 0 });
  });
}
