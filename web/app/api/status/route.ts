import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * A node is considered "live" only if the coordinator saw it within this
 * window. Nodes re-announce every 30s, so 90s tolerates a couple of missed
 * announces. This is deliberately tighter than the coordinator's own peer
 * TTL (600s) so the chat warns within ~a minute of a node going offline,
 * instead of waiting up to 10 minutes for server-side eviction.
 */
const FRESH_MS = 90_000;

interface NodeSnapshot {
  peer_id: string;
  models: string[];
  last_seen_ms: number;
}

/**
 * Reports whether inference can actually be served right now.
 *
 *   online    — at least one node announced within FRESH_MS
 *   no-nodes   — backend reachable but no recently-seen node is serving
 *   offline    — backend (coordinator/gateway) unreachable
 *   demo       — no PINAIVU_API_URL configured → local mock responses
 *
 * Uses /v1/nodes (with last_seen_ms) rather than /v1/models, because the
 * coordinator keeps stale peers in its registry for up to 600s — so a model
 * list stays non-empty long after the node that served it has disconnected.
 */
export async function GET() {
  const apiUrl = process.env.PINAIVU_API_URL;

  if (!apiUrl) {
    return NextResponse.json({ status: 'demo', nodes: 0 });
  }

  try {
    const res = await fetch(`${apiUrl}/v1/nodes`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ status: 'offline', nodes: 0, detail: `nodes ${res.status}` });
    }

    const data = await res.json();
    const list: NodeSnapshot[] = Array.isArray(data) ? data : [];
    const now = Date.now();
    const liveNodes = list.filter(
      (n) => typeof n.last_seen_ms === 'number' && now - n.last_seen_ms < FRESH_MS,
    ).length;

    return NextResponse.json({
      status: liveNodes > 0 ? 'online' : 'no-nodes',
      nodes: liveNodes,
    });
  } catch (e) {
    return NextResponse.json({
      status: 'offline',
      nodes: 0,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}
