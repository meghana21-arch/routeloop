<div align="center">
  <img src="public/routeloop-mark.svg" width="88" alt="RouteLoop logo" />
  <h1>RouteLoop</h1>
  <p><strong>Control every LLM request. Prove every routing decision.</strong></p>
  <p>An OpenAI-compatible LLM gateway connecting real request routing to durable traces, cost accounting, deterministic evaluations, and operational decision support.</p>
  <p><a href="https://routeloop-ten.vercel.app/"><strong>Live dashboard</strong></a> · <a href="#architecture">Architecture</a> · <a href="#quick-start">Quick start</a> · <a href="#api">API</a></p>

![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs)
![Go](https://img.shields.io/badge/Go-gateway-00ADD8?logo=go&logoColor=white)
![Python](https://img.shields.io/badge/Python-evaluator-3776AB?logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-durable%20telemetry-4169E1?logo=postgresql&logoColor=white)
[![Live](https://img.shields.io/badge/demo-live-52D273)](https://routeloop-ten.vercel.app/)
</div>

---

## Why RouteLoop

Calling an LLM API is easy. Operating several providers responsibly is not. Teams need to know which model handled a request, whether it retried, what it cost, how long it took, and whether the response met a measurable quality bar.

RouteLoop puts those concerns on one request path:

```text
ROUTE → TRACE → EVALUATE → OPTIMIZE → ROUTE
```

The project is deliberately honest about provenance. Every dashboard surface is labeled **LIVE**, **SIMULATED**, or **PLANNED**, so reproducible demo data is never presented as production evidence.

## Live system

| Surface                   | URL                                                                                          | Access              |
| ------------------------- | -------------------------------------------------------------------------------------------- | ------------------- |
| Traffic-control dashboard | [routeloop-ten.vercel.app](https://routeloop-ten.vercel.app/)                                | Public, read-only   |
| Gateway health            | [routeloop-gateway.onrender.com/healthz](https://routeloop-gateway.onrender.com/healthz)     | Public health check |
| Evaluator health          | [routeloop-evaluator.onrender.com/healthz](https://routeloop-evaluator.onrender.com/healthz) | Public health check |

> Render free services can cold-start. If the dashboard initially shows deterministic demo data, allow the gateway a few seconds to wake up.

## Architecture

```mermaid
flowchart LR
    Client[Client / SDK] -->|OpenAI-compatible request| Gateway[Go Gateway]
    Gateway --> Router{Provider router}
    Router --> Gemini[Gemini adapter]
    Router -. configured .-> OpenAI[OpenAI adapter]
    Router -. configured .-> Anthropic[Anthropic adapter]
    Router --> Mock[Deterministic mock]
    Gemini --> Gateway
    OpenAI --> Gateway
    Anthropic --> Gateway
    Mock --> Gateway
    Gateway -->|redacted trace + cost| Postgres[(Neon PostgreSQL)]
    Evaluator[Python evaluator] -->|quality result| Postgres
    Postgres -->|metrics + traces| Dashboard[Next.js dashboard]

    classDef live fill:#102318,stroke:#52d273,color:#edf1f4;
    classDef ready fill:#101923,stroke:#5aa7ff,color:#edf1f4;
    classDef simulated fill:#1b1423,stroke:#b88cff,color:#edf1f4;
    class Gateway,Gemini,Postgres,Evaluator,Dashboard live;
    class OpenAI,Anthropic ready;
    class Mock simulated;
```

| Layer          | Technology                     | Responsibility                                              | State           |
| -------------- | ------------------------------ | ----------------------------------------------------------- | --------------- |
| Dashboard      | Next.js 16 / React 19 / Vercel | Public operations UI, request explorer, evaluation lab      | Live            |
| Gateway        | Go / Render                    | Auth, routing, streaming, retries, normalization, telemetry | Live            |
| Provider       | Google Gemini                  | Current production model traffic                            | Live            |
| Telemetry      | Neon PostgreSQL                | Durable traces, token usage, cost, evaluation joins         | Live            |
| Evaluator      | FastAPI / Render               | Versioned deterministic quality checks                      | Live            |
| Local platform | Redis, Redpanda, ClickHouse    | Future policy distribution and analytical pipeline          | Local / planned |

## What it demonstrates

| Engineering concern        | RouteLoop implementation                                                   |
| -------------------------- | -------------------------------------------------------------------------- |
| Stable client contract     | OpenAI-compatible `POST /v1/chat/completions`                              |
| Multi-provider abstraction | OpenAI, Anthropic, Gemini, and deterministic mock adapters                 |
| Streaming                  | Server-sent event forwarding                                               |
| Resilience                 | Bounded retries with exponential backoff                                   |
| Observability              | Redacted traces, latency, status, tokens, retry count, and normalized cost |
| Persistence                | Additive, idempotent PostgreSQL migrations with bounded in-memory fallback |
| Quality                    | Deterministic, versioned evaluator results joined to request traces        |
| Honest demos               | Explicit live/simulated/planned provenance throughout the UI               |
| Delivery                   | Vercel frontend plus independently deployed Render services                |

## Verified production path

The deployed system has completed a real Gemini request, persisted its trace in Neon, calculated token-based cost, and attached a passing evaluator result. This is a connectivity proof, **not a benchmark claim**. Reproducible load-test results will only be published after the benchmark harness is checked in.

## Quick start

### Prerequisites

- Docker with Compose
- `curl`
- Optional provider key for real traffic; the mock provider works without one

```bash
git clone https://github.com/meghana21-arch/routeloop.git
cd routeloop
cp .env.example .env
docker compose up --build
```

| Service                  | Local URL                    |
| ------------------------ | ---------------------------- |
| Dashboard                | `http://localhost:3000`      |
| Gateway                  | `http://localhost:8080`      |
| Evaluator / OpenAPI docs | `http://localhost:8000/docs` |

Run the deterministic smoke request with `make demo`.

## API

### Chat completions

```bash
curl -N http://localhost:8080/v1/chat/completions \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer replace-with-a-long-random-secret' \
  -H 'X-RouteLoop-Workload: customer_support' \
  -d '{
    "model": "routeloop/auto",
    "stream": true,
    "messages": [{"role": "user", "content": "Explain RouteLoop in one sentence."}]
  }'
```

### Operational endpoints

| Method | Endpoint                 | Purpose                    | Authentication                |
| ------ | ------------------------ | -------------------------- | ----------------------------- |
| `GET`  | `/healthz`               | Service health             | Public                        |
| `POST` | `/v1/chat/completions`   | Route a completion request | Bearer token when configured  |
| `GET`  | `/v1/traces`             | Query redacted traces      | Public read-only              |
| `GET`  | `/v1/metrics`            | Aggregate routing metrics  | Public read-only              |
| `POST` | evaluator `/v1/evaluate` | Run deterministic checks   | Evaluator key for persistence |

Trace queries support `limit`, `offset`, `provider`, `status`, and `search`.

## Configuration

| Variable            | Used by             | Purpose                                    |
| ------------------- | ------------------- | ------------------------------------------ |
| `DEFAULT_PROVIDER`  | Gateway             | `mock`, `gemini`, `openai`, or `anthropic` |
| `ROUTELOOP_API_KEY` | Gateway             | Protects completion requests               |
| `EVALUATOR_API_KEY` | Evaluator           | Authorizes evaluation persistence          |
| `DATABASE_URL`      | Gateway + evaluator | Shared PostgreSQL connection               |
| `WEB_ORIGIN`        | Gateway + evaluator | CORS allowlist for the dashboard           |
| `GEMINI_API_KEY`    | Gateway             | Enables Gemini traffic                     |
| `OPENAI_API_KEY`    | Gateway             | Enables OpenAI traffic                     |
| `ANTHROPIC_API_KEY` | Gateway             | Enables Anthropic traffic                  |

Never place provider keys, gateway keys, evaluator keys, or database credentials in Vercel or browser-exposed variables.

## Repository map

```text
routeloop/
├── app/                         # Next.js traffic-control dashboard
├── gateway/cmd/server/          # Go gateway, providers, retry/streaming logic
│   └── migrations/              # Additive PostgreSQL migrations
├── evaluator/app/               # FastAPI deterministic evaluator
├── public/                      # RouteLoop brand assets
├── docker-compose.yml           # Full local platform
├── render.yaml                  # Render gateway + evaluator blueprint
└── vercel.json                  # Frontend deployment configuration
```

## Development

```bash
npm install
npm run dev       # dashboard
npm run build     # production build
npm run lint      # frontend lint
make test         # gateway tests + Compose validation
```

## Design decisions

- **Gateway in Go:** small runtime footprint and straightforward streaming/concurrency primitives.
- **Evaluator as a separate Python service:** keeps evaluation workflows independent from the latency-sensitive request path.
- **OpenAI-compatible boundary:** clients integrate once while provider adapters remain replaceable.
- **PostgreSQL before an event stack:** the MVP gets durable, queryable evidence without pretending Redpanda and ClickHouse are already production dependencies.
- **Deterministic demo mode:** the portfolio remains inspectable without spending provider credits or inventing benchmark results.
- **Redacted public telemetry:** recruiters can inspect the system without exposing prompts, completions, or credentials.

## Roadmap

- [x] Real provider routing, streaming, and retries
- [x] Durable PostgreSQL traces and cost accounting
- [x] Deterministic evaluations attached to traces
- [x] Public read-only operations dashboard
- [ ] Immutable, versioned routing policies
- [ ] Circuit breakers, concurrency budgets, and rate limiting
- [ ] Shadow traffic, replay, canary promotion, and automatic rollback
- [ ] Redpanda event delivery and ClickHouse analytical storage
- [ ] Reproducible k6 benchmark suite and published methodology

## Security and data handling

- The browser receives redacted metadata, not provider credentials.
- Public traces exclude prompt and completion bodies.
- Secrets are supplied through deployment environment variables and must never be committed.
- Admin operations are intentionally outside the public dashboard surface.

## Contributing

Issues and focused pull requests are welcome. Before opening a PR, run `npm run build`, `npm run lint`, and `make test`. Keep claims tied to reproducible evidence and preserve the live/simulated/planned provenance labels.

## License

No open-source license has been selected yet. The source is publicly viewable, but reuse rights are not granted until a license is added.
