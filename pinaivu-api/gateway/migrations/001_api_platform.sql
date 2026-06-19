-- API Platform tables
-- Run once against the shared Postgres database.

CREATE TABLE IF NOT EXISTS accounts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT        UNIQUE,
    wallet_addr     TEXT,
    credits_nanox   BIGINT      NOT NULL DEFAULT 5000000,
    tier            TEXT        NOT NULL DEFAULT 'free',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    key_hash        TEXT        NOT NULL UNIQUE,
    key_prefix      TEXT        NOT NULL,
    name            TEXT,
    rpm_limit       INTEGER     NOT NULL DEFAULT 60,
    daily_limit     INTEGER     NOT NULL DEFAULT 10000,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_hash_active_idx
    ON api_keys (key_hash) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS api_usage (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID,
    api_key_id      UUID        REFERENCES api_keys(id),
    model           TEXT        NOT NULL,
    input_tokens    INTEGER     NOT NULL DEFAULT 0,
    output_tokens   INTEGER     NOT NULL DEFAULT 0,
    cost_nanox      BIGINT      NOT NULL DEFAULT 0,
    latency_ms      INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_usage_key_created_idx
    ON api_usage (api_key_id, created_at DESC);
