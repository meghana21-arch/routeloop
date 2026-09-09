# RouteLoop

> Evaluation-driven routing for production LLM traffic.

RouteLoop is an OpenAI-compatible, multi-provider LLM gateway that connects routing decisions to observed quality, cost, latency, and reliability. It is built as a systems project—not a price-comparison dashboard.

## Architecture

```text
Client → Go Gateway → OpenAI / Anthropic / Gemini / Mock
              │
              └→ async telemetry → evaluator → cost + quality metrics
                                         │
                                         └→ routing recommendation
```

## Live demo

Dashboard: **https://routeloop-ten.vercel.app**

The public traffic-control dashboard is read-only. It polls redacted gateway traces when Render is available and falls back to a deterministic seed dataset. The gateway sends real requests when provider keys are supplied and falls back to a reproducible mock provider for zero-cost development and failure injection. Every surface labels its provenance as **LIVE**, **SIMULATED**, or **PLANNED**.

## Run locally

```bash
cp .env.example .env
docker compose up --build
make demo
```

Frontend: `http://localhost:3000` · Gateway: `http://localhost:8080` · Evaluator: `http://localhost:8000/docs`

## MVP capabilities

- OpenAI-compatible `POST /v1/chat/completions`
- OpenAI, Anthropic, Gemini, and deterministic mock adapters
- Server-sent event streaming
- Bounded retries with exponential backoff
- Request-level workload metadata
- In-memory trace capture and normalized cost estimates
- Versioned deterministic evaluation endpoint
- Public responsive dashboard
- Live routing topology and redacted request explorer
- Trace timeline with detail inspection
- Provider inventory and operational health views
- Interactive deterministic evaluation lab
- Cost-quality scenario frontier with explicit provenance
- Architecture and delivery-state map
- Render blueprints and Vercel configuration
- Local Redis, PostgreSQL, Redpanda, and ClickHouse via Docker Compose

## API example

```bash
curl -N http://localhost:8080/v1/chat/completions \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer replace-with-a-long-random-secret' \
  -H 'X-RouteLoop-Workload: customer_support' \
  -d '{"model":"routeloop/auto","stream":true,"messages":[{"role":"user","content":"How can I reset my password?"}]}'
```

## Deployment

Deploy the repository root to Vercel for the dashboard. Create the two Render services from `render.yaml`. Set `WEB_ORIGIN` to the Vercel URL, keep the generated `ROUTELOOP_API_KEY` secret, and add only the provider keys you intend to use. The browser receives only redacted trace metadata; it never receives either API key. Never commit `.env`.

### Durable telemetry

Set the same PostgreSQL `DATABASE_URL` on both Render services. The gateway runs additive, idempotent migrations at startup and falls back to bounded in-memory storage if PostgreSQL is unavailable. The evaluator persists a result only when a request ID and the private `X-RouteLoop-Evaluator-Key` are supplied.

For a long-lived free portfolio deployment, Neon is preferable to Render Free Postgres: Render's free database expires after 30 days. Create a Neon project, copy its pooled connection string, and set it as `DATABASE_URL` on `routeloop-gateway` and `routeloop-evaluator`. No database credential belongs in Vercel or browser code.

Trace queries support `limit`, `offset`, `provider`, `status`, and `search`. Aggregates are available at `GET /v1/metrics`.

## Engineering roadmap

1. Persist immutable routing policies in PostgreSQL and distribute them through Redis.
2. Move trace delivery to Redpanda and analytical queries to ClickHouse.
3. Add circuit breakers, rate limiting, and provider concurrency budgets.
4. Add shadow traffic, replay, canary promotion, hysteresis, and automatic rollback.
5. Publish reproducible k6 benchmarks; replace all dashboard benchmark labels only with measured results.

## Current benchmark status

Benchmark harness is the next milestone. Dashboard values are explicitly demo data until reproducible measurements are checked in.
