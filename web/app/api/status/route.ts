import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Reports whether inference can actually be served right now.
 *
 *   online    — backend reachable and at least one model (i.e. a connected GPU node)
 *   no-nodes  — backend reachable but no models advertised → no node is serving
 *   offline   — backend (coordinator/gateway) unreachable
 *   demo      — no PINAIVU_API_URL configured → local mock responses
 *
 * Used by the chat UI to warn before the user sends a message that fails.
 */
export async function GET() {
  const apiUrl = process.env.PINAIVU_API_URL;

  if (!apiUrl) {
    return NextResponse.json({ status: 'demo', models: 0 });
  }

  try {
    const res = await fetch(`${apiUrl}/v1/models`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ status: 'offline', models: 0, detail: `models ${res.status}` });
    }
    const data = await res.json();
    const models = Array.isArray(data?.data) ? data.data.length : 0;
    return NextResponse.json({ status: models > 0 ? 'online' : 'no-nodes', models });
  } catch (e) {
    return NextResponse.json({
      status: 'offline',
      models: 0,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}
