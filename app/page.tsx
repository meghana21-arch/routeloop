'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowRight, Check, ChevronDown, CircleDollarSign, FlaskConical, Gauge, GitBranch, LayoutDashboard, Menu, Network, Search, Settings, Sparkles, Workflow, X, Zap } from 'lucide-react';

const metrics = [
  ['Requests', '48.2K', '+12.4%', 'vs. previous 7 days', Activity],
  ['Estimated spend', '$682.41', '-18.2%', 'quality-adjusted', CircleDollarSign],
  ['Quality pass rate', '94.6%', '+1.8%', 'across 3 workloads', Sparkles],
  ['P95 latency', '1.84s', '-320ms', 'within 2.0s SLO', Gauge],
] as const;
const traffic = [42,47,44,56,53,61,58,68,63,76,72,81,77,91,87,96,92,101,98,111,106,118,113,124];
const models = [
  ['Claude 3.5 Sonnet','Anthropic','65%','95.2%','1.71s','$0.014','#c6ff4a'],
  ['Gemini 2.0 Flash','Google','25%','92.4%','0.82s','$0.005','#8b7cff'],
  ['GPT-4o','OpenAI','10%','96.1%','2.38s','$0.026','#54d6ff'],
];
const demoTraces = [
  ['req_8f2c91','customer_support','claude-3-5-sonnet','1.62s · $0.0138','18s ago','ok'],
  ['req_74aa10','ticket_classification','gemini-2.0-flash','684ms · $0.0041','42s ago','ok'],
  ['req_48dfe2','code_generation','gpt-4o','2.21s · $0.0282','1m ago','ok'],
  ['req_91bc04','customer_support','claude-3-5-sonnet','3.08s · $0.0164','2m ago','failed'],
];

type GatewayTrace = {request_id:string;provider:string;model:string;workload:string;latency_ms:number;cost_usd:number;status:string;created_at:string};
const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'https://routeloop-gateway.onrender.com';

function relativeTime(value:string){const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));if(seconds<60)return `${seconds}s ago`;if(seconds<3600)return `${Math.floor(seconds/60)}m ago`;return `${Math.floor(seconds/3600)}h ago`}

function Logo(){return <span className="logo"><i/><i/><i/></span>}

export default function Home(){
  const [open,setOpen]=useState(false); const [range,setRange]=useState('Last 7 days');
  const [liveTraces,setLiveTraces]=useState<GatewayTrace[]>([]); const [telemetry,setTelemetry]=useState<'connecting'|'live'|'demo'>('connecting');
  useEffect(()=>{let active=true;const load=async()=>{try{const response=await fetch(`${gatewayUrl}/v1/traces`,{cache:'no-store'});if(!response.ok)throw new Error('gateway unavailable');const payload=await response.json();if(active){setLiveTraces(Array.isArray(payload.data)?payload.data.slice(0,4):[]);setTelemetry('live')}}catch{if(active)setTelemetry('demo')}};load();const timer=setInterval(load,15000);return()=>{active=false;clearInterval(timer)}},[]);
  const displayedTraces=liveTraces.length?liveTraces.map(t=>[t.request_id,t.workload||'unclassified',t.model,`${t.latency_ms}ms · $${t.cost_usd.toFixed(4)}`,relativeTime(t.created_at),t.status] as const):demoTraces;
  return <main className="shell">
    <aside className={`sidebar ${open?'open':''}`}>
      <div className="brand"><Logo/>RouteLoop<button onClick={()=>setOpen(false)} aria-label="Close navigation"><X size={18}/></button></div>
      <nav><label>Workspace</label><a className="active" href="#overview"><LayoutDashboard/>Overview</a><a href="#workloads"><Workflow/>Workloads</a><a href="#models"><Network/>Models</a><a href="#traces"><Activity/>Traces <small>48.2K</small></a><label>Optimize</label><a href="#experiments"><FlaskConical/>Experiments <b/></a><a href="#routing"><GitBranch/>Routing</a><a href="#cost"><CircleDollarSign/>Cost insights</a></nav>
      <div className="side-foot"><a href="#settings"><Settings/>Settings</a><div><strong><i className={telemetry==='demo'?'offline':''}/>{telemetry==='live'?'Live gateway connected':telemetry==='connecting'?'Connecting to gateway':'Demo fallback active'}</strong><p>{telemetry==='live'?'Redacted telemetry · read only':'Reproducible seed · read only'}</p></div></div>
    </aside>
    <section className="main">
      <header><button className="hamburger" onClick={()=>setOpen(true)} aria-label="Open navigation"><Menu/></button><span className="environment"><i/>Production demo <ChevronDown/></span><div><button className="search" aria-label="Search"><Search/></button><a href="https://github.com/meghana21-arch" target="_blank">View on GitHub <ArrowRight/></a></div></header>
      <div className="content" id="overview">
        <section className="heading"><div><small><i/>All systems operational</small><h1>Routing intelligence</h1><p>Live cost, quality, and reliability signals across every model call.</p></div><div className="select"><select value={range} onChange={e=>setRange(e.target.value)}><option>Last 24 hours</option><option>Last 7 days</option><option>Last 30 days</option></select><ChevronDown/></div></section>
        <section className="metrics">{metrics.map(([label,value,delta,note,Icon])=><article key={label}><div><span>{label}</span><Icon/></div><strong>{value}</strong><p><b>{delta}</b> {note}</p></article>)}</section>
        <section className="hero-grid">
          <article className="panel chart"><div className="panel-head"><div><h2>Request volume</h2><p>Completed requests by routed provider</p></div><div className="legend"><span><i className="lime"/>Claude</span><span><i className="purple"/>Gemini</span><span><i className="blue"/>OpenAI</span></div></div><div className="plot"><div><span>8K</span><span>6K</span><span>4K</span><span>2K</span><span>0</span></div><svg viewBox="0 0 760 220" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#c6ff4a" stopOpacity=".25"/><stop offset="1" stopColor="#c6ff4a" stopOpacity="0"/></linearGradient></defs>{[22,72,122,172,218].map(y=><line key={y} x1="0" x2="760" y1={y} y2={y}/>)}<path d={`M ${traffic.map((v,i)=>`${i*33},${210-v*1.48}`).join(' L ')} L 760,220 L 0,220 Z`}/><polyline points={traffic.map((v,i)=>`${i*33},${210-v*1.48}`).join(' ')}/></svg></div><div className="xaxis"><span>Sep 3</span><span>Sep 4</span><span>Sep 5</span><span>Sep 6</span><span>Sep 7</span><span>Sep 8</span><span>Today</span></div></article>
          <article className="panel recommendation" id="routing"><small><Zap/>New recommendation</small><h2>Shift 25% more classification traffic to Gemini</h2><p>Projected to reduce monthly spend while maintaining the 0.91 quality SLO.</p><div className="saving"><div>Projected savings<strong>$1,284<small>/mo</small></strong></div><div>Confidence<strong>97.2%</strong></div></div><div className="checks"><p><Check/>Quality <b>92.4% ≥ 91%</b></p><p><Check/>P95 latency <b>0.82s ≤ 2.0s</b></p><p><Check/>Samples <b>8,412 ≥ 500</b></p></div><button>Review recommendation <ArrowRight/></button></article>
        </section>
        <section className="bottom-grid">
          <article className="panel" id="models"><div className="panel-head"><div><h2>Model performance</h2><p>Current traffic allocation and SLO performance</p></div><a href="#models">Compare models <ArrowRight/></a></div><div className="table"><div className="row table-head"><span>Model</span><span>Traffic</span><span>Quality</span><span>P95</span><span>Cost / req</span></div>{models.map(m=><div className="row" key={m[0]}><span className="model"><i style={{background:m[6]}}/><b>{m[0]}<small>{m[1]}</small></b></span><span>{m[2]} <em><i style={{width:m[2],background:m[6]}}/></em></span><span>{m[3]}</span><span>{m[4]}</span><span>{m[5]}</span></div>)}</div></article>
          <article className="panel traces" id="traces"><div className="panel-head"><div><h2>Recent traces <span className={`telemetry-badge ${telemetry}`}>{telemetry}</span></h2><p>{liveTraces.length?'Redacted events from the Render gateway':'Seeded events until the next live request'}</p></div><a href="#traces">View all <ArrowRight/></a></div>{displayedTraces.map(t=><div className="trace" key={t[0]}><i className={t[5]}/><b>{t[0]}<small>{t[1]}</small></b><span>{t[2]}<small>{t[3]}</small></span><time>{t[4]}</time></div>)}</article>
        </section>
        <footer><span><Logo/>RouteLoop</span><p>Real routing. Reproducible demo data. No production prompts stored.</p><span><i className={telemetry==='demo'?'offline':''}/>{telemetry==='live'?'Gateway connected':'Demo mode'} · 3 providers</span></footer>
      </div>
    </section>
  </main>
}
