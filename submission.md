# Pinaivu — Submission

## Challenge Explanation

**Describe how you are incorporating the selected challenge(s).**

We are incorporating the **Walrus decentralised storage** challenge (alongside our core Sui Move settlement layer). Pinaivu is a decentralised AI inference protocol, and the natural fit for Walrus is everything that has to be *durable, censorship-resistant, and publicly auditable without trusting a central server*. Two production data paths in Pinaivu run on Walrus today:

1. **Encrypted cross-session memory.** The chat relayer maintains conversation history across sessions. Each session blob is encrypted with a per-owner HKDF-derived AES-256-GCM key *inside the Nitro Enclave* and then written to Walrus. Because the data is encrypted before it ever leaves the enclave, Walrus gives us decentralised, operator-blind storage — no party, including us, can read a user's history, yet the user can reconstruct it from any node.

2. **Receipt archival.** Every inference produces an Ed25519-signed routing receipt. The explorer indexer batches these receipts and archives them to Walrus on a cron, giving us permanent, tamper-evident, publicly verifiable storage of the protocol's full inference history — the thing that makes "verify, don't trust" actually hold over time.

**Explain your approach to the challenge(s).**

Our guiding principle was: *put on Walrus the data whose value comes from being decentralised and durable, and keep on the hot path the data whose value comes from being fast.* Encrypted memory blobs and signed receipts are write-once / read-occasionally artefacts where decentralisation matters more than microsecond latency — a perfect match for Walrus. We encrypt at the enclave boundary so Walrus never sees plaintext, content-address what we store, and anchor the proofs that gate on-chain settlement (Sui Move `vault::settle`) to those durable records.

The more interesting part of the approach was discovering where Walrus is *not* the right tool — see the KV-cache exploration in the Submission Details below. Part of incorporating the challenge well was being honest about its boundaries rather than forcing every byte through it.

---

## Submission Details

**Provide a detailed explanation of your submission — what you've done, the process, and relevant context.**

### What we built

Pinaivu is a full end-to-end decentralised AI inference protocol on Sui:

- A **coordinator** running inside an AWS Nitro Enclave runs a real-time auction over a libp2p gossipsub mesh, picks the winning GPU node by price/latency/reputation, issues a signed dispatch token, and signs an Ed25519 routing receipt for every inference.
- **GPU nodes** (Rust) connect to the mesh, bid on requests, and serve inference via Ollama.
- **Sui Move contracts** handle enclave registration, BCS receipt-signature verification, and trustless treasury settlement (`vault::settle` pays the node only after verifying the coordinator's receipt).
- A **chat relayer** provides stateful cross-session memory with pgvector embeddings and **Walrus-backed encrypted storage**.
- An **explorer indexer** archives every receipt to **Walrus** and exposes a REST API for public auditability.
- An **OpenAI-compatible API gateway** and a Next.js chat UI + on-chain explorer round out the stack.

Walrus is wired into the two paths described above: enclave-encrypted session memory, and receipt archival.

### The process — and the KV-cache exploration

The most instructive part of the build was a problem we hit while trying to make multi-node inference more efficient: **sharing KV-cache blocks between nodes** that are doing the prompt computation.

When two requests share a common prefix (a system prompt, a shared document, a long conversation context), the attention KV-cache for that prefix is identical. In principle, if Node A has already computed the KV-cache for a prefix, Node B serving a request with the same prefix shouldn't have to recompute it — it could fetch the cached blocks and skip the prefill. So we asked: *can Walrus be the shared substrate for KV-cache blocks across nodes?*

**What we tried.** Our first instinct was to store KV-cache blocks in Walrus so any node in the network could pull a prefix's cache instead of recomputing it. We prototyped against this idea directly.

**Why it didn't work.**
- **The HTTPS/network boundary kills the economics.** KV-cache blocks are large and extremely latency-sensitive — they sit on the critical path of every token. Pulling them over an HTTPS round-trip to a decentralised store is far slower than just re-running prefill locally on the GPU. The whole point of caching is to *save* time; a network fetch through a storage layer spends more than it saves. Walrus is built for durable, content-addressed blobs, not for hot, per-request tensor data on the inference critical path.
- **It targets the wrong layer.** KV-cache sharing is fundamentally an *intra-cluster, same-engine* optimisation. Within a single cluster of nodes running the same model, this is already solvable directly through **vLLM configuration** (prefix caching / shared KV-cache features at the inference-engine level), which keeps the blocks in GPU/host memory where they belong — no decentralised storage round-trip involved.

**Where it could still make sense.** As the network scales to clusters of nodes operating together, there may be a role for a shared cache *within* a cluster — but even then the right primitive is the inference engine's own KV-cache sharing (vLLM), not Walrus. We concluded that Walrus is the wrong tool for the *hot* KV-cache path, and the right tool for the *durable* paths (encrypted memory, receipts), which is exactly how we use it.

### Why this matters for the submission

This exploration shaped a clean separation of concerns that we think is the correct architecture:

- **Hot path (latency-critical):** KV-cache sharing stays inside the inference engine (vLLM/Ollama config), in GPU/host memory.
- **Durable path (decentralisation-critical):** encrypted cross-session memory and signed receipts go on **Walrus**, where censorship-resistance and permanence are the actual requirements.

So our incorporation of the Walrus challenge is deliberate rather than incidental: we use Walrus precisely where its strengths — durable, content-addressed, decentralised, operator-blind storage — are the deciding factor, and we explicitly ruled it out where they aren't. The result is a protocol where private user memory and the full verifiable receipt history live on decentralised storage, settlement is trustless on Sui, and the performance-sensitive inference path stays fast.
