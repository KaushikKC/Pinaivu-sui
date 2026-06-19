// Receipt verification.
//
// Defines the BCS-encoded payload that matches the coordinator's
// `RoutingReceipt::intent_message_bytes()` and exposes a single
// helper used by `vault::settle` (and by any off-chain auditor) to
// check that a (request_id, payouts) bundle is authentic.

module pinaivu::receipts;

use pinaivu::enclave::{Self, Enclave, ENCLAVE};

/// Intent scope reserved for routing receipts. Must match
/// `INTENT_ROUTING_RECEIPT` in the coordinator's Rust code.
const INTENT_ROUTING_RECEIPT: u8 = 1;

/// One payout entry inside a `ReceiptPayload`. The Sui address is the
/// node's advertised `payout_address` from its `InferenceBid`.
public struct Payout has copy, drop {
    sui_address: address,
    amount: u64,
}

/// The on-chain shape of the receipt payload. Field order matters —
/// it has to match the BCS encoding produced by the coordinator.
public struct ReceiptPayload has copy, drop {
    request_id: vector<u8>,
    aggregated_output_hash: vector<u8>,
    payouts: vector<Payout>,
}

public fun new_payout(sui_address: address, amount: u64): Payout {
    Payout { sui_address, amount }
}

public fun payout_address(p: &Payout): address { p.sui_address }
public fun payout_amount(p: &Payout): u64 { p.amount }

/// Verify a coordinator-signed routing receipt. Returns `true` only if
/// the signature is valid under the registered enclave's key.
public fun verify_completion_receipt(
    enclave: &Enclave<ENCLAVE>,
    timestamp_ms: u64,
    request_id: vector<u8>,
    aggregated_output_hash: vector<u8>,
    payouts: vector<Payout>,
    signature: &vector<u8>,
): bool {
    let payload = ReceiptPayload {
        request_id,
        aggregated_output_hash,
        payouts,
    };
    enclave::verify_signature<ENCLAVE, ReceiptPayload>(
        enclave,
        INTENT_ROUTING_RECEIPT,
        timestamp_ms,
        payload,
        signature,
    )
}
