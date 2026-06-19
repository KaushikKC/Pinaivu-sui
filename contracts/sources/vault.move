// Escrow + settlement vault for Pinaivu inference jobs.
//
// Clients deposit funds tagged with a `request_id` before submitting
// the inference. The coordinator, after verifying a completion ack,
// submits one or more `settle` calls — each of which authenticates a
// coordinator-signed routing receipt and pays out the matching node.
// If no settlement happens before the deadline, the client can pull
// their escrow back via `refund`.
//
// Generic over the coin type `T` so the same vault contract supports
// multiple settlement tokens (USDC, SUI, …) by parameterising at
// publish time.

module pinaivu::vault;

use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::table::{Self, Table};

use pinaivu::enclave::Enclave;
use pinaivu::enclave::ENCLAVE;
use pinaivu::receipts::{Self, Payout};

const EAlreadyDeposited: u64 = 0;
const EAlreadySettled: u64 = 1;
const EInvalidReceipt: u64 = 2;
const EPayeeNotInReceipt: u64 = 3;
const EEscrowNotFound: u64 = 4;
const ENotEscrowOwner: u64 = 5;
const EDeadlineNotElapsed: u64 = 6;
const EInsufficientEscrow: u64 = 7;

/// Per-request escrow record kept inside the vault.
public struct Escrow<phantom T> has store {
    client: address,
    balance: Balance<T>,
    /// Unix-millis after which the client may pull funds back if
    /// settlement hasn't happened yet.
    refundable_after_ms: u64,
}

/// One shared vault per settlement token type. Owned by no one;
/// `deposit` / `settle` / `refund` are the only ways to move funds.
public struct Vault<phantom T> has key {
    id: UID,
    /// request_id (16-byte UUID, raw bytes) → escrow.
    escrows: Table<vector<u8>, Escrow<T>>,
    /// request_ids already settled — prevents replay of the same
    /// receipt against a refunded or already-paid escrow.
    settled: Table<vector<u8>, bool>,
}

/// Permissionless one-time setup: creates an empty vault for token
/// type `T` and shares it. Callers parameterise `T` per coin type they
/// want supported (e.g. SUI, USDC, …).
public fun new_vault<T>(ctx: &mut TxContext) {
    let vault = Vault<T> {
        id: object::new(ctx),
        escrows: table::new(ctx),
        settled: table::new(ctx),
    };
    transfer::share_object(vault);
}

/// Client deposits funds for a specific request. The deadline gates
/// when the client can pull their money back if no settlement lands.
public fun deposit<T>(
    vault: &mut Vault<T>,
    request_id: vector<u8>,
    refundable_after_ms: u64,
    payment: Coin<T>,
    ctx: &mut TxContext,
) {
    assert!(!table::contains(&vault.escrows, request_id), EAlreadyDeposited);
    assert!(!table::contains(&vault.settled, request_id), EAlreadySettled);

    let escrow = Escrow<T> {
        client: ctx.sender(),
        balance: coin::into_balance(payment),
        refundable_after_ms,
    };
    table::add(&mut vault.escrows, request_id, escrow);
}

/// Pay out `amount` to `payee` against a coordinator-signed receipt.
/// Aborts unless:
///   * the receipt signature verifies under the registered enclave key,
///   * `(payee, amount)` appears in `payouts`,
///   * the escrow has enough balance left.
///
/// The receipt itself may name multiple payouts; the coordinator
/// submits one `settle` call per payee in a single PTB.
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
    assert!(!table::contains(&vault.settled, request_id), EAlreadySettled);
    assert!(table::contains(&vault.escrows, request_id), EEscrowNotFound);

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

    let escrow = table::borrow_mut(&mut vault.escrows, request_id);
    assert!(balance::value(&escrow.balance) >= amount, EInsufficientEscrow);

    // Pay out exactly `amount` to the named address.
    let payment = coin::from_balance(balance::split(&mut escrow.balance, amount), ctx);
    transfer::public_transfer(payment, payee);
}

/// Mark a request as fully settled and refund any dust back to the
/// client. The coordinator submits this once per request, after all
/// `settle` calls for that request have landed.
public fun finalize<T>(
    vault: &mut Vault<T>,
    request_id: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(!table::contains(&vault.settled, request_id), EAlreadySettled);
    assert!(table::contains(&vault.escrows, request_id), EEscrowNotFound);

    let Escrow { client, balance, refundable_after_ms: _ } =
        table::remove(&mut vault.escrows, request_id);

    if (balance::value(&balance) > 0) {
        let leftover = coin::from_balance(balance, ctx);
        transfer::public_transfer(leftover, client);
    } else {
        balance::destroy_zero(balance);
    };

    table::add(&mut vault.settled, request_id, true);
}

/// Client-driven recovery path: if the deadline elapsed without any
/// settlement landing, the client gets their full deposit back.
public fun refund<T>(
    vault: &mut Vault<T>,
    request_id: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(!table::contains(&vault.settled, request_id), EAlreadySettled);
    assert!(table::contains(&vault.escrows, request_id), EEscrowNotFound);

    let escrow = table::borrow(&vault.escrows, request_id);
    assert!(escrow.client == ctx.sender(), ENotEscrowOwner);
    let now_ms = sui::clock::timestamp_ms(clock);
    assert!(now_ms >= escrow.refundable_after_ms, EDeadlineNotElapsed);

    let Escrow { client, balance, refundable_after_ms: _ } =
        table::remove(&mut vault.escrows, request_id);

    let refund_coin = coin::from_balance(balance, ctx);
    transfer::public_transfer(refund_coin, client);
    table::add(&mut vault.settled, request_id, true);
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
