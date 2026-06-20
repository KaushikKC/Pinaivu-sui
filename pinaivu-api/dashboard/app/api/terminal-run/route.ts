import { NextRequest, NextResponse } from 'next/server';

const COORDINATOR_URL = process.env.COORDINATOR_URL ?? 'https://13.206.80.190:4000';

export async function POST(req: NextRequest) {
  try {
    const { prompt, model } = await req.json();

    const res = await fetch(`${COORDINATOR_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model: model || 'gemma4-e4b-128k:latest',
        client_pubkey_hex: '0'.repeat(64),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Request failed' },
      { status: 502 },
    );
  }
}
