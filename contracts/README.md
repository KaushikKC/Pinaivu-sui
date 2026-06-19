# pinaivu-contracts

Sui Move package backing the Pinaivu marketplace.

## Modules

| Module | Purpose |
|---|---|
| `pinaivu::enclave` | Registers the coordinator's NSM-attested Ed25519 key + PCRs on-chain. `verify_signature` is the primitive every other module uses to authenticate the coordinator. |
| `pinaivu::receipts` *(soon)* | `verify_completion_receipt` entry function — checks a coordinator-signed `RoutingReceipt` is authentic. |
| `pinaivu::vault` *(soon)* | Holds client deposits and disburses payouts to nodes — only against a valid coordinator-signed receipt. |

## Build

```bash
sui move build
```

## Deploy

```bash
sui client publish --gas-budget 200000000
# Note the PackageID + EnclaveConfig object ID returned; store them in
# the coordinator's .env.runtime as PINAIVU_SUI_PACKAGE_ID and
# PINAIVU_ENCLAVE_CONFIG_ID.
```

After the coordinator's reproducible build emits new PCRs, the admin
holding the `Cap<ENCLAVE>` calls `update_pcrs` and the coordinator
registers a fresh `Enclave<ENCLAVE>` on next boot via `register_enclave`.
