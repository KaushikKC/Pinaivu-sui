# Pinaivu — Project Submission

## Project Description

Pinaivu is a decentralised AI inference protocol built on the Sui blockchain that enables private, verifiable, and censorship-resistant access to large language models. The platform connects users who need AI inference with a distributed network of GPU node operators through a real-time auction marketplace, where every interaction is cryptographically attested and settled on-chain — eliminating the need to trust any single provider with your data or your payments.

The system is architected around a coordinator that runs inside an AWS Nitro Enclave, ensuring that even the infrastructure operator cannot observe user prompts or tamper with the auction process. When a user sends a request, the coordinator broadcasts it to all connected GPU nodes over a libp2p gossipsub mesh. Nodes compete by submitting bids based on price, latency, and reputation. The coordinator selects the optimal node, issues a cryptographically signed dispatch token, and the client communicates directly with the winning node for inference. Upon completion, the coordinator produces an Ed25519-signed routing receipt that is verified on-chain by Sui Move smart contracts, which then autonomously settle payment from a shared treasury vault to the serving node.

The protocol is fully integrated end-to-end: Sui Move contracts handle enclave registration, receipt verification, and treasury settlement; a Rust-based chat relayer provides stateful cross-session memory using pgvector embeddings with encrypted storage on Walrus; an explorer indexer archives receipts for public auditability; and a Next.js web interface offers a ChatGPT-style experience with built-in receipt verification and an on-chain explorer. The API gateway is OpenAI-compatible, meaning existing tools and SDKs can integrate with Pinaivu by simply changing the base URL.

---

## What is your idea?

Today, AI inference is concentrated in the hands of a few large providers. Users must trust these companies not to log their prompts, censor their queries, or overcharge for compute. There is no way to verify which hardware actually served a request, whether the response was tampered with, or where your payment went. This creates a fundamental tension: the most powerful technology of our generation is gated behind opaque, centralised intermediaries.

Pinaivu's idea is to replace this trust-based model with a verify-based one. We built a protocol where:

**Privacy is architectural, not promised.** The coordinator runs inside a hardware-attested Nitro Enclave. Prompts are encrypted end-to-end. Cross-session memory is stored on Walrus with per-user HKDF-derived AES-256-GCM encryption. No party — not even us — can read user conversations.

**Every inference is provably attributable.** Each response generates a routing receipt signed by the enclave's Ed25519 key over the output hash, serving node identity, and payment details. Anyone can verify this receipt offline against the enclave's attestation document. The explorer makes every inference publicly auditable.

**Settlement is trustless and on-chain.** Sui Move smart contracts hold a treasury vault. Payment to GPU nodes happens only when the contract verifies the coordinator's cryptographic receipt — no intermediary can redirect, withhold, or inflate payments. The full settlement lifecycle (pending → submitted → confirmed) is visible on-chain via Sui Explorer.

**Compute is a competitive marketplace.** GPU operators join the network by connecting a node and advertising their models. Requests are auctioned in real time over libp2p, with nodes competing on price, latency, and reputation. This drives costs down and availability up without any central capacity planning.

The result is an AI inference layer that is as open and verifiable as a blockchain, as private as end-to-end encrypted messaging, and as easy to use as ChatGPT — accessible through a familiar chat interface or a drop-in OpenAI-compatible API.
