// Pinaivu enclave registration.
//
// Records the coordinator's NSM-attested Ed25519 public key + PCRs
// on-chain so any receipt the coordinator signs can be verified
// permissionlessly. The `PinaivuCoordinator` witness scopes Cap +
// EnclaveConfig + Enclave to this application.

module pinaivu::enclave;

use std::bcs;
use std::string::String;
use sui::ed25519;
use sui::nitro_attestation::NitroAttestationDocument;

use fun to_pcrs as NitroAttestationDocument.to_pcrs;

const EInvalidPCRs: u64 = 0;
const EInvalidConfigVersion: u64 = 1;
const EInvalidCap: u64 = 2;
const EInvalidOwner: u64 = 3;
const ECannotDestroyCurrentEnclave: u64 = 5;

const VERSION: u64 = 0;

/// SHA-384 digests reported by NSM for the running enclave image
/// (PCR0 = enclave image, PCR1 = kernel, PCR2 = application).
public struct Pcrs(vector<u8>, vector<u8>, vector<u8>) has copy, drop, store;

/// Configuration describing which PCRs a registered Pinaivu coordinator
/// must match. Owned/admin-managed via the corresponding `Cap`.
public struct EnclaveConfig<phantom T> has key {
    id: UID,
    name: String,
    pcrs: Pcrs,
    capability_id: ID,
    version: u64,
    current_enclave_id: Option<ID>,
}

/// A registered coordinator instance. `pk` is the Ed25519 public key
/// pulled from the NSM attestation; any signature claimed to come from
/// the coordinator must verify against this key.
public struct Enclave<phantom T> has key {
    id: UID,
    pk: vector<u8>,
    config_version: u64,
    owner: address,
    version: u64,
}

/// Administrative capability — only the holder can update PCRs or
/// register new enclave instances for a given EnclaveConfig.
public struct Cap<phantom T> has key, store {
    id: UID,
}

/// Wrapper used for every signed payload. The `intent` byte scopes
/// the signature (e.g. routing-receipt = 1) so a signature over one
/// payload type cannot be replayed as another.
public struct IntentMessage<T: drop> has copy, drop {
    intent: u8,
    timestamp_ms: u64,
    payload: T,
}

/// One-time-witness for module init. Becomes the type parameter T
/// throughout — `EnclaveConfig<ENCLAVE>`, etc.
public struct ENCLAVE has drop {}

fun init(otw: ENCLAVE, ctx: &mut TxContext) {
    let cap = new_cap(otw, ctx);

    cap.create_enclave_config(
        b"Pinaivu Coordinator".to_string(),
        // PCR placeholders — `update_pcrs` is called from the deploy
        // workflow once the reproducible build emits coordinator.pcrs.
        x"000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        x"000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        x"000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        ctx,
    );

    transfer::public_transfer(cap, ctx.sender())
}

entry fun migrate<T>(config: &mut EnclaveConfig<T>, cap: &Cap<T>) {
    assert!(cap.id.to_inner() == config.capability_id, EInvalidCap);
    assert!(config.version < VERSION, EInvalidConfigVersion);
    config.version = VERSION;
}

public fun new_cap<T: drop>(_: T, ctx: &mut TxContext): Cap<T> {
    Cap { id: object::new(ctx) }
}

public fun create_enclave_config<T: drop>(
    cap: &Cap<T>,
    name: String,
    pcr0: vector<u8>,
    pcr1: vector<u8>,
    pcr2: vector<u8>,
    ctx: &mut TxContext,
) {
    let enclave_config = EnclaveConfig<T> {
        id: object::new(ctx),
        name,
        pcrs: Pcrs(pcr0, pcr1, pcr2),
        capability_id: cap.id.to_inner(),
        version: 0,
        current_enclave_id: option::none(),
    };

    transfer::share_object(enclave_config);
}

/// Verify the supplied NSM attestation document, extract its public
/// key, and publish a new `Enclave<T>` object. `cap` proves the caller
/// is authorised; PCR mismatch aborts.
public fun register_enclave<T>(
    enclave_config: &mut EnclaveConfig<T>,
    cap: &Cap<T>,
    document: NitroAttestationDocument,
    ctx: &mut TxContext,
) {
    cap.assert_is_valid_for_config(enclave_config);

    let pk = enclave_config.load_pk(&document);

    let enclave = Enclave<T> {
        id: object::new(ctx),
        pk,
        config_version: enclave_config.version,
        owner: ctx.sender(),
        version: VERSION,
    };

    let enclave_id = object::id(&enclave);
    enclave_config.current_enclave_id = option::some(enclave_id);

    transfer::share_object(enclave);
}

/// Verify that `signature` is a valid Ed25519 signature, by the
/// enclave's registered public key, over `IntentMessage { intent_scope,
/// timestamp_ms, payload }`. Callers (e.g. `vault::settle`,
/// `receipts::verify_completion_receipt`) wrap this with their own
/// payload type.
public fun verify_signature<T, P: drop>(
    enclave: &Enclave<T>,
    intent_scope: u8,
    timestamp_ms: u64,
    payload: P,
    signature: &vector<u8>,
): bool {
    let intent_message = create_intent_message(intent_scope, timestamp_ms, payload);
    let payload_bytes = bcs::to_bytes(&intent_message);
    ed25519::ed25519_verify(signature, &enclave.pk, &payload_bytes)
}

/// Replace the expected PCRs (e.g. after a reproducible build emits
/// new measurements). Clears `current_enclave_id` so a new enclave
/// must register under the updated PCRs.
public fun update_pcrs<T: drop>(
    config: &mut EnclaveConfig<T>,
    cap: &Cap<T>,
    pcr0: vector<u8>,
    pcr1: vector<u8>,
    pcr2: vector<u8>,
) {
    cap.assert_is_valid_for_config(config);
    config.pcrs = Pcrs(pcr0, pcr1, pcr2);
    config.current_enclave_id = option::none();
}

public fun update_name<T: drop>(config: &mut EnclaveConfig<T>, cap: &Cap<T>, name: String) {
    cap.assert_is_valid_for_config(config);
    config.name = name;
}

public fun pcr0<T>(config: &EnclaveConfig<T>): &vector<u8> { &config.pcrs.0 }
public fun pcr1<T>(config: &EnclaveConfig<T>): &vector<u8> { &config.pcrs.1 }
public fun pcr2<T>(config: &EnclaveConfig<T>): &vector<u8> { &config.pcrs.2 }
public fun pk<T>(enclave: &Enclave<T>): &vector<u8> { &enclave.pk }

public fun destroy_old_enclave<T>(
    e: Enclave<T>,
    config: &EnclaveConfig<T>,
    cap: &Cap<T>,
) {
    cap.assert_is_valid_for_config(config);

    let enclave_id = object::id(&e);
    if (option::is_some(&config.current_enclave_id)) {
        let current_id = *option::borrow(&config.current_enclave_id);
        assert!(enclave_id != current_id, ECannotDestroyCurrentEnclave);
    };

    assert!(e.config_version < config.version, EInvalidConfigVersion);

    let Enclave { id, .. } = e;
    id.delete();
}

public fun destroy_old_enclave_by_owner<T>(e: Enclave<T>, ctx: &mut TxContext) {
    assert!(e.owner == ctx.sender(), EInvalidOwner);
    let Enclave { id, .. } = e;
    id.delete();
}

public fun is_current_enclave<T>(config: &EnclaveConfig<T>, enclave: &Enclave<T>): bool {
    if (option::is_some(&config.current_enclave_id)) {
        let current_id = *option::borrow(&config.current_enclave_id);
        object::id(enclave) == current_id
    } else {
        false
    }
}

public fun current_enclave_id<T>(config: &EnclaveConfig<T>): Option<ID> {
    config.current_enclave_id
}

// === helpers ===

fun assert_is_valid_for_config<T>(cap: &Cap<T>, enclave_config: &EnclaveConfig<T>) {
    assert!(cap.id.to_inner() == enclave_config.capability_id, EInvalidCap);
}

fun load_pk<T>(enclave_config: &EnclaveConfig<T>, document: &NitroAttestationDocument): vector<u8> {
    assert!(document.to_pcrs() == enclave_config.pcrs, EInvalidPCRs);
    (*document.public_key()).destroy_some()
}

fun to_pcrs(document: &NitroAttestationDocument): Pcrs {
    let pcrs = document.pcrs();
    Pcrs(*pcrs[0].value(), *pcrs[1].value(), *pcrs[2].value())
}

fun create_intent_message<P: drop>(intent: u8, timestamp_ms: u64, payload: P): IntentMessage<P> {
    IntentMessage { intent, timestamp_ms, payload }
}
