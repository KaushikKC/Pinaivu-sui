// Settlement vault for Pinaivu inference jobs.
//
// Holds a single shared treasury per supported coin type `T`. Pinaivu
// tops the treasury up periodically; the coordinator settles by
// submitting one `settle` call per payee, each authenticated by a
// coordinator-signed routing receipt that the on-chain enclave key
// must verify.
//
// Generic over the coin type so the same module supports multiple
// settlement tokens (SUI, USDC, …) by publishing one vault per type.

module pinaivu::vault;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use sui::table::{Self, Table};

use pinaivu::enclave::Enclave;
use pinaivu::enclave::ENCLAVE;
use pinaivu::receipts::{Self, Payout};

const EAlreadySettled: u64 = 0;
const EInvalidReceipt: u64 = 1;
const EPayeeNotInReceipt: u64 = 2;
const EInsufficientTreasury: u64 = 3;

/// One shared vault per settlement token type. Pinaivu funds it via
/// `top_up`; `settle` is the only path that moves money out.
public struct Vault<phantom T> has key {
    id: UID,
    treasury: Balance<T>,
    /// (request_id ‖ payee) → settled. Prevents a single signed
    /// payout from being replayed against the treasury more than
    /// once. Same payee may appear in multiple request_ids; the
    /// composite key keeps them distinct.
    settled: Table<vector<u8>, bool>,
}

public struct TreasuryToppedUp has copy, drop {
    amount: u64,
    new_total: u64,
    funder: address,
}

public struct Settled has copy, drop {
    request_id: vector<u8>,
    payee: address,
    amount: u64,
    timestamp_ms: u64,
}

/// Permissionless one-time setup: creates an empty vault for token
/// type `T` and shares it.
public fun new_vault<T>(ctx: &mut TxContext) {
    let vault = Vault<T> {
        id: object::new(ctx),
        treasury: balance::zero<T>(),
        settled: table::new(ctx),
    };
    transfer::share_object(vault);
}

/// Permissionless: anyone can top up the treasury (in practice Pinaivu
/// is the only funder). Emits an event so the explorer can track the
/// funding ledger.
public fun top_up<T>(vault: &mut Vault<T>, payment: Coin<T>, ctx: &mut TxContext) {
    let amount = coin::value(&payment);
    balance::join(&mut vault.treasury, coin::into_balance(payment));
    event::emit(TreasuryToppedUp {
        amount,
        new_total: balance::value(&vault.treasury),
        funder: ctx.sender(),
    });
}

/// Pay out `amount` to `payee` against a coordinator-signed receipt.
/// Aborts unless the receipt verifies and `(payee, amount)` appears in
/// `payouts`. The coordinator submits one `settle` call per payee in
/// a single PTB.
public fun settle<T>(
    vault: &mut Vault<T>,
    enclave: &Enclave<ENCLAVE>,
    request_id: vector<u8>,
    payee: address,
    amount: u64,
    timestamp_ms: u64,
    aggregated_output_hash: vector<u8>,
    payouts: vector<Payout>,
    signature: vector<u8>,
    ctx: &mut TxContext,
) {
    let key = settle_key(&request_id, payee);
    assert!(!table::contains(&vault.settled, key), EAlreadySettled);

    // Authenticate the receipt against the on-chain enclave key.
    let valid = receipts::verify_completion_receipt(
        enclave,
        timestamp_ms,
        request_id,
        aggregated_output_hash,
        payouts,
        &signature,
    );
    assert!(valid, EInvalidReceipt);

    // Confirm `(payee, amount)` is in the receipt's payout list.
    assert!(payout_matches(&payouts, payee, amount), EPayeeNotInReceipt);

    assert!(balance::value(&vault.treasury) >= amount, EInsufficientTreasury);

    let payment = coin::from_balance(balance::split(&mut vault.treasury, amount), ctx);
    transfer::public_transfer(payment, payee);
    table::add(&mut vault.settled, key, true);

    event::emit(Settled { request_id, payee, amount, timestamp_ms });
}

public fun treasury_balance<T>(vault: &Vault<T>): u64 {
    balance::value(&vault.treasury)
}

// === helpers ===

fun payout_matches(payouts: &vector<Payout>, payee: address, amount: u64): bool {
    let n = vector::length(payouts);
    let mut i = 0;
    while (i < n) {
        let p = vector::borrow(payouts, i);
        if (receipts::payout_address(p) == payee
            && receipts::payout_amount(p) == amount) {
            return true
        };
        i = i + 1;
    };
    false
}

/// (request_id ‖ payee_address_bytes) as a dedupe key.
fun settle_key(request_id: &vector<u8>, payee: address): vector<u8> {
    let mut key = *request_id;
    let payee_bytes = sui::address::to_bytes(payee);
    vector::append(&mut key, payee_bytes);
    key
}
