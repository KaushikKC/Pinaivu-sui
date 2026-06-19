import type { FastifyInstance } from "fastify";
import sql from "./db.js";
import type { KeyContext } from "./auth.js";

/** Insert a usage row at dispatch time (tokens = 0 until CompletionAck). */
export async function recordDispatch(
  requestId: string,
  ctx: KeyContext,
  model: string,
) {
  await sql`
    INSERT INTO api_usage (request_id, api_key_id, model)
    VALUES (${requestId}, ${ctx.apiKeyId}, ${model})
    ON CONFLICT DO NOTHING
  `.catch(() => {});
}

export default async function usageRoutes(app: FastifyInstance) {
  app.get("/v1/usage", async (req, reply) => {
    const ctx = (req as { keyCtx?: KeyContext }).keyCtx;
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });

    const { days: daysStr } = req.query as { days?: string };
    const days = Math.min(Number(daysStr ?? 30), 90) || 30;

    const [totals] = await sql`
      SELECT
        COUNT(*)::int            AS total_requests,
        COALESCE(SUM(input_tokens),  0)::bigint AS total_input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS total_output_tokens,
        COALESCE(SUM(cost_nanox),    0)::bigint AS total_cost_nanox
      FROM api_usage u
      JOIN api_keys  k ON k.id = u.api_key_id
      WHERE k.account_id = ${ctx.accountId}
        AND u.created_at >= NOW() - (${days} || ' days')::interval
    `;

    const records = await sql`
      SELECT u.request_id, u.model, u.input_tokens, u.output_tokens,
             u.cost_nanox, u.latency_ms, u.created_at
      FROM   api_usage u
      JOIN   api_keys  k ON k.id = u.api_key_id
      WHERE  k.account_id = ${ctx.accountId}
        AND  u.created_at >= NOW() - (${days} || ' days')::interval
      ORDER  BY u.created_at DESC
      LIMIT  500
    `;

    return reply.send({ ...totals, records });
  });
}
