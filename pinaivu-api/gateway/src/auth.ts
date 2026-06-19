/**
 * API key validation + rate limiting.
 *
 * Keys are stored hashed (SHA-256) so the raw key is never in the DB.
 * Rate limiting uses a Redis INCR + EXPIRE window per key per minute.
 */

import { createHash } from "crypto";
import sql from "./db.js";
import redis from "./cache.js";

export interface KeyContext {
  apiKeyId:   string;
  accountId:  string;
  rpmLimit:   number;
  dailyLimit: number;
}

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Look up an active key by its raw value. Returns null if invalid/revoked. */
export async function resolveKey(raw: string): Promise<KeyContext | null> {
  const hash = hashKey(raw);
  const rows = await sql`
    SELECT id, account_id, rpm_limit, daily_limit
    FROM   api_keys
    WHERE  key_hash   = ${hash}
    AND    revoked_at IS NULL
  `;
  if (!rows.length) return null;
  const r = rows[0];
  // Fire-and-forget last_used_at update
  sql`UPDATE api_keys SET last_used_at = NOW() WHERE id = ${r.id}`.catch(() => {});
  return {
    apiKeyId:   r.id,
    accountId:  r.account_id,
    rpmLimit:   r.rpm_limit,
    dailyLimit: r.daily_limit,
  };
}

/**
 * Check and increment the per-minute counter.
 * Returns true = allowed, false = rate limited.
 * Fails open if Redis is unavailable.
 */
export async function checkRpm(ctx: KeyContext): Promise<boolean> {
  try {
    const key = `rpm:${ctx.apiKeyId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return count <= ctx.rpmLimit;
  } catch {
    return true; // fail open
  }
}
