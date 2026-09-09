CREATE TABLE IF NOT EXISTS evaluations (
    id BIGSERIAL PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES traces(request_id) ON DELETE CASCADE,
    evaluator_id TEXT NOT NULL,
    evaluator_version TEXT NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    passed BOOLEAN NOT NULL,
    checks INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS evaluations_request_created_idx ON evaluations (request_id, created_at DESC);
