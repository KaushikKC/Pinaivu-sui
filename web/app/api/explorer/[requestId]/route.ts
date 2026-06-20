import { NextRequest } from 'next/server';

const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? '';
const COORDINATOR_URL = process.env.PINAIVU_COORDINATOR_URL ?? 'https://13.206.80.190:4000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;

  // Try indexer first (has full data including walrus_blob_id and payments)
  if (INDEXER_URL) {
    try {
      const res = await fetch(`${INDEXER_URL}/api/r/${requestId}`);
      if (res.ok) {
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {}
  }

  // Fallback to coordinator (receipt only, no walrus/payments)
  try {
    const res = await fetch(`${COORDINATOR_URL}/v1/proofs/${requestId}`);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const receiptJson = await res.json();
    return new Response(JSON.stringify({
      receipt: {
        request_id: requestId,
        receipt_json: receiptJson,
        created_at: new Date(receiptJson.timestamp_ms).toISOString(),
        walrus_blob_id: null,
      },
      payments: (receiptJson.payouts ?? []).map((p: { sui_address: string; amount_nanox: number }, i: number) => ({
        id: `${requestId}-${i}`,
        request_id: requestId,
        payee_peer_id: receiptJson.primary_peer_id ?? '',
        payee_sui_address: p.sui_address,
        amount_nanox: p.amount_nanox,
        status: 'submitted',
        tx_digest: null,
        created_at: new Date(receiptJson.timestamp_ms).toISOString(),
        submitted_at: null,
        confirmed_at: null,
      })),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'coordinator unreachable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
