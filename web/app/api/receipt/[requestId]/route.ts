import { NextRequest } from 'next/server';

const COORDINATOR_URL = process.env.PINAIVU_COORDINATOR_URL ?? 'https://13.206.80.190:4000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;

  try {
    const res = await fetch(`${COORDINATOR_URL}/v1/proofs/${requestId}`);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'coordinator unreachable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
