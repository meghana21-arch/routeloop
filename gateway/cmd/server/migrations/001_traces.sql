CREATE TABLE IF NOT EXISTS traces (
    request_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    workload TEXT NOT NULL DEFAULT '',
    latency_ms BIGINT NOT NULL,
    cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS traces_created_at_idx ON traces (created_at DESC);
CREATE INDEX IF NOT EXISTS traces_provider_created_at_idx ON traces (provider, created_at DESC);
