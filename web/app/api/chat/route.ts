import { NextRequest } from 'next/server';

const DUMMY_PUBKEY = '0'.repeat(64);

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const apiUrl = process.env.PINAIVU_API_URL;

  if (!apiUrl) {
    return new Response(
      generateMockStream(messages),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      },
    );
  }

  let model = process.env.PINAIVU_MODEL ?? '';

  // Auto-detect model from coordinator if not configured
  if (!model) {
    try {
      const modelsRes = await fetch(`${apiUrl}/v1/models`);
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        model = modelsData.data?.[0]?.id ?? '';
      }
    } catch {}
  }

  if (!model) {
    return new Response(
      JSON.stringify({ error: 'No models available. No GPU nodes are connected.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    // Single call — coordinator dispatches over libp2p and returns content directly.
    // Retry up to 5 times with increasing delay — gossipsub mesh needs a few
    // seconds to warm up before bids arrive in time for the auction window.
    let res: Response | null = null;
    const delays = [2000, 3000, 3000, 4000];
    for (let attempt = 0; attempt < 5; attempt++) {
      res = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model,
          client_pubkey_hex: DUMMY_PUBKEY,
        }),
      });
      if (res.ok) break;
      if (res.status === 503 && attempt < 4) {
        await new Promise(r => setTimeout(r, delays[attempt] ?? 3000));
        continue;
      }
    }

    const text = await res!.text();

    if (!res!.ok) {
      return new Response(
        JSON.stringify({ error: `API error: ${res!.status} - ${text}` }),
        { status: res!.status, headers: { 'Content-Type': 'application/json' } },
      );
    }

    let reply;
    try {
      reply = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({ error: `Invalid response: ${text.slice(0, 200)}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const requestId = reply.request_id ?? '';
    const content = reply.content ?? '';
    const latencyMs = reply.latency_ms ?? 0;

    // Ingest receipt into local indexer (fire-and-forget)
    const indexerUrl = process.env.NEXT_PUBLIC_INDEXER_URL;
    const coordinatorUrl = process.env.PINAIVU_COORDINATOR_URL ?? 'https://13.206.80.190:4000';
    if (indexerUrl && requestId) {
      (async () => {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const proofRes = await fetch(`${coordinatorUrl}/v1/proofs/${requestId}`);
          if (proofRes.ok) {
            const receiptJson = await proofRes.json();
            await fetch(`${indexerUrl}/api/ingest`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                request_id: requestId,
                receipt_json: receiptJson,
                primary_peer_id: receiptJson.primary_peer_id ?? '',
                payout_address: receiptJson.payouts?.[0]?.sui_address ?? '',
                amount_nanox: receiptJson.payouts?.[0]?.amount_nanox ?? 0,
                input_tokens: reply.input_tokens ?? 0,
                output_tokens: reply.output_tokens ?? 0,
                latency_ms: latencyMs,
              }),
            });
          }
        } catch {}
      })();
    }

    // Stream content back to the client as SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const words = content.split(' ');

        for (let i = 0; i < words.length; i++) {
          const token = (i === 0 ? '' : ' ') + words[i];
          const chunk = JSON.stringify({
            choices: [{ delta: { content: token } }],
          });
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          await new Promise(r => setTimeout(r, 15));
        }

        const meta = JSON.stringify({
          meta: {
            request_id: requestId,
            node_peer_id: reply.primary_peer_id ?? '',
            latency_ms: latencyMs,
            recalled_facts: reply.recalled_facts ?? [],
          },
        });
        controller.enqueue(encoder.encode(`data: ${meta}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

function generateMockStream(messages: { role: string; content: string }[]): ReadableStream {
  const lastMessage = messages[messages.length - 1]?.content ?? '';
  const response = getMockResponse(lastMessage);
  const words = response.split(' ');

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      for (let i = 0; i < words.length; i++) {
        const token = (i === 0 ? '' : ' ') + words[i];
        const chunk = JSON.stringify({
          choices: [{ delta: { content: token } }],
        });
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        await new Promise(r => setTimeout(r, 30 + Math.random() * 40));
      }

      const meta = JSON.stringify({
        meta: {
          request_id: crypto.randomUUID(),
          node_peer_id: '12D3KooWMock' + Math.random().toString(36).slice(2, 10),
          latency_ms: Math.floor(200 + Math.random() * 800),
          recalled_facts: [],
        },
      });
      controller.enqueue(encoder.encode(`data: ${meta}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

function getMockResponse(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes('move') && lower.includes('solidity')) {
    return "Move and Solidity differ fundamentally in their approach to smart contract development.\n\n**Resource-oriented vs Account-based:** Move uses a resource model where assets are first-class types that cannot be copied or implicitly discarded. Solidity uses an account-balance model where tokens are tracked via mappings.\n\n**Safety guarantees:** Move's type system enforces linear types at the compiler level, preventing common vulnerabilities like reentrancy attacks. Solidity relies on developer discipline and patterns like checks-effects-interactions.\n\n**Object model (Sui Move):** Sui's variant of Move introduces an object-centric model where each on-chain entity is an object with a unique ID, enabling parallel transaction execution.\n\n**Key differences:**\n- Move has no dynamic dispatch, reducing attack surface\n- Move modules are published as bytecode verified on-chain\n- Sui Move supports shared and owned objects for flexible access control\n\nFor developers coming from Solidity, the biggest mental shift is thinking about assets as *resources that move between owners* rather than *balances in a ledger*.";
  }

  if (lower.includes('nft') && lower.includes('marketplace')) {
    return "Here's a Sui Move module for a basic NFT marketplace:\n\n```move\nmodule marketplace::nft_market {\n    use sui::object::{Self, UID};\n    use sui::transfer;\n    use sui::tx_context::TxContext;\n    use sui::coin::Coin;\n    use sui::sui::SUI;\n\n    public struct Listing has key, store {\n        id: UID,\n        price: u64,\n        seller: address,\n    }\n\n    public fun list<T: key + store>(\n        item: T,\n        price: u64,\n        ctx: &mut TxContext,\n    ) {\n        let listing = Listing {\n            id: object::new(ctx),\n            price,\n            seller: tx_context::sender(ctx),\n        };\n        transfer::public_share_object(listing);\n        transfer::public_transfer(item, object::uid_to_address(&listing.id));\n    }\n\n    public fun buy<T: key + store>(\n        listing: Listing,\n        payment: Coin<SUI>,\n        ctx: &mut TxContext,\n    ) {\n        let Listing { id, price, seller } = listing;\n        assert!(coin::value(&payment) >= price, 0);\n        transfer::public_transfer(payment, seller);\n        object::delete(id);\n    }\n}\n```\n\nThis demonstrates Sui Move's object model — each listing is a shared object that anyone can interact with, while the NFT itself is transferred to escrow.";
  }

  if (lower.includes('decentrali') && lower.includes('ai')) {
    return "Decentralised AI inference offers several compelling advantages over centralised alternatives:\n\n**Privacy:** Your prompts and conversations don't pass through a single company's servers. With TEE (Trusted Execution Environment) enclaves, even the node operator can't see your data.\n\n**Censorship resistance:** No single entity can decide what questions you're allowed to ask or what models you can access.\n\n**Cost efficiency:** A competitive marketplace of GPU providers can drive prices below what centralised providers charge, especially for inference workloads.\n\n**Verifiability:** On-chain receipts and cryptographic attestations prove that your inference was executed correctly, by a specific node, with specific hardware.\n\n**Availability:** A distributed network has no single point of failure. If one node goes down, others can serve your request.\n\nThe main tradeoffs are latency (network overhead for routing and verification) and consistency (model availability varies by node). Pinaivu addresses these through intelligent routing and Sui-based settlement.";
  }

  if (lower.includes('object') && lower.includes('sui')) {
    return "Sui's object-centric design is one of its most distinctive features compared to other blockchains.\n\n**Core concept:** Everything on Sui is an object with a globally unique ID. Unlike account-based blockchains where state lives in contract storage slots, Sui objects are independent entities.\n\n**Object types:**\n- **Owned objects** — belong to a single address, enabling parallel execution since transactions on different owned objects can't conflict\n- **Shared objects** — accessible by anyone, require consensus (like a shared marketplace listing)\n- **Immutable objects** — frozen forever, great for published packages or constants\n\n**Why it matters:**\n1. **Parallel execution** — transactions touching different owned objects run in parallel without coordination\n2. **Simple transfers** — sending an NFT is just changing the owner field, no approval mappings needed\n3. **Composability** — objects can contain other objects (dynamic fields), enabling rich data structures on-chain\n4. **Gas efficiency** — you only pay for the objects your transaction touches\n\nThink of it like a filesystem where every file has a unique path and owner, versus a database where everything is rows in shared tables.";
  }

  return "I'm Pinaivu, a decentralised AI assistant running on the Sui network. I can help you with questions about blockchain development, Move programming, AI, and general topics.\n\nSome things I can help with:\n- **Sui Move development** — writing modules, understanding the object model, deployment\n- **Blockchain concepts** — consensus, cryptography, DeFi, NFTs\n- **General programming** — Rust, TypeScript, Python, and more\n- **AI & ML** — model architectures, inference optimization, privacy-preserving AI\n\nWhat would you like to explore?";
}
