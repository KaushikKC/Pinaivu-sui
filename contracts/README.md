# pinaivu-contracts

Sui Move package backing the Pinaivu marketplace.

## Modules

| Module | Purpose |
|---|---|
| `pinaivu::enclave` | Registers the coordinator's NSM-attested Ed25519 key + PCRs on-chain. `verify_signature` is the primitive every other module uses to authenticate the coordinator. |
| `pinaivu::receipts` | Defines the BCS payload shape the coordinator signs on every routing receipt, plus a `verify_completion_receipt` helper. |
| `pinaivu::vault` | Holds a Pinaivu-funded treasury per coin type. `settle` disburses to a node only against a verified coordinator receipt that names that node + amount. |

## Build

```bash
sui move build
```

## Deploy + bootstrap

```bash
# 1. Publish the package
sui client publish --gas-budget 200000000
# → record PACKAGE_ID, Cap<ENCLAVE> object ID, EnclaveConfig<ENCLAVE> shared object ID

# 2. Update placeholder PCRs to match the coordinator's reproducible build
sui client call \
  --package $PACKAGE_ID --module enclave --function update_pcrs \
  --type-args "$PACKAGE_ID::enclave::ENCLAVE" \
  --args $ENCLAVE_CONFIG_ID $CAP_ID <pcr0_hex> <pcr1_hex> <pcr2_hex>

# 3. Create a vault for each supported token (SUI shown; repeat for USDC etc.)
sui client call \
  --package $PACKAGE_ID --module vault --function new_vault \
  --type-args "0x2::sui::SUI"

# 4. Top up the treasury so it can pay nodes
sui client call \
  --package $PACKAGE_ID --module vault --function top_up \
  --type-args "0x2::sui::SUI" --args $VAULT_ID $FUNDING_COIN_ID
```

## How settlement works

```
                       ┌────────────────────────────────┐
PINAIVU (treasury)  ──▶│   vault::top_up(SUI coins)     │
                       └────────────────┬───────────────┘
                                        │
                                        ▼  Balance<SUI>
client → coordinator → nodes complete inference, send CompletionAck
                                        │
                                        ▼  per-node payouts computed by coordinator
                       ┌────────────────────────────────┐
                       │ coordinator signs RoutingReceipt│
                       │ { request_id, output_hash,      │
                       │   payouts: [(addr, amount), …] }│
                       └────────────────┬───────────────┘
                                        │  one PTB with N settle() calls
                                        ▼
                       ┌────────────────────────────────┐
                       │ vault::settle( ..., signature) │
                       │  ├─ verify_completion_receipt  │
                       │  ├─ check (payee,amount) in    │
                       │  │  payouts                    │
                       │  ├─ dedup (request_id ‖ payee) │
                       │  └─ pay out from treasury      │
                       └────────────────────────────────┘
```

Even a compromised coordinator operator key cannot drain the treasury:
every `settle` call requires a signature made by the **NSM-attested
enclave key** that's registered on-chain — and that signature
commits to the exact `(payee, amount)` pair being paid.
