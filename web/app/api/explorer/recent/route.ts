import { NextRequest } from 'next/server';

const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? '';

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get('limit') ?? '20';
  const offset = req.nextUrl.searchParams.get('offset') ?? '0';

  if (!INDEXER_URL) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(`${INDEXER_URL}/api/recent?limit=${limit}&offset=${offset}`);
    if (!res.ok) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
