'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Copy,
  FlaskConical,
  GitBranch,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Moon,
  Network,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';

const models = [
  [
    'Claude 3.5 Sonnet',
    'Anthropic',
    '65%',
    '95.2%',
    '1.71s',
    '$0.014',
    '#c6ff4a',
  ],
  ['Gemini 2.0 Flash', 'Google', '25%', '92.4%', '0.82s', '$0.005', '#8b7cff'],
  ['GPT-4o', 'OpenAI', '10%', '96.1%', '2.38s', '$0.026', '#54d6ff'],
];
const demoTraces = [
  [
    'req_8f2c91',
    'customer_support',
    'claude-3-5-sonnet',
    '1.62s · $0.0138',
    '18s ago',
    'ok',
  ],
  [
    'req_74aa10',
    'ticket_classification',
    'gemini-2.0-flash',
    '684ms · $0.0041',
    '42s ago',
    'ok',
  ],
  [
    'req_48dfe2',
    'code_generation',
    'gpt-4o',
    '2.21s · $0.0282',
    '1m ago',
    'ok',
  ],
  [
    'req_91bc04',
    'customer_support',
    'claude-3-5-sonnet',
    '3.08s · $0.0164',
    '2m ago',
    'failed',
  ],
];

type GatewayTrace = {
  request_id: string;
  provider: string;
  model: string;
  workload: string;
  latency_ms: number;
  cost_usd: number;
  status: string;
  created_at: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  retry_count: number;
  http_status: number;
  routing_reason: string;
  evaluation_score?: number;
  evaluation_passed?: boolean;
};
type GatewayMetrics = {
  requests: number;
  total_cost_usd: number;
  average_latency_ms: number;
  error_rate: number;
  evaluated_quality: number | null;
};
const gatewayUrl =
  process.env.NEXT_PUBLIC_GATEWAY_URL ||
  'https://routeloop-gateway.onrender.com';
const evaluatorUrl =
  process.env.NEXT_PUBLIC_EVALUATOR_URL ||
  'https://routeloop-evaluator.onrender.com';

function relativeTime(value: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none">
        <path
          className="logo-route-a"
          d="M10 18C18 7 31 8 37 18C43 28 51 29 54 18"
        />
        <path
          className="logo-route-b"
          d="M54 46C46 57 33 56 27 46C21 36 13 35 10 46"
        />
        <path
          className="logo-route-trace"
          d="M54 18C52 30 43 32 32 32C21 32 12 34 10 46"
        />
        <circle className="logo-node-a" cx="10" cy="18" r="5" />
        <circle className="logo-node-a" cx="54" cy="18" r="5" />
        <circle className="logo-node-b" cx="10" cy="46" r="5" />
        <circle className="logo-node-b" cx="54" cy="46" r="5" />
        <circle className="logo-core" cx="32" cy="32" r="4" />
      </svg>
    </span>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState('Last 7 days');
  const [requestQuery, setRequestQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [traceTab, setTraceTab] = useState('trace');
  const [commandOpen, setCommandOpen] = useState(false);
  const [evalOutput, setEvalOutput] = useState('RouteLoop connected');
  const [evalTerm, setEvalTerm] = useState('RouteLoop');
  const [evalResult, setEvalResult] = useState<{
    score: number;
    passed: boolean;
    checks: number;
  } | null>(null);
  const [evalState, setEvalState] = useState<'idle' | 'running' | 'error'>(
    'idle',
  );
  const [liveTraces, setLiveTraces] = useState<GatewayTrace[]>([]);
  const [telemetry, setTelemetry] = useState<'connecting' | 'live' | 'demo'>(
    'connecting',
  );
  const [liveMetrics, setLiveMetrics] = useState<GatewayMetrics | null>(null);
  const [storage, setStorage] = useState<'memory' | 'postgres'>('memory');
  useEffect(() => {
    const saved = window.localStorage.getItem('routeloop-theme');
    const nextTheme = saved === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [traceResponse, metricResponse] = await Promise.all([
          fetch(`${gatewayUrl}/v1/traces?limit=100`, { cache: 'no-store' }),
          fetch(`${gatewayUrl}/v1/metrics`, { cache: 'no-store' }),
        ]);
        if (!traceResponse.ok) throw new Error('gateway unavailable');
        const payload = await traceResponse.json();
        const metricPayload = metricResponse.ok
          ? await metricResponse.json()
          : null;
        if (active) {
          setLiveTraces(Array.isArray(payload.data) ? payload.data : []);
          setStorage(payload.storage === 'postgres' ? 'postgres' : 'memory');
          setLiveMetrics(metricPayload?.data || null);
          setTelemetry('live');
        }
      } catch {
        if (active) setTelemetry('demo');
      }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
        setSelectedTrace(null);
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, []);
  const displayedTraces = liveTraces.length
    ? liveTraces.map(
        (t) =>
          [
            t.request_id,
            t.workload || 'unclassified',
            t.model,
            `${t.latency_ms}ms · $${t.cost_usd.toFixed(4)}`,
            relativeTime(t.created_at),
            t.status,
          ] as const,
      )
    : demoTraces;
  const requestRows = displayedTraces.filter(
    (t) =>
      (providerFilter === 'all' ||
        t[2].toLowerCase().includes(providerFilter)) &&
      `${t[0]} ${t[1]} ${t[2]}`
        .toLowerCase()
        .includes(requestQuery.toLowerCase()),
  );
  const traceDetail = displayedTraces.find((t) => t[0] === selectedTrace);
  const runEvaluation = async () => {
    setEvalState('running');
    try {
      const response = await fetch(`${evaluatorUrl}/v1/evaluate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          output: evalOutput,
          required_terms: evalTerm
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error();
      setEvalResult(await response.json());
      setEvalState('idle');
    } catch {
      setEvalState('error');
    }
  };
  return (
    <main className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <Logo />
          <span>
            RouteLoop<small>TRAFFIC CONTROL</small>
          </span>
          <button onClick={() => setOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <nav>
          <a className="active" href="#overview">
            <LayoutDashboard />
            Overview
          </a>
          <label>Traffic</label>
          <a href="#requests">
            <ClipboardList />
            Requests
          </a>
          <a href="#traces">
            <Activity />
            Traces <small>{liveTraces.length || '—'}</small>
          </a>
          <label>Routing</label>
          <a href="#policies">
            <SlidersHorizontal />
            Policies
          </a>
          <a href="#models">
            <Network />
            Providers
          </a>
          <a href="#experiments">
            <FlaskConical />
            Experiments <b />
          </a>
          <label>Intelligence</label>
          <a href="#evaluations">
            <CheckCircle2 />
            Evaluations
          </a>
          <a href="#cost">
            <CircleDollarSign />
            Cost / Quality
          </a>
          <a href="#routing">
            <GitBranch />
            Recommendations
          </a>
          <label>Operations</label>
          <a href="#provider-health">
            <HeartPulse />
            Provider Health
          </a>
          <a href="#incidents">
            <AlertTriangle />
            Incidents
          </a>
        </nav>
        <div className="side-foot">
          <a href="#architecture">
            <Boxes />
            Architecture
          </a>
          <a href="#settings">
            <Settings />
            Settings
          </a>
          <div className="runtime">
            <strong>
              <i className={telemetry === 'demo' ? 'offline' : ''} />
              {telemetry === 'live'
                ? 'Gateway connected'
                : telemetry === 'connecting'
                  ? 'Connecting to gateway'
                  : 'Demo fallback active'}
            </strong>
            <p>
              {telemetry === 'live'
                ? 'Redacted telemetry · read only'
                : 'Reproducible seed · read only'}
            </p>
            <div className="state-key">
              <span>
                <i />
                LIVE
              </span>
              <span>
                <i />
                SIMULATED
              </span>
              <span>
                <i />
                PLANNED
              </span>
            </div>
          </div>
        </div>
      </aside>
      <section className="main">
        <header>
          <button
            className="hamburger"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <div>
            <button
              className="theme-toggle"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              onClick={() => {
                const nextTheme = theme === 'light' ? 'dark' : 'light';
                setTheme(nextTheme);
                document.documentElement.dataset.theme = nextTheme;
                window.localStorage.setItem('routeloop-theme', nextTheme);
              }}
            >
              {theme === 'light' ? <Moon /> : <Sun />}
            </button>
            <button
              className="search"
              aria-label="Open command palette"
              onClick={() => setCommandOpen(true)}
            >
              <Search />
              <span>Navigate</span>
              <kbd>⌘ K</kbd>
            </button>
            <a
              href="https://github.com/meghana21-arch/routeloop"
              target="_blank"
              rel="noreferrer"
            >
              GitHub <ArrowRight />
            </a>
          </div>
        </header>
        <div className="content" id="overview">
          <section className="product-intro" aria-labelledby="product-title">
            <div className="intro-copy">
              <small>
                <i /> ROUTELOOP / PRODUCTION SYSTEM
              </small>
              <h1 id="product-title">
                Control every LLM request.
                <span> Prove every routing decision.</span>
              </h1>
              <p>
                RouteLoop is an OpenAI-compatible gateway that routes real model
                traffic, captures durable traces and cost, evaluates output
                quality, and turns that evidence into safer routing decisions.
              </p>
              <div className="intro-actions">
                <a className="primary-action" href="#control-room">
                  Explore the live system <ArrowRight />
                </a>
                <a className="secondary-action" href="#architecture">
                  View architecture
                </a>
              </div>
            </div>
            <div
              className="intro-system"
              aria-label="RouteLoop request lifecycle"
            >
              <div className="hero-arch-title">
                <span>LIVE ARCHITECTURE</span>
                <strong>Request → evidence → better decision</strong>
              </div>
              <div className="hero-arch-flow">
                <div>
                  <small>01 · ENTRY</small>
                  <strong>Client request</strong>
                  <code>OpenAI-compatible</code>
                </div>
                <i>→</i>
                <div className="hero-router">
                  <small>02 · ROUTE</small>
                  <strong>Go gateway</strong>
                  <code>policy + retries</code>
                </div>
                <i>→</i>
                <div>
                  <small>03 · INFER</small>
                  <strong>Gemini</strong>
                  <code>real provider API</code>
                </div>
                <i>→</i>
                <div className="hero-evidence">
                  <small>04 · PROVE</small>
                  <strong>Trace + evaluate</strong>
                  <code>Neon + FastAPI</code>
                </div>
              </div>
              <div className="hero-feedback">
                <span>QUALITY</span>
                <span>COST</span>
                <span>LATENCY</span>
                <b>↻ evidence feeds the next route</b>
              </div>
              <div className="intro-proof">
                <span>
                  <b>REAL</b>Gemini routing
                </span>
                <span>
                  <b>DURABLE</b>Neon traces
                </span>
                <span>
                  <b>LIVE</b>Quality evals
                </span>
              </div>
              <p>
                <code>POST /v1/chat/completions</code>
                <span>OpenAI-compatible API</span>
              </p>
            </div>
          </section>
          <section className="chapter chapter-live" id="control-room">
            <section className="heading">
              <div>
                <small>
                  <i />
                  LIVE OPERATIONS
                </small>
                <h2>Traffic control</h2>
                <p>
                  Route requests across providers, trace every call, evaluate
                  output quality, and understand inference economics.
                </p>
                <div className="product-loop">
                  <span>ROUTE</span>
                  <b>→</b>
                  <span>TRACE</span>
                  <b>→</b>
                  <span>EVALUATE</span>
                  <b>→</b>
                  <span>OPTIMIZE</span>
                  <b>→</b>
                  <span>ROUTE</span>
                </div>
              </div>
              <div className="select">
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                >
                  <option>Last 24 hours</option>
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                </select>
                <ChevronDown />
              </div>
            </section>
            <section className="control-room">
              <div className="topology-head">
                <div>
                  <span className="eyebrow">LIVE ROUTING TOPOLOGY</span>
                  <h2>Production request path</h2>
                </div>
                <span className="pulse-label">
                  <i />
                  Polling gateway every 15s
                </span>
              </div>
              <div className="topology">
                <div className="topology-node source">
                  <small>ENTRYPOINT</small>
                  <strong>Incoming traffic</strong>
                  <code>POST /v1/chat/completions</code>
                </div>
                <div className="route-line active">
                  <i />
                </div>
                <div className="topology-node router">
                  <small>CONTROL PLANE</small>
                  <strong>
                    <Logo />
                    RouteLoop Router
                  </strong>
                  <code>policy: default-provider</code>
                </div>
                <div className="route-fan">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="provider-nodes">
                  <div className="topology-node standby">
                    <span className="release-state planned">READY</span>
                    <strong>OpenAI</strong>
                    <code>adapter configured</code>
                    <b>0%</b>
                  </div>
                  <div className="topology-node standby">
                    <span className="release-state planned">READY</span>
                    <strong>Anthropic</strong>
                    <code>adapter configured</code>
                    <b>0%</b>
                  </div>
                  <div className="topology-node production">
                    <span className="release-state live">LIVE</span>
                    <strong>Gemini</strong>
                    <code>gemini-3.6-flash</code>
                    <b>100%</b>
                  </div>
                </div>
              </div>
              <div className="signal-strip">
                <div>
                  <span>Requests observed</span>
                  <strong>{liveMetrics?.requests || '—'}</strong>
                  <small>
                    {storage === 'postgres' ? 'DURABLE' : 'MEMORY FALLBACK'}
                  </small>
                </div>
                <div>
                  <span>Quality</span>
                  <strong>
                    {liveMetrics?.evaluated_quality != null
                      ? `${(liveMetrics.evaluated_quality * 100).toFixed(1)}%`
                      : '—'}
                  </strong>
                  <small>
                    {liveMetrics?.evaluated_quality != null
                      ? 'EVALUATED'
                      : 'NOT YET EVALUATED'}
                  </small>
                </div>
                <div>
                  <span>Total estimated cost</span>
                  <strong>
                    {liveMetrics?.requests
                      ? `$${liveMetrics.total_cost_usd.toFixed(4)}`
                      : '—'}
                  </strong>
                  <small>
                    {liveMetrics?.requests ? 'TOKEN BASED' : 'NO LIVE SAMPLE'}
                  </small>
                </div>
                <div>
                  <span>Average latency</span>
                  <strong>
                    {liveMetrics?.requests
                      ? `${Math.round(liveMetrics.average_latency_ms)}ms`
                      : '—'}
                  </strong>
                  <small>
                    {liveMetrics?.requests ? 'OBSERVED' : 'NO LIVE SAMPLE'}
                  </small>
                </div>
                <div>
                  <span>Error rate</span>
                  <strong>
                    {liveMetrics?.requests
                      ? `${(liveMetrics.error_rate * 100).toFixed(1)}%`
                      : '—'}
                  </strong>
                  <small>OBSERVED</small>
                </div>
              </div>
            </section>
            <section className="change-feed" id="routing">
              <div>
                <span className="release-state simulated">SIMULATED</span>
                <small>ROUTING RECOMMENDATION · NOT APPLIED</small>
                <h2>Evaluate shifting classification traffic toward Gemini</h2>
                <p>
                  The current gateway routes Gemini in production. Comparative
                  allocation requires measured OpenAI and Anthropic traffic
                  before this recommendation can be promoted.
                </p>
              </div>
              <div className="allocation">
                <span>
                  <b>OpenAI</b>
                  <code>50% → 18%</code>
                </span>
                <span>
                  <b>Anthropic</b>
                  <code>40% → 57%</code>
                </span>
                <span>
                  <b>Gemini</b>
                  <code>10% → 25%</code>
                </span>
              </div>
              <div className="impact">
                <span>
                  <small>PROJECTED COST</small>
                  <b>↓ 31%</b>
                </span>
                <span>
                  <small>QUALITY DELTA</small>
                  <b>−0.3%</b>
                </span>
                <span>
                  <small>P95 LATENCY</small>
                  <b>↓ 420ms</b>
                </span>
              </div>
            </section>
          </section>
          <section className="ops-section" id="requests">
            <div className="section-title">
              <div>
                <span
                  className={`release-state ${liveTraces.length ? 'live' : 'simulated'}`}
                >
                  {liveTraces.length ? 'LIVE' : 'SIMULATED'}
                </span>
                <h2>Requests</h2>
                <p>
                  Operational request stream. Payloads are excluded from this
                  public view.
                </p>
              </div>
              <span>
                {requestRows.length} visible · {storage}
              </span>
            </div>
            <div className="table-toolbar">
              <label>
                <Search />
                <input
                  value={requestQuery}
                  onChange={(e) => setRequestQuery(e.target.value)}
                  placeholder="Search request, workload, or model"
                  aria-label="Search requests"
                />
              </label>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                aria-label="Filter by provider"
              >
                <option value="all">All providers</option>
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="claude">Anthropic</option>
              </select>
              <button
                onClick={() => {
                  setRequestQuery('');
                  setProviderFilter('all');
                }}
              >
                Clear filters
              </button>
            </div>
            <div className="request-table">
              <div className="request-row request-head">
                <span>Time</span>
                <span>Request</span>
                <span>Workload</span>
                <span>Provider / Model</span>
                <span>Status</span>
                <span>Latency</span>
                <span>Tokens</span>
                <span>Eval</span>
                <span>Cost</span>
              </div>
              {requestRows.map((t) => {
                const rich = liveTraces.find(
                  (trace) => trace.request_id === t[0],
                );
                return (
                  <div className="request-row" key={`request-${t[0]}`}>
                    <time>{t[4]}</time>
                    <code>{t[0]}</code>
                    <span>{t[1]}</span>
                    <span>
                      <b>{rich?.provider || t[2]}</b>
                      <small>{rich?.model || t[2]}</small>
                    </span>
                    <span>
                      <i className={t[5]} />
                      {rich?.http_status ||
                        (t[5] === 'failed' ? 'FAILED' : '200')}
                    </span>
                    <code>{t[3].split(' · ')[0]}</code>
                    <code>{rich?.total_tokens || '—'}</code>
                    <span
                      className={
                        rich?.evaluation_passed
                          ? 'eval-pass'
                          : rich?.evaluation_passed === false
                            ? 'eval-fail'
                            : 'muted-value'
                      }
                    >
                      {rich?.evaluation_passed === true
                        ? 'PASS'
                        : rich?.evaluation_passed === false
                          ? 'FAIL'
                          : '—'}
                    </span>
                    <code>{t[3].split(' · ')[1]}</code>
                  </div>
                );
              })}
            </div>
            {!requestRows.length && (
              <div className="technical-empty">
                <strong>No requests match this filter</strong>
                <p>
                  Clear filters or wait for matching traffic from the gateway.
                </p>
              </div>
            )}
          </section>
          <section className="ops-section" id="models">
            <div className="section-title">
              <div>
                <span className="release-state live">INVENTORY</span>
                <h2>Providers</h2>
                <p>Adapter readiness and observed production usage.</p>
              </div>
              <span>4 adapters</span>
            </div>
            <div className="provider-table">
              <div className="provider-row provider-head">
                <span>Provider</span>
                <span>Model</span>
                <span>State</span>
                <span>Requests</span>
                <span>Success</span>
                <span>P50</span>
                <span>P95</span>
                <span>Cost</span>
                <span>Quality</span>
              </div>
              <div className="provider-row">
                <b>
                  <i className="provider-dot gemini" />
                  Google Gemini
                </b>
                <code>gemini-3.6-flash</code>
                <span className="release-state live">LIVE</span>
                <code>
                  {liveTraces.filter((t) => t.provider === 'gemini').length ||
                    '—'}
                </code>
                <code>
                  {liveTraces.length
                    ? `${Math.round((liveTraces.filter((t) => t.status !== 'failed').length / liveTraces.length) * 100)}%`
                    : '—'}
                </code>
                <code>—</code>
                <code>
                  {liveTraces.length
                    ? `${Math.max(...liveTraces.map((t) => t.latency_ms))}ms`
                    : '—'}
                </code>
                <code>
                  {liveTraces.length
                    ? `$${liveTraces.reduce((n, t) => n + t.cost_usd, 0).toFixed(4)}`
                    : '—'}
                </code>
                <span
                  className={
                    liveMetrics?.evaluated_quality != null ? 'eval-pass' : ''
                  }
                >
                  {liveMetrics?.evaluated_quality != null
                    ? `${(liveMetrics.evaluated_quality * 100).toFixed(1)}%`
                    : 'Not evaluated'}
                </span>
              </div>
              <div className="provider-row">
                <b>
                  <i className="provider-dot openai" />
                  OpenAI
                </b>
                <code>gpt-4o-mini</code>
                <span className="config-state">NOT CONFIGURED</span>
                <code>0</code>
                <code>—</code>
                <code>—</code>
                <code>—</code>
                <code>—</code>
                <span>—</span>
              </div>
              <div className="provider-row">
                <b>
                  <i className="provider-dot anthropic" />
                  Anthropic
                </b>
                <code>claude-3-5-haiku</code>
                <span className="config-state">NOT CONFIGURED</span>
                <code>0</code>
                <code>—</code>
                <code>—</code>
                <code>—</code>
                <code>—</code>
                <span>—</span>
              </div>
              <div className="provider-row simulated-row">
                <b>
                  <i className="provider-dot mock" />
                  Mock Provider
                </b>
                <code>deterministic-v1</code>
                <span className="release-state simulated">SIMULATION</span>
                <code>seed only</code>
                <code>—</code>
                <code>80ms</code>
                <code>200ms</code>
                <code>$0</code>
                <span>Deterministic</span>
              </div>
            </div>
          </section>
          <section className="ops-section" id="provider-health">
            <div className="section-title">
              <div>
                <span className="release-state live">OPERATIONS</span>
                <h2>Provider Health</h2>
                <p>
                  Gateway observations and adapter configuration—not synthetic
                  uptime claims.
                </p>
              </div>
              <span>No active incidents</span>
            </div>
            <div className="health-table">
              <div className="health-row health-head">
                <span>Provider</span>
                <span>State</span>
                <span>Error signal</span>
                <span>P95 observed</span>
                <span>Latency samples</span>
                <span>Source</span>
              </div>
              <div className="health-row">
                <b>
                  <i className="provider-dot gemini" />
                  Gemini
                </b>
                <span className="health-state healthy">
                  <i />
                  HEALTHY
                </span>
                <code>
                  {liveTraces.length
                    ? `${Math.round((liveTraces.filter((t) => t.status === 'failed').length / liveTraces.length) * 100)}%`
                    : 'no sample'}
                </code>
                <code>
                  {liveTraces.length
                    ? `${Math.max(...liveTraces.map((t) => t.latency_ms))}ms`
                    : '—'}
                </code>
                <svg
                  viewBox="0 0 120 24"
                  preserveAspectRatio="none"
                  aria-label="Observed Gemini latency samples"
                >
                  <polyline points="0,18 15,15 30,17 45,9 60,12 75,7 90,10 105,5 120,8" />
                </svg>
                <span className="release-state live">LIVE</span>
              </div>
              <div className="health-row">
                <b>
                  <i className="provider-dot openai" />
                  OpenAI
                </b>
                <span className="health-state">
                  <i />
                  NOT CONFIGURED
                </span>
                <code>—</code>
                <code>—</code>
                <span className="no-sample">No traffic</span>
                <span className="config-state">ADAPTER READY</span>
              </div>
              <div className="health-row">
                <b>
                  <i className="provider-dot anthropic" />
                  Anthropic
                </b>
                <span className="health-state">
                  <i />
                  NOT CONFIGURED
                </span>
                <code>—</code>
                <code>—</code>
                <span className="no-sample">No traffic</span>
                <span className="config-state">ADAPTER READY</span>
              </div>
              <div className="health-row simulated-row">
                <b>
                  <i className="provider-dot mock" />
                  Mock Provider
                </b>
                <span className="health-state simulated">
                  <i />
                  HEALTHY
                </span>
                <code>configurable</code>
                <code>200ms</code>
                <svg
                  viewBox="0 0 120 24"
                  preserveAspectRatio="none"
                  aria-label="Simulated mock latency"
                >
                  <polyline points="0,18 15,8 30,15 45,5 60,17 75,9 90,13 105,6 120,16" />
                </svg>
                <span className="release-state simulated">SIMULATED</span>
              </div>
            </div>
            <div className="incident-empty" id="incidents">
              <CheckCircle2 />
              <div>
                <strong>No active incidents</strong>
                <p>
                  The gateway reports healthy. Provider-specific uptime
                  monitoring is planned.
                </p>
              </div>
              <span className="release-state planned">PLANNED</span>
            </div>
          </section>
          <section className="evaluation-lab" id="evaluations">
            <div className="section-title">
              <div>
                <span className="release-state live">LIVE</span>
                <h2>Deterministic Evaluator</h2>
                <p>
                  Run the deployed Python evaluator and inspect its exact
                  result.
                </p>
              </div>
              <code>POST /v1/evaluate</code>
            </div>
            <div className="eval-form">
              <label>
                OUTPUT
                <textarea
                  value={evalOutput}
                  onChange={(e) => setEvalOutput(e.target.value)}
                />
              </label>
              <label>
                REQUIRED TERMS
                <input
                  value={evalTerm}
                  onChange={(e) => setEvalTerm(e.target.value)}
                  placeholder="comma-separated terms"
                />
              </label>
              <button
                onClick={runEvaluation}
                disabled={evalState === 'running'}
              >
                {evalState === 'running' ? 'Evaluating…' : 'Run evaluation'}
                <ArrowRight />
              </button>
            </div>
            <div className="eval-result">
              <div>
                <small>EVALUATOR</small>
                <code>deterministic · v1</code>
              </div>
              <div>
                <small>TYPE</small>
                <code>required-term match</code>
              </div>
              <div>
                <small>RESULT</small>
                <strong
                  className={
                    evalResult?.passed ? 'pass' : evalResult ? 'fail' : ''
                  }
                >
                  {evalResult ? (evalResult.passed ? 'PASS' : 'FAIL') : '—'}
                </strong>
              </div>
              <div>
                <small>SCORE</small>
                <code>{evalResult ? evalResult.score.toFixed(2) : '—'}</code>
              </div>
              <div>
                <small>CHECKS</small>
                <code>{evalResult?.checks ?? '—'}</code>
              </div>
              <div>
                <small>CONNECTION</small>
                <code>
                  {evalState === 'error' ? 'UNAVAILABLE' : 'Render evaluator'}
                </code>
              </div>
            </div>
            {evalState === 'error' && (
              <div className="eval-error">
                The evaluator is waking up or unavailable. Try again in a
                moment.
              </div>
            )}
          </section>
          <section className="frontier-section" id="cost">
            <div className="section-title">
              <div>
                <span className="release-state simulated">SIMULATED</span>
                <h2>Cost / Quality Frontier</h2>
                <p>
                  Reproducible scenario data. Not a claim about current provider
                  performance.
                </p>
              </div>
              <span>Lower cost → · Higher quality ↑</span>
            </div>
            <div className="frontier-body">
              <div className="scatter">
                <span className="axis-y">QUALITY SCORE</span>
                <span className="axis-x">COST / SUCCESSFUL REQUEST</span>
                <i className="grid-line y1" />
                <i className="grid-line y2" />
                <i className="grid-line x1" />
                <i className="grid-line x2" />
                <svg
                  viewBox="0 0 600 260"
                  preserveAspectRatio="none"
                  aria-label="Simulated cost quality Pareto frontier"
                >
                  <polyline points="90,190 270,105 480,55" />
                </svg>
                <button
                  className="point gemini-point"
                  aria-label="Simulated Gemini: cost 0.005, quality 0.924"
                >
                  <i />
                  <b>Gemini</b>
                  <small>$0.005 · 0.924</small>
                </button>
                <button
                  className="point claude-point"
                  aria-label="Simulated Claude: cost 0.014, quality 0.952"
                >
                  <i />
                  <b>Claude</b>
                  <small>$0.014 · 0.952</small>
                </button>
                <button
                  className="point gpt-point"
                  aria-label="Simulated GPT: cost 0.026, quality 0.961"
                >
                  <i />
                  <b>GPT-4o</b>
                  <small>$0.026 · 0.961</small>
                </button>
              </div>
              <aside>
                <h3>Observed production</h3>
                <div>
                  <span>Gemini cost / request</span>
                  <code>
                    {liveTraces.length
                      ? `$${(liveTraces.reduce((n, t) => n + t.cost_usd, 0) / liveTraces.length).toFixed(4)}`
                      : '—'}
                  </code>
                </div>
                <div>
                  <span>Evaluated quality</span>
                  <code>
                    {liveMetrics?.evaluated_quality != null
                      ? `${(liveMetrics.evaluated_quality * 100).toFixed(1)}%`
                      : '—'}
                  </code>
                </div>
                <p>
                  {liveMetrics?.evaluated_quality != null
                    ? 'Live cost and deterministic quality are joined through the durable trace. More samples are required before making routing decisions.'
                    : 'Gemini cannot be placed on the live frontier until evaluation results are attached to request traces.'}
                </p>
                <span
                  className={
                    liveMetrics?.evaluated_quality != null
                      ? 'release-state live'
                      : 'release-state planned'
                  }
                >
                  {liveMetrics?.evaluated_quality != null
                    ? 'LIVE SAMPLE'
                    : 'JOIN PIPELINE PLANNED'}
                </span>
              </aside>
            </div>
          </section>
          <section className="architecture" id="architecture">
            <div className="section-title">
              <div>
                <span className="release-state live">SYSTEM MAP</span>
                <h2>Architecture & Delivery State</h2>
                <p>
                  What is connected today, what is simulation infrastructure,
                  and what remains planned.
                </p>
              </div>
              <a
                href="https://github.com/meghana21-arch/routeloop"
                target="_blank"
                rel="noreferrer"
              >
                Inspect source <ArrowRight />
              </a>
            </div>
            <div className="system-flow">
              <div>
                <b>Next.js Dashboard</b>
                <code>Vercel</code>
                <span className="release-state live">LIVE</span>
              </div>
              <i>→</i>
              <div>
                <b>Go Gateway</b>
                <code>Render</code>
                <span className="release-state live">LIVE</span>
              </div>
              <i>→</i>
              <div>
                <b>Gemini Adapter</b>
                <code>Google API</code>
                <span className="release-state live">LIVE</span>
              </div>
              <i>→</i>
              <div>
                <b>Trace + Cost</b>
                <code>Neon PostgreSQL</code>
                <span className="release-state live">DURABLE</span>
              </div>
              <i>→</i>
              <div>
                <b>Python Evaluator</b>
                <code>Render</code>
                <span className="release-state live">LIVE</span>
              </div>
            </div>
            <div className="component-ledger">
              <div>
                <b>Mock Provider</b>
                <span className="release-state simulated">SIMULATED</span>
                <p>Deterministic responses, latency, and zero-cost testing.</p>
              </div>
              <div>
                <b>OpenAI Adapter</b>
                <span className="release-state planned">READY</span>
                <p>Implemented; credential not configured.</p>
              </div>
              <div>
                <b>Anthropic Adapter</b>
                <span className="release-state planned">READY</span>
                <p>Implemented; credential not configured.</p>
              </div>
              <div>
                <b>Kafka / Redpanda</b>
                <span className="release-state planned">PLANNED</span>
                <p>
                  Local definition exists; production pipeline is not deployed.
                </p>
              </div>
              <div>
                <b>ClickHouse</b>
                <span className="release-state planned">PLANNED</span>
                <p>
                  Local definition exists; analytical persistence is not
                  deployed.
                </p>
              </div>
            </div>
          </section>
          <section className="bottom-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <h2>Simulation baseline</h2>
                  <p>Reproducible comparison data—not a provider benchmark</p>
                </div>
                <span className="release-state simulated">SIMULATED</span>
              </div>
              <div className="table">
                <div className="row table-head">
                  <span>Model</span>
                  <span>Traffic</span>
                  <span>Quality</span>
                  <span>P95</span>
                  <span>Cost / req</span>
                </div>
                {models.map((m) => (
                  <div className="row" key={m[0]}>
                    <span className="model">
                      <i style={{ background: m[6] }} />
                      <b>
                        {m[0]}
                        <small>{m[1]}</small>
                      </b>
                    </span>
                    <span>
                      {m[2]}{' '}
                      <em>
                        <i style={{ width: m[2], background: m[6] }} />
                      </em>
                    </span>
                    <span>{m[3]}</span>
                    <span>{m[4]}</span>
                    <span>{m[5]}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel traces" id="traces">
              <div className="panel-head">
                <div>
                  <h2>
                    Recent traces{' '}
                    <span className={`telemetry-badge ${telemetry}`}>
                      {telemetry}
                    </span>
                  </h2>
                  <p>
                    {liveTraces.length
                      ? 'Redacted events from the Render gateway'
                      : 'Seeded events until the next live request'}
                  </p>
                </div>
                <span className="open-hint">Select a trace to inspect</span>
              </div>
              {displayedTraces.map((t) => (
                <button
                  className="trace"
                  key={t[0]}
                  onClick={() => setSelectedTrace(t[0])}
                >
                  <i className={t[5]} />
                  <b>
                    {t[0]}
                    <small>{t[1]}</small>
                  </b>
                  <span>
                    {t[2]}
                    <small>{t[3]}</small>
                  </span>
                  <time>{t[4]}</time>
                </button>
              ))}
            </article>
          </section>
          <footer>
            <span>
              <Logo />
              RouteLoop
            </span>
            <p>
              Real routing. Reproducible demo data. No production prompts
              stored.
            </p>
            <span>
              <i className={telemetry === 'demo' ? 'offline' : ''} />
              {telemetry === 'live' ? 'Gateway connected' : 'Demo mode'} · 3
              providers
            </span>
          </footer>
        </div>
      </section>
      {traceDetail && (
        <>
          <button
            className="drawer-scrim"
            aria-label="Close trace details"
            onClick={() => setSelectedTrace(null)}
          />
          <aside className="trace-drawer">
            <header>
              <div>
                <span
                  className={
                    liveTraces.length
                      ? 'release-state live'
                      : 'release-state simulated'
                  }
                >
                  {liveTraces.length ? 'LIVE' : 'SIMULATED'}
                </span>
                <h2>Trace detail</h2>
              </div>
              <button
                onClick={() => setSelectedTrace(null)}
                aria-label="Close trace details"
              >
                <X />
              </button>
            </header>
            <div className="drawer-id">
              <code>{traceDetail[0]}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(traceDetail[0])}
              >
                <Copy />
                Copy
              </button>
            </div>
            <div className="trace-timeline">
              <div>
                <i />
                <b>AUTH</b>
                <code>0ms</code>
                <small>RouteLoop key accepted</small>
              </div>
              <div>
                <i />
                <b>ROUTE</b>
                <code>2ms</code>
                <small>
                  {liveTraces.find((t) => t.request_id === traceDetail[0])
                    ?.routing_reason || 'default-provider'}
                </small>
              </div>
              <div>
                <i />
                <b>{traceDetail[2].toUpperCase()}</b>
                <code>{traceDetail[3].split(' · ')[0]}</code>
                <small>Provider response</small>
              </div>
              <div
                className={
                  liveTraces.find((t) => t.request_id === traceDetail[0])
                    ?.evaluation_passed == null
                    ? 'unavailable'
                    : ''
                }
              >
                <i />
                <b>EVAL</b>
                <code>
                  {liveTraces
                    .find((t) => t.request_id === traceDetail[0])
                    ?.evaluation_score?.toFixed(2) || '—'}
                </code>
                <small>
                  {liveTraces.find((t) => t.request_id === traceDetail[0])
                    ?.evaluation_passed == null
                    ? 'Not evaluated'
                    : 'Deterministic'}
                </small>
              </div>
              <div>
                <i />
                <b>COST</b>
                <code>{traceDetail[3].split(' · ')[1]}</code>
                <small>Estimated</small>
              </div>
            </div>
            <dl className="trace-facts">
              <div>
                <dt>Provider / model</dt>
                <dd>
                  {liveTraces.find((t) => t.request_id === traceDetail[0])
                    ?.model || traceDetail[2]}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {liveTraces.find((t) => t.request_id === traceDetail[0])
                    ?.http_status || '—'}{' '}
                  · {traceDetail[5]}
                </dd>
              </div>
              <div>
                <dt>Workload</dt>
                <dd>{traceDetail[1]}</dd>
              </div>
              <div>
                <dt>Retries</dt>
                <dd>
                  {liveTraces.find((t) => t.request_id === traceDetail[0])
                    ?.retry_count ?? '—'}
                </dd>
              </div>
              <div>
                <dt>Token counts</dt>
                <dd>
                  {liveTraces.find((t) => t.request_id === traceDetail[0])
                    ?.total_tokens || '—'}
                </dd>
              </div>
              <div>
                <dt>TTFT</dt>
                <dd>Not recorded</dd>
              </div>
            </dl>
            <div className="drawer-tabs">
              {['request', 'response', 'trace', 'evaluation', 'metadata'].map(
                (tab) => (
                  <button
                    className={traceTab === tab ? 'active' : ''}
                    onClick={() => setTraceTab(tab)}
                    key={tab}
                  >
                    {tab}
                  </button>
                ),
              )}
            </div>
            <pre>
              {traceTab === 'trace'
                ? JSON.stringify(
                    liveTraces.find((t) => t.request_id === traceDetail[0]) || {
                      request_id: traceDetail[0],
                      status: traceDetail[5],
                    },
                    null,
                    2,
                  )
                : traceTab === 'evaluation'
                  ? JSON.stringify(
                      {
                        score:
                          liveTraces.find(
                            (t) => t.request_id === traceDetail[0],
                          )?.evaluation_score ?? null,
                        passed:
                          liveTraces.find(
                            (t) => t.request_id === traceDetail[0],
                          )?.evaluation_passed ?? null,
                      },
                      null,
                      2,
                    )
                  : traceTab === 'metadata'
                    ? JSON.stringify(
                        {
                          source: liveTraces.length
                            ? 'gateway'
                            : 'reproducible-seed',
                          storage,
                          payloads_stored: false,
                        },
                        null,
                        2,
                      )
                    : 'Payload unavailable in public read-only mode.'}
            </pre>
          </aside>
        </>
      )}
      {commandOpen && (
        <>
          <button
            className="command-scrim"
            aria-label="Close command palette"
            onClick={() => setCommandOpen(false)}
          />
          <div
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Navigate RouteLoop"
          >
            <div>
              <Search />
              <span>Go to…</span>
              <kbd>ESC</kbd>
            </div>
            {[
              ['Overview', '#overview'],
              ['Requests', '#requests'],
              ['Traces', '#traces'],
              ['Providers', '#models'],
              ['Provider Health', '#provider-health'],
              ['Evaluations', '#evaluations'],
              ['Cost / Quality', '#cost'],
              ['Architecture', '#architecture'],
            ].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setCommandOpen(false)}>
                <span>{label}</span>
                <code>{href}</code>
              </a>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
