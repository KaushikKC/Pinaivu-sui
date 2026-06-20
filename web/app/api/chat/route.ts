import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

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

  const lastMessage = messages[messages.length - 1]?.content ?? '';
  const model = 'llama3.1:8b-instruct-q4_K_M';

  try {
    // Step 1: Get dispatch from coordinator directly (no gateway/API key needed — this is our own frontend)
    // Retry up to 3 times — first attempt can 503 while gossipsub mesh warms up
    let dispatchRes: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      dispatchRes = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model,
          client_pubkey_hex: DUMMY_PUBKEY,
        }),
      });
      if (dispatchRes.ok) break;
      if (dispatchRes.status === 503 && attempt < 2) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
    }

    const dispatchText = await dispatchRes!.text();

    if (!dispatchRes!.ok) {
      return new Response(
        JSON.stringify({ error: `Dispatch error: ${dispatchRes!.status} - ${dispatchText}` }),
        { status: dispatchRes!.status, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Extract the raw dispatch_token substring without JSON.parse round-trip
    // to preserve u64 values (max_price_nanox = u64::MAX exceeds
    // Number.MAX_SAFE_INTEGER and would corrupt the signature).
    const tokenStart = dispatchText.indexOf('"dispatch_token":');
    if (tokenStart === -1) {
      return new Response(
        JSON.stringify({ error: `No dispatch_token in response: ${dispatchText.slice(0, 200)}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const braceStart = dispatchText.indexOf('{', tokenStart + 17);
    let depth = 0;
    let braceEnd = braceStart;
    for (let i = braceStart; i < dispatchText.length; i++) {
      if (dispatchText[i] === '{') depth++;
      else if (dispatchText[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
    }
    const rawDispatchToken = dispatchText.slice(braceStart, braceEnd + 1);

    // Safe to parse the outer fields (strings/UUIDs, no u64 issues)
    const nodeUrlMatch = dispatchText.match(/"node_url"\s*:\s*"([^"]+)"/);
    const requestIdMatch = dispatchText.match(/"request_id"\s*:\s*"([^"]+)"/);
    const sessionIdMatch = dispatchText.match(/"session_id"\s*:\s*"([^"]+)"/);
    const peerIdMatch = rawDispatchToken.match(/"primary_peer_id"\s*:\s*"([^"]+)"/);

    if (!nodeUrlMatch || !requestIdMatch) {
      return new Response(
        JSON.stringify({ error: `Could not parse dispatch: ${dispatchText.slice(0, 200)}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const nodeUrl = nodeUrlMatch[1];
    const requestId = requestIdMatch[1];
    const sessionId = sessionIdMatch?.[1] ?? randomUUID();

    // Step 2: Call the node — raw token preserves u64 precision
    const nodeBody = `{"new_user_message":${JSON.stringify(lastMessage)},"session_id":"${sessionId}","dispatch_token":${rawDispatchToken}}`;

    const nodeRes = await fetch(`${nodeUrl}/v1/inference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: nodeBody,
    });

    const nodeText = await nodeRes.text();

    if (!nodeRes.ok) {
      return new Response(
        JSON.stringify({ error: `Node error: ${nodeRes.status} - ${nodeText}` }),
        { status: nodeRes.status, headers: { 'Content-Type': 'application/json' } },
      );
    }

    let nodeReply;
    try {
      nodeReply = JSON.parse(nodeText);
    } catch {
      return new Response(
        JSON.stringify({ error: `Invalid node JSON: ${nodeText.slice(0, 200)}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Step 3: Fetch real receipt from coordinator and ingest into local indexer
    const indexerUrl = process.env.NEXT_PUBLIC_INDEXER_URL;
    const coordinatorUrl = process.env.PINAIVU_COORDINATOR_URL ?? 'https://13.206.80.190:4000';
    if (indexerUrl) {
      (async () => {
        // Wait for coordinator to finalize the receipt
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
                primary_peer_id: receiptJson.primary_peer_id ?? peerIdMatch?.[1] ?? 'unknown',
                payout_address: receiptJson.payouts?.[0]?.sui_address ?? '',
                amount_nanox: receiptJson.payouts?.[0]?.amount_nanox ?? 0,
                input_tokens: nodeReply.input_tokens ?? 0,
                output_tokens: nodeReply.output_tokens ?? 0,
                latency_ms: nodeReply.latency_ms ?? 0,
              }),
            });
          }
        } catch {}
      })();
    }

    // Step 4: Stream the response back to the client as SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const content = nodeReply.content ?? '';
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
            node_peer_id: peerIdMatch?.[1] ?? 'unknown',
            latency_ms: nodeReply.latency_ms ?? 0,
            recalled_facts: [],
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
    return "Here's a Sui Move module for a basic NFT marketplace:\n\n```move\nmodule marketplace::nft_market {\n    use sui::object::{Self, UID};\n    use sui::transfer;\n    use sui::tx_context::TxContext;\n    use sui::coin::Coin;\n    use sui::sui::SUI;\n\n    public struct Listing has key, store {\n        id: UID,\n        price: u64,\n        seller: address,\n    }\n\n    public fun list<T: key + store>(\n        item: T,\n        price: u64,\n        ctx: &mut TxContext,\n    ) {\n        let listing = Listing {\n            id: object::new(ctx),\n            price,\n            seller: tx_context::sender(ctx),\n        };\n        transfer::public_share_object(listing);\n        // Transfer item to marketplace escrow\n        transfer::public_transfer(item, object::uid_to_address(&listing.id));\n    }\n\n    public fun buy<T: key + store>(\n        listing: Listing,\n        payment: Coin<SUI>,\n        ctx: &mut TxContext,\n    ) {\n        let Listing { id, price, seller } = listing;\n        assert!(coin::value(&payment) >= price, 0);\n        transfer::public_transfer(payment, seller);\n        object::delete(id);\n    }\n}\n```\n\nThis demonstrates Sui Move's object model — each listing is a shared object that anyone can interact with, while the NFT itself is transferred to escrow.";
  }

  if (lower.includes('decentrali') && lower.includes('ai')) {
    return "Decentralised AI inference offers several compelling advantages over centralised alternatives:\n\n**Privacy:** Your prompts and conversations don't pass through a single company's servers. With TEE (Trusted Execution Environment) enclaves, even the node operator can't see your data.\n\n**Censorship resistance:** No single entity can decide what questions you're allowed to ask or what models you can access.\n\n**Cost efficiency:** A competitive marketplace of GPU providers can drive prices below what centralised providers charge, especially for inference workloads.\n\n**Verifiability:** On-chain receipts and cryptographic attestations prove that your inference was executed correctly, by a specific node, with specific hardware.\n\n**Availability:** A distributed network has no single point of failure. If one node goes down, others can serve your request.\n\nThe main tradeoffs are latency (network overhead for routing and verification) and consistency (model availability varies by node). Pinaivu addresses these through intelligent routing and Sui-based settlement.";
  }

  if (lower.includes('object') && lower.includes('sui')) {
    return "Sui's object-centric design is one of its most distinctive features compared to other blockchains.\n\n**Core concept:** Everything on Sui is an object with a globally unique ID. Unlike account-based blockchains where state lives in contract storage slots, Sui objects are independent entities.\n\n**Object types:**\n- **Owned objects** — belong to a single address, enabling parallel execution since transactions on different owned objects can't conflict\n- **Shared objects** — accessible by anyone, require consensus (like a shared marketplace listing)\n- **Immutable objects** — frozen forever, great for published packages or constants\n\n**Why it matters:**\n1. **Parallel execution** — transactions touching different owned objects run in parallel without coordination\n2. **Simple transfers** — sending an NFT is just changing the owner field, no approval mappings needed\n3. **Composability** — objects can contain other objects (dynamic fields), enabling rich data structures on-chain\n4. **Gas efficiency** — you only pay for the objects your transaction touches\n\nThink of it like a filesystem where every file has a unique path and owner, versus a database where everything is rows in shared tables.";
  }

  return "I'm Pinaivu, a decentralised AI assistant running on the Sui network. I can help you with questions about blockchain development, Move programming, AI, and general topics.\n\nSome things I can help with:\n- **Sui Move development** — writing modules, understanding the object model, deployment\n- **Blockchain concepts** — consensus, cryptography, DeFi, NFTs\n- **General programming** — Rust, TypeScript, Python, and more\n- **AI & ML** — model architectures, inference optimization, privacy-preserving AI\n\nWhat would you like to explore?";
}
