// ─── Interop Platform — Extension Module (v4) ────────────────────────────────
(function () {
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  buildTelemetry();
  buildUserJourneys();
  buildNFRMatrix();
  buildPipeline();
  buildFailoverTimeline();
  buildDRChaos();
});

// ══════════════════════════════════════════════════════════════════════════════
// TELEMETRY
// ══════════════════════════════════════════════════════════════════════════════
const TEL_HOPS = [
  { id:'WEB',  icon:'🖥', color:'#3b82f6', label:'Portal / Channel (Web · Mobile · Kiosk)', sub:'OTel SDK · browser timing · corrId injected',
    signals:['W3C traceparent + tracestate injected in every XHR/fetch','x-correlation-id header generated (UUID v4) per user action','Browser perf marks: TTFB, DOMInteractive, FCP via PerformanceObserver','No raw PII in client telemetry — subjectId hashed (SHA-256 + salt)'],
    metrics:['Page load P95 (Lighthouse CI gate ≥ 90)','XHR error rate per route','Client-side JS exception rate','WCAG axe violation count (CI gate = 0 critical)'],
    dest:'App Insights JS SDK → Log Analytics via APIM diagnostics',
    rfp:['-01','-09'] },
  { id:'APIM', icon:'🔀', color:'#f97316', label:'Azure APIM Premium', sub:'Diagnostics policy · JWT claims logged · corrId propagated',
    signals:['APIM diagnostics policy exports: method, route, status, latencyMs, backendId','JWT claim subset (iss, aud, acr, scopes) logged — NO subject value','Rate-limit hit events (429 + RETRY_AFTER) emitted to Event Grid','Policy execution time breakdown: inbound / backend / outbound phases'],
    metrics:['Policy exec P95 < 150ms (NFR-APIM)','4xx rate per API product','Backend latency per origin (Facade A/B)','Quota exhaustion rate per subscription'],
    dest:'APIM built-in Log → Azure Monitor Diagnostic Settings → Log Analytics',
    rfp:['-03','-04','-09'] },
  { id:'FAC',  icon:'🧱', color:'#8b5cf6', label:'API Facade', sub:'OTel SDK · spans per operation · problem+json faults traced',
    signals:['OTel spans: validate, build-command, idempotency-check, route-to-controller','x-correlation-id + traceparent forwarded downstream','problem+json fault events with corrId, problemCode, HTTP status','Idempotency ledger hit/miss counter (Prometheus histogram)'],
    metrics:['Validate+command P95 < 100ms','Idempotency hit rate (expected ≥ 0.5% during retries)','problem+json 4xx breakdown by problemCode','Schema validation failure rate per API version'],
    dest:'OTel Collector sidecar → App Insights (traces) + Log Analytics (logs)',
    rfp:['-04','-09'] },
  { id:'ORCH', icon:'⚙', color:'#3b82f6', label:'Controller / Orchestrator', sub:'Saga step spans · consent gate outcomes · DLQ events',
    signals:['Distributed span per saga step (consent-check, adapter-fan-out, map-validate, rules, persist)','Consent gate outcome: GRANTED / DENIED / EXPIRED — with purposeId (no data)','Circuit breaker state changes: CLOSED → OPEN → HALF_OPEN per adapter','DLQ park events with reason, retryCount, messageId'],
    metrics:['Handler P95 < 300ms (excl. SoR)','Consent gate denial rate (SLO = 0 violations)','Circuit breaker open duration per adapter','Retry success rate ≥ 95% (NFR-06)'],
    dest:'OTel Collector → App Insights + Log Analytics',
    rfp:['-02','-08','-09','-10'] },
  { id:'SEC',  icon:'🔒', color:'#ec4899', label:'SEC / Consent Enforcement', sub:'Per-call consent check events · ABAC denial logs',
    signals:['Every consent gate evaluation logged: subjectHash, purposeId, scopesRequested, outcome','ABAC denial events: callerRole, resourceType, ownerHash, reason','Step-up authentication trigger events (acr too low for operation)','Consent expiry warning events (TTL < 24h)'],
    metrics:['Consent gate evaluation latency P95','ABAC denial count per hour (alert threshold)','Step-up trigger rate per journey type','False grant rate (SLO = 0, NFR-11)'],
    dest:'Log Analytics with PII-stripped structured logs',
    rfp:['-03','-10'] },
  { id:'ADAP', icon:'🔌', color:'#22c55e', label:'Registry Adapters (×6)', sub:'Per-adapter spans · circuit breaker state · ETag hits',
    signals:['OTel span per registry call: adapterId, registryId, latencyMs, statusCode, cacheHit','ETag cache hit/miss counters per adapter per subjectHash bucket','Circuit breaker state gauges (CLOSED=0, OPEN=1, HALF_OPEN=2)','Retry counters with exponential backoff delays','Partial response events: which adapters succeeded / failed in fan-out'],
    metrics:['Adapter call success ≥ 99%/hr (NFR — CB opens on breach)','P95 adapter latency per registry (Civil/Address/Business/License/Tax/Land)','MDM cache hit-rate ≥ 80% (NFR-16)','Stale-field rate < 2% (NFR-25)'],
    dest:'OTel Collector → App Insights traces + Log Analytics adapter-health logs',
    rfp:['-02','-05','-08','-09'] },
  { id:'SB',   icon:'📨', color:'#f59e0b', label:'Service Bus / Event Grid', sub:'Queue depth · lag · DLQ age · delivery counters',
    signals:['Service Bus metrics: ActiveMessages, DeadLetterMessages, IncomingMessages, OutgoingMessages per queue/topic','Message age (oldest message timestamp) — alert if DLQ age > 4h','Event Grid delivery success/failure per subscription','Consumer lag per consumer group (KEDA scale trigger source)'],
    metrics:['Queue lag P95 < 2s (NFR-24)','DLQ message age — alert threshold 4h','Delivery success rate per topic subscription','Consumer scale-out events per hour'],
    dest:'Azure Monitor → Log Analytics + App Insights custom metrics',
    rfp:['-08','-09'] },
  { id:'OTEL', icon:'📡', color:'#06b6d4', label:'OTel Collector (Gateway)', sub:'Central aggregation · sampling · export to Azure',
    signals:['Head-based sampling: default 10%, 100% for errors, 100% for canary header x-canary:1','Tail-based sampling rules: elevate to 100% when latency > 2×SLO or error in span','Trace context propagation validation (alert if traceparent missing > 1% of spans)','Metric exemplars: histogram buckets linked to sample spans for fast root-cause'],
    metrics:['Span ingestion rate per service','Sampling effectiveness (error coverage ≥ 100%)','Collector queue saturation (alert > 80% capacity)','Export success rate to App Insights + Log Analytics'],
    dest:'Exports → Azure App Insights (traces/metrics) + Log Analytics (logs)',
    rfp:['-09'] },
  { id:'AI',   icon:'📊', color:'#8b5cf6', label:'App Insights + Log Analytics', sub:'KQL dashboards · burn-rate alerts · Sentinel feed',
    signals:['Structured JSON logs — all fields indexed for KQL query','SLO burn-rate alerts: 14× @ 5m/1h window AND 6× @ 30m/6h window (Google SRE multi-window)','Golden signals dashboards: Latency P50/P95, Error rate, Traffic, Saturation, Queue depth, CB state','Synthetic availability tests every 1 min from 3 Azure regions (auth → prefill → submit dry-run)'],
    metrics:['Error budget remaining (43.8 min/month for 99.9% SLO)','MTTR P1 ≤ 30min (NFR-30)','Alert-to-page latency < 5min','Dashboard load time for on-call triage < 30s'],
    dest:'Log Analytics → Sentinel (security analytics) + Power BI (operational dashboards)',
    rfp:['-09'] },
  { id:'SEN',  icon:'🛡', color:'#ef4444', label:'Microsoft Sentinel (SIEM/SOAR)', sub:'Analytics rules · SOAR playbooks · incident management',
    signals:['KQL analytics rules: impossible travel, brute force (>5 PKCE fails/min), webhook replay (nonce reuse)','Anomaly detection: unusual API call volumes (>3σ from baseline), off-hours admin access','SOAR playbook triggers: auto-block IP in Front Door WAF on brute-force incident','Incident enrichment: correlate JWT abuse events with adapter call anomalies'],
    metrics:['Detection latency (event to incident) < 15min target','False positive rate < 5% (tuning cadence: monthly)','Playbook execution success rate','P1 security containment ≤ 30min (NFR-30)'],
    dest:'Sentinel Incidents → on-call PagerDuty/Teams alert + SOC dashboard',
    rfp:['-03','-09','-10'] },
  { id:'PBI',  icon:'📈', color:'#8b5cf6', label:'Power BI (Fabric) — Operational Dashboards', sub:'Journey KPIs · SLO burn · adapter health · DR readiness',
    signals:['Journey Health: US-1 / US-2 funnel visualisation, P50/P95 latency trend, geo error heatmap','Adapter Health: per-registry circuit breaker state heatmap, throttle rate, P95 latency scatter','Queue & Retries: depth over time, DLQ reasons distribution, retry success funnel','DR Readiness: Postgres replica lag gauge, Cosmos multi-region status, Service Bus alias health'],
    metrics:['Dashboard refresh latency < 5min (Direct Lake)','SLO status: 🟢 / 🟡 / 🔴 per journey','MDM cache hit-rate trend (7-day rolling)','Error budget burn-rate chart (monthly window)'],
    dest:'Power BI Direct Lake on Fabric Warehouse Gold layer + App Insights connector',
    rfp:['-06','-09'] }
];

const TEL_DASHBOARDS = [
  { name:'Journey Health', users:'Product, SRE', desc:'US-1/US-2 funnels, P50/P95, error causes, geo heatmap' },
  { name:'Adapter Health', users:'SRE, Integration', desc:'Per-registry latency/error, CB states, throttle hits' },
  { name:'Queues & Retries', users:'SRE', desc:'Depth, age, retry rates, DLQ reasons' },
  { name:'Identity & Consent', users:'Security, Support', desc:'OIDC failures, RBAC denials, consent faults' },
  { name:'Data Layer', users:'Data Eng', desc:'Postgres wait events, Redis ops/sec, Cosmos RU/429s' },
  { name:'Webhook Ingress', users:'SRE, Vendor mgmt', desc:'Signature failures, idempotency hits, provider deltas' },
  { name:'DR Readiness', users:'SRE', desc:'Replica lag gauges, region health, alias status' },
];

function buildTelemetry() {
  const flow = document.getElementById('tel-flow');
  const detail = document.getElementById('tel-detail');
  const dashWrap = document.getElementById('tel-dashboards');
  if (!flow) return;

  TEL_HOPS.forEach((h, i) => {
    const div = document.createElement('div');
    div.className = 'tel-hop';
    div.innerHTML = `
      <div class="tel-hop-icon" style="background:${hexA4(h.color,0.12)};border:1.5px solid ${hexA4(h.color,0.35)}">${h.icon}</div>
      <div style="flex:1">
        <div class="tel-hop-title">${h.label}</div>
        <div class="tel-hop-sub">${h.sub}</div>
      </div>
      <div style="font-family:var(--font-mono);font-size:.6rem;color:${h.color};opacity:.8">${h.id}</div>`;
    div.addEventListener('click', () => {
      flow.querySelectorAll('.tel-hop').forEach(x => x.classList.remove('active'));
      div.classList.add('active');
      renderTelDetail(h, detail);
    });
    flow.appendChild(div);
    if (i < TEL_HOPS.length - 1) {
      const arr = document.createElement('div');
      arr.className = 'tel-arrow';
      arr.textContent = '↓';
      flow.appendChild(arr);
    }
  });

  if (dashWrap) {
    TEL_DASHBOARDS.forEach(d => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)';
      row.innerHTML = `
        <div style="width:9px;height:9px;border-radius:2px;background:var(--accent);flex-shrink:0;margin-top:4px"></div>
        <div>
          <div style="font-size:.75rem;font-weight:700;color:var(--text-1)">${d.name}</div>
          <div style="font-size:.68rem;color:var(--text-3)">${d.users}</div>
          <div style="font-size:.71rem;color:var(--text-2);margin-top:2px">${d.desc}</div>
        </div>`;
      dashWrap.appendChild(row);
    });
  }
}

function renderTelDetail(h, wrap) {
  wrap.innerHTML = `
    <div style="border-left:3px solid ${h.color};padding-left:10px;margin-bottom:12px">
      <div style="font-size:.65rem;color:var(--text-3);font-family:var(--font-mono);margin-bottom:2px">${h.id}</div>
      <div style="font-size:.85rem;font-weight:700;color:var(--text-1)">${h.label}</div>
    </div>
    <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">Emitted Signals</div>
    <ul style="list-style:none;margin-bottom:10px">${h.signals.map(s=>`<li style="font-size:.73rem;color:var(--text-2);padding:3px 0 3px 14px;position:relative"><span style="position:absolute;left:0;color:${h.color}">→</span>${s}</li>`).join('')}</ul>
    <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">Key Metrics & SLIs</div>
    <ul style="list-style:none;margin-bottom:10px">${h.metrics.map(m=>`<li style="font-size:.73rem;color:var(--text-2);padding:3px 0 3px 14px;position:relative"><span style="position:absolute;left:0;color:#16a34a">✓</span>${m}</li>`).join('')}</ul>
    <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:4px;padding-bottom:3px;border-bottom:1px solid var(--border)">Export Destination</div>
    <div style="font-size:.73rem;color:var(--text-2);margin-bottom:10px">${h.dest}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">${h.rfp.map(r=>`<span style="font-family:var(--font-mono);font-size:.59rem;padding:2px 7px;border-radius:3px;background:var(--orange-50);border:1px solid rgba(234,88,12,.2);color:var(--accent-dk)">RFP${r}</span>`).join('')}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// USER JOURNEYS
// ══════════════════════════════════════════════════════════════════════════════
const ARCH_NODES_MAP = {
  // node-id → readable label
  CLIENT:'End User', PORTAL:'Portal', SCHEMA:'UI Schema Svc', EID:'eID IdP (OIDC+PKCE)',
  CONS:'Consent Service', CLAIMS:'Claims Mapper', APIM:'APIM Premium',
  FACADE:'API Facade', ORCH:'Orchestrator', SEC:'SEC/Consent Gate', MAPVAL:'Map & Validate',
  DQ:'Data Quality', MDM:'MDM Cache (Redis)', RULES:'Rules Engine', EVENT:'Event Backbone',
  DLQ:'Dead Letter Queue', AUDIT:'Audit (WORM)', AD_CIV:'Adapter: Civil',
  AD_ADDR:'Adapter: Address', AD_BUS:'Adapter: Business', AD_LIC:'Adapter: License',
  AD_TAX:'Adapter: Tax', AD_LAND:'Adapter: Land/Kadaster', ESIGN:'eSign Provider',
  PAY:'Payment Gateway', DOCI:'Document Intake', CASESYS:'Case Management',
  APPLOGS:'App Insights / Log Analytics', SENT:'Sentinel (SIEM)',
  ODS_PG:'PostgreSQL ODS', COSMOS:'Cosmos DB', REDIS:'Redis Enterprise',
  BRONZE:'Bronze Layer', SILVER:'Silver Layer', GOLD:'Gold Layer', PBI:'Power BI'
};

const USER_STORIES = [
  { id:'US-1', title:'Prefill — OIDC+PKCE + Once-Only', cat:'Core', color:'#3b82f6',
    purpose:'Reuse verified government data to auto-populate service forms. Citizen never re-enters known facts.',
    happy:'Portal → OIDC+PKCE auth → APIM JWT validate → Facade build command → SEC consent gate → MDM ETag/TTL cache-first → on hit return bundle → on miss fan-out to adapters → MapVal → DQ → return filtered canonical bundle',
    failures:['Missing/expired consent → 403 problem+json + consent_required code','Registry degraded → partial bundle + problems[] + retry scheduled','JWT invalid → 401 + re-auth prompt','Rate limit exceeded → 429 + Retry-After header'],
    controls:['Consent Gate (SEC)', 'RBAC/ABAC (Claims Mapper + Facade)', 'ETag/TTL (MDM Redis)', 'corrId end-to-end', 'PII-stripped logs'],
    slo:'P95 ≤ 600ms (cache hit) · P95 ≤ 1.2s (miss, 1 SoR)',
    nodes:['CLIENT','PORTAL','EID','CONS','CLAIMS','APIM','FACADE','ORCH','SEC','MAPVAL','DQ','MDM','AD_CIV','AD_ADDR'],
    rfp:['-01','-02','-03','-04','-09'], nfr:['NFR-01','NFR-02','NFR-16'] },
  { id:'US-2', title:'Full Application: Prefill → Docs → eSign → Pay → Submit → Case', cat:'Core', color:'#f97316',
    purpose:'Complete end-to-end service journey from form prefill through submission and back-office case creation.',
    happy:'Prefill (US-1) → Rules/Fees eligibility check → Doc pre-sign URL → client uploads to Blob → AV/MIME scan → eSign package created → webhook confirms signature → PSP payment session → submit (Idempotency-Key) → case created → WORM audit receipt',
    failures:['Rules fail → explain decision + allow correction','AV/MIME scan fail → reject upload + friendly error','eSign webhook invalid → DLQ + provider retry','Case creation transient → retry/backoff → DLQ on max','Idempotent duplicate → 200 with prior receipt'],
    controls:['Idempotency-Key (ledger)', 'JWS/HMAC webhook verification', 'Immutable WORM audit receipt', 'corrId across all saga steps'],
    slo:'Submit success rate ≥ 99.5% (monthly)',
    nodes:['CLIENT','PORTAL','FACADE','ORCH','SEC','RULES','DOCI','ESIGN','PAY','CASESYS','AUDIT','EVENT','DLQ'],
    rfp:['-01','-02','-03','-07','-08'], nfr:['NFR-03','NFR-15','NFR-17','NFR-18'] },
  { id:'US-3', title:'Document Upload Pipeline', cat:'Documents', color:'#22c55e',
    purpose:'Secure, scalable document intake with anti-virus and MIME validation before linking to a case.',
    happy:'Facade validates metadata → return presigned SAS URL with policy constraints → client uploads direct to Blob → AV/MIME scan triggered → on clean: mark Ready + link to draft → on infected: mark Rejected',
    failures:['Disallowed MIME or size > 10MB → 400 with policy details','AV detects malware → Rejected state + SOC alert','Blob unavailable → retry/backoff → DLQ with full context'],
    controls:['Size+MIME policy enforcement (Facade)', 'Presigned SAS with short TTL', 'Evidence hash (SHA-256) on ingest', 'SOC alert on AV hit'],
    slo:'100% of uploads scanned (NFR-17)',
    nodes:['CLIENT','PORTAL','FACADE','DOCI','AUDIT','EVENT','DLQ','APPLOGS'],
    rfp:['-07','-03'], nfr:['NFR-17'] },
  { id:'US-4', title:'Webhook Ingress Normalisation', cat:'Integration', color:'#ec4899',
    purpose:'Safely receive provider callbacks (eSign completion, payment confirm) with anti-replay and idempotency.',
    happy:'Provider → APIM IP allowlist + rate limit → Facade verifies JWS/HMAC signature + timestamp/nonce anti-replay → idempotent upsert → emit domain event → update application state',
    failures:['Signature invalid → reject + park to DLQ + SOC alert','Replay detected (nonce reuse) → 200 idempotent (no state change)','Unknown reference → 202 parked for reconcile job','Clock skew > ±5min → 400 + guidance'],
    controls:['JWS/HMAC signature verify', 'Timestamp + nonce anti-replay (Redis nonce store)', 'Idempotency-Key ledger', 'IP allowlist (APIM policy)'],
    slo:'Verify+upsert P95 ≤ 150ms',
    nodes:['APIM','FACADE','ORCH','EVENT','DLQ','AUDIT','REDIS'],
    rfp:['-03','-07','-08'], nfr:['NFR-18'] },
  { id:'US-5', title:'MDM Cache Invalidation on SoR Change', cat:'Data', color:'#06b6d4',
    purpose:'Keep once-only prefill data fresh by invalidating the MDM cache when a source registry changes a record.',
    happy:'SoR emits change event → Event Grid routes to MDM invalidation handler → Orchestrator fetches latest from adapter → MapVal + DQ → MDM upsert with new ETag + reset TTL → optional push notification to active sessions',
    failures:['Event parse error → DLQ with raw event for replay','SoR temporarily down → retry/backoff → partial refresh with stale-marked fields','ETag conflict (concurrent update) → last-writer-wins with timestamp'],
    controls:['Event-driven freshness (no polling)', 'ETag rotation on invalidation', 'Stale field rate SLO < 2% (NFR-25)'],
    slo:'Stale field rate < 2% · MDM hit-rate ≥ 80%',
    nodes:['EVENT','ORCH','SEC','MAPVAL','DQ','MDM','AD_CIV','AD_ADDR','AD_BUS','AD_LIC','AD_TAX','AD_LAND','DLQ'],
    rfp:['-02','-05','-08'], nfr:['NFR-16','NFR-25'] },
  { id:'US-6', title:'Notifications Fan-out', cat:'Integration', color:'#8b5cf6',
    purpose:'Inform citizens and officers of key milestones (submitted, approved, payment confirmed) via email/SMS/push.',
    happy:'Controller emits domain event → Notification service picks locale-appropriate template → render (EN/NL) → call provider (email/SMS/push) → log delivery receipt',
    failures:['Provider outage → retry/backoff → failover to secondary provider → DLQ if both fail','Missing locale template → fallback to EN + alert content team','PII leak check — notification body contains only reference IDs, not raw data'],
    controls:['Non-PII payloads (reference IDs only)', 'corrId in every notification event', 'Locale-aware template engine', 'DLQ for retry'],
    slo:'Delivery success rate ≥ 99% (non-critical journey)',
    nodes:['EVENT','ORCH','DLQ','APPLOGS'],
    rfp:['-01','-08','-09'], nfr:['NFR-13'] },
  { id:'US-7', title:'Claims → RBAC Mapping', cat:'Security', color:'#ef4444',
    purpose:'Enforce least-privilege access by mapping eID claims to platform roles and checking ACR assurance level.',
    happy:'APIM enforces scopes + roles + acr threshold from JWT → Facade ABAC ownership check (callerSubjectId = resource owner) → Controller business-level authorization (e.g., can only modify own draft)',
    failures:['Missing scope/role → 403 with problem+json missing_scope','Ownership mismatch → 403 resource_forbidden','ACR too low → 403 with step_up_required hint and required acr value'],
    controls:['Multi-layer RBAC/ABAC (APIM→Facade→Controller)', 'ACR step-up trigger', 'Deny-by-default at all layers', '0 false grants SLO (NFR-11)'],
    slo:'RBAC denial accuracy > 99.99% (NFR-11)',
    nodes:['APIM','CLAIMS','FACADE','ORCH','SEC'],
    rfp:['-03','-04'], nfr:['NFR-09','NFR-11'] },
  { id:'US-8', title:'API Contract Lifecycle (v1 → v2)', cat:'Architecture', color:'#8b5cf6',
    purpose:'Evolve API contracts safely without breaking existing consumers through versioning and canary testing.',
    happy:'Additive changes deployed to /v1 behind feature flag → breaking changes in new /v2 contract → APIM canary header (x-api-canary: true) routes 5% to new version → Deprecation/Sunset headers added to /v1 → graduated traffic shift → /v1 deprecated',
    failures:['Schema mismatch on canary → 422 with validation errors → automatic rollback to v1','Canary health check fails → APIM route flip reverts to blue'],
    controls:['Versioned contracts (/v1…/v2)', 'Deprecation + Sunset headers (RFC 8594)', 'APIM header-based canary routing', 'problem+json for all faults'],
    slo:'API availability maintained during migration ≥ 99.9%',
    nodes:['APIM','FACADE','APPLOGS'],
    rfp:['-04','-09'], nfr:['NFR-08','NFR-14'] },
  { id:'US-9', title:'Orchestration Sagas', cat:'Architecture', color:'#3b82f6',
    purpose:'Coordinate multi-step workflows (consent → fetch → docs → eSign → pay → submit) with compensation on failure.',
    happy:'Orchestrator persists saga state to ODS → execute steps in sequence (each idempotent) → publish events on each step → on all steps complete → publish submitted event',
    failures:['Transient step failure → retry with exponential backoff → compensate on max retries → DLQ with full saga state for operator re-drive','Step timeout → mark timed-out → operator review'],
    controls:['Idempotent saga steps', 'Compensation transactions (undo)', 'Saga state persisted to PostgreSQL (PITR-recoverable)', 'DLQ with full context'],
    slo:'Saga completion success rate ≥ 99.5%',
    nodes:['ORCH','EVENT','DLQ','ODS_PG','AUDIT'],
    rfp:['-02','-08'], nfr:['NFR-06','NFR-15'] },
  { id:'US-10', title:'Mapping & Validation', cat:'Data', color:'#06b6d4',
    purpose:'Normalise heterogeneous registry responses into a single Canonical DTO with provenance and DQ rules.',
    happy:'Adapter-DTO received → JSON Schema validation → field mapping to Canonical DTO → DQ rules applied (hard + soft) → attach source provenance (adapterId, fetchedAt, version) → ETag derived → return canonical bundle',
    failures:['Schema violation → 422 with field-level errors','Hard DQ rule fail → 422 with problemCode dq_hard_failure','Soft DQ rule warn → proceed with warnings[] array in response'],
    controls:['Canonical DTO versioned schema', 'Hard vs soft DQ rule catalog', 'Provenance fields on every record', 'ETag derived from hash of canonical payload'],
    slo:'MapVal P95 < 50ms (internal)',
    nodes:['FACADE','ORCH','MAPVAL','DQ','MDM'],
    rfp:['-02','-05'], nfr:['NFR-10','NFR-14'] },
  { id:'US-11', title:'Data Quality Outcomes', cat:'Data', color:'#22c55e',
    purpose:'Ensure data correctness through layered hard/soft DQ rules with explainable outcomes.',
    happy:'DQ engine applies rule catalog → hard rules: schema, type, range, referential integrity → soft rules: completeness, freshness, cross-field consistency → return outcome with rule IDs, field paths, and human-readable explanations',
    failures:['Hard fail → 422 with dq_hard_failure + rule IDs + field paths','Soft warn → proceed with warnings[] in canonical bundle → UI may prompt user to verify'],
    controls:['Rule catalog versioned alongside schema', 'Explainable rule outcomes (rule ID + description)', 'Soft warn preserves journey flow'],
    slo:'100% of canonical DTOs DQ-evaluated',
    nodes:['MAPVAL','DQ','ORCH'],
    rfp:['-05','-06'], nfr:['NFR-10'] },
  { id:'US-12', title:'Save Draft & Resume', cat:'Core', color:'#f97316',
    purpose:'Allow citizens to save partial progress and resume their application journey without data loss.',
    happy:'POST /drafts → persist to ODS with ETag → return draftId + ETag → later GET /drafts/{id} → return with current ETag → PUT with If-Match header → optimistic concurrency check → update on match',
    failures:['ETag mismatch on PUT → 412 Precondition Failed (concurrent update detected)','Draft oversize > 512KB → 413 with guidance','Draft expired (> 180 days) → 404 with expiry info'],
    controls:['ETag optimistic concurrency (NFR-25)', 'Draft TTL 180 days (retention policy)', 'PITR-recoverable ODS storage'],
    slo:'Draft save P95 < 200ms',
    nodes:['PORTAL','FACADE','ORCH','ODS_PG'],
    rfp:['-01','-05'], nfr:['NFR-25'] },
  { id:'US-13', title:'Localisation & Accessibility', cat:'Portal', color:'#3b82f6',
    purpose:'Serve EN/NL bilingual forms with WCAG 2.1 AA accessibility across all channels.',
    happy:'UI Schema Service returns locale-specific schema (lang param) → Portal renders accessible components → keyboard navigation, focus indicators, aria labels, alt text → Axe CI scan zero critical violations',
    failures:['Missing locale key → fallback to EN + content alert for translation team','Schema version conflict between locales → 409 with canonical EN as source of truth'],
    controls:['Schema-driven localisation', 'WCAG 2.1 AA (NFR-19)', 'Axe CI gate', 'EN/NL coverage report (NFR-20)'],
    slo:'Lighthouse accessibility score ≥ 90 (NFR-28)',
    nodes:['PORTAL','SCHEMA'],
    rfp:['-01'], nfr:['NFR-19','NFR-20','NFR-27','NFR-28'] },
  { id:'US-14', title:'Kiosk Mode — Hardened Public Device', cat:'Portal', color:'#8b5cf6',
    purpose:'Support walk-in services on shared public kiosk devices with hardened session and identity controls.',
    happy:'Kiosk channel flag → short session TTL (15 min idle) → no token storage in browser (session-only, in-memory) → high acr required for sensitive operations → automatic session clear on idle or tab close',
    failures:['Idle timeout → session terminated → friendly restart prompt','High acr not available at kiosk → service unavailable for that operation → redirect to online or in-person'],
    controls:['Session TTL 15min', 'No refresh token storage', 'acr=2 minimum for sensitive ops', 'Privacy-by-design (no local persistence)'],
    slo:'Session clear on idle ≤ 15min (enforced)',
    nodes:['CLIENT','PORTAL','EID','APIM'],
    rfp:['-01','-03'], nfr:['NFR-09'] },
  { id:'US-15', title:'Eligibility Evaluation & Fee Computation', cat:'Core', color:'#f97316',
    purpose:'Determine eligibility for a service and compute applicable fees before the citizen invests in the full journey.',
    happy:'Controller calls Rules Engine with canonical prefill data → eligibility rules evaluated → return decision (eligible/not/inconclusive) + reasons[] + applicable_fees[] + valid_until timestamp',
    failures:['Incomplete prefill facts → inconclusive decision with missing_fields[]','Rules engine transient error → 503 + retry','Unknown service code → 404 with valid codes list'],
    controls:['Explainable decisions (reason codes)', 'Fee computation bound to rules version', 'Decision timestamp + TTL (re-check if stale)'],
    slo:'Rules evaluation P95 < 200ms',
    nodes:['ORCH','RULES','MDM','SEC'],
    rfp:['-01','-06'], nfr:['NFR-01'] },
  { id:'US-16', title:'Explainable Decisions (Transparency)', cat:'Core', color:'#22c55e',
    purpose:'Provide human-readable explanations for every eligibility or rejection decision per government transparency obligations.',
    happy:'Rules Engine attaches explanations[] to decision → each entry: ruleId, ruleVersion, description (EN/NL), affectedFields[] → Portal renders explanation in plain language with reference to applicable regulation',
    failures:['Missing rule description → generic rationale + log alert for content team','Provenance not available → note "reason unavailable" without failing the journey'],
    controls:['Human-readable rule descriptions', 'Locale-aware explanation rendering', 'Regulatory reference codes on each rule'],
    slo:'100% of non-trivial decisions include explanation',
    nodes:['ORCH','RULES','PORTAL'],
    rfp:['-01'], nfr:[] },
  { id:'US-17', title:'Document Pre-sign URL', cat:'Documents', color:'#22c55e',
    purpose:'Issue short-lived pre-signed upload URLs with policy constraints to enable direct client-to-Blob uploads.',
    happy:'POST /documents/presign → validate metadata (name, MIME, size) → generate SAS URL with 15min TTL + policy: allowed MIME types, max size, container path → return URL + uploadId',
    failures:['Disallowed MIME type → 400 with allowed_mimes list','Size > 10MB policy → 400 with max_size','SAS generation error → 503 + retry hint'],
    controls:['MIME allowlist enforcement', 'Size policy at pre-sign time', 'SAS TTL 15min (short-lived)', 'Container isolation per application'],
    slo:'Pre-sign P95 < 100ms',
    nodes:['FACADE','DOCI'],
    rfp:['-07','-03'], nfr:['NFR-17'] },
  { id:'US-18', title:'AV / MIME Content Safety Scan', cat:'Documents', color:'#ef4444',
    purpose:'Scan every uploaded document for malware and spoofed MIME types before it is accessible to any user.',
    happy:'Blob upload → AV/MIME scan triggered (async) → scan checks: EICAR/signature match + MIME magic bytes vs declared type → mark Ready → link to draft/case',
    failures:['Malware detected → mark Rejected + quarantine + SOC alert via Sentinel','MIME spoof (declared vs actual mismatch) → mark Rejected + 400 on retrieval attempt','Scan service timeout → retry → if persistent: DLQ + manual quarantine'],
    controls:['EICAR test in CI pipeline (NFR-17)', 'MIME magic byte check', 'SOC alert on malware', 'SHA-256 evidence hash on every ingest'],
    slo:'100% of uploads scanned within 90s (NFR-17)',
    nodes:['DOCI','AUDIT','SENT','EVENT','DLQ'],
    rfp:['-07','-03'], nfr:['NFR-17'] },
  { id:'US-19', title:'Link Documents to Case', cat:'Documents', color:'#06b6d4',
    purpose:'Create an auditable, traceable link between uploaded documents and their parent case or draft.',
    happy:'POST /cases/{id}/documents → validate documentId exists + status=Ready + belongs to caller → store link record with hash pointer → emit case_document_linked event',
    failures:['Document not found → 404','Document status not Ready → 409 with current status','Stale SAS URL (> TTL) → 410 Gone + refresh instructions'],
    controls:['Hash pointer in link record (tamper-evidence)', 'Ownership check (ABAC)', 'Audit event on link creation'],
    slo:'Link operation P95 < 150ms',
    nodes:['FACADE','ORCH','DOCI','CASESYS','AUDIT'],
    rfp:['-07','-05'], nfr:['NFR-15'] },
  { id:'US-20', title:'eSign Package Create', cat:'Integration', color:'#ec4899',
    purpose:'Create a digital signature package via external eSign provider and track its lifecycle through webhooks.',
    happy:'POST /esign/packages → validate signers + documents → call eSign provider API → receive packageId → store pending state → return packageId to Portal → provider sends webhook on completion',
    failures:['Invalid signer (unknown subjectId) → 422','Provider throttle → 429 + retry-after → exponential backoff','Provider unavailable → 503 + saga compensation (mark package pending-retry)'],
    controls:['packageId stored with idempotency (no duplicate packages)', 'JWS webhook verification (US-4)', 'Signed evidence receipt on completion'],
    slo:'Package create P95 < 1s (excl. provider)',
    nodes:['FACADE','ORCH','ESIGN','EVENT','AUDIT'],
    rfp:['-07','-03'], nfr:['NFR-18'] },
  { id:'US-21', title:'eSign Webhook Reconcile', cat:'Integration', color:'#ec4899',
    purpose:'Finalise signature status when the eSign provider calls back with the signed document.',
    happy:'Provider → APIM (IP allowlist) → Facade verifies JWS/HMAC + nonce → upsert signature status to Signed → emit esign_completed event → trigger document link + next saga step',
    failures:['Invalid signature → DLQ + provider notified to retry with correct key','Duplicate webhook (same packageId) → 200 idempotent + no state change','Unknown packageId → 202 parked + reconcile job'],
    controls:['Anti-replay (nonce + Redis store)', 'Idempotency (ledger by packageId)', 'JWS/HMAC verify (NFR-18)'],
    slo:'Webhook process P95 ≤ 150ms',
    nodes:['APIM','FACADE','ORCH','EVENT','AUDIT','DLQ','REDIS'],
    rfp:['-07','-08','-03'], nfr:['NFR-18'] },
  { id:'US-22', title:'Payment Session', cat:'Integration', color:'#f59e0b',
    purpose:'Create a PCI-compliant payment session via PSP and confirm payment through secure webhook.',
    happy:'POST /payments/sessions → validate amount + currency + reference → call PSP create session → return redirect URL → citizen completes 3-DS → PSP webhook confirms payment → emit payment_confirmed event',
    failures:['3-DS failure → pending_retry state → citizen can retry same session','PSP outage → 503 + backoff → DLQ if persistent','Amount mismatch on webhook → reject + SOC alert'],
    controls:['PCI offloaded to PSP (no card data in platform)', 'JWS/HMAC webhook verify', 'Idempotency on session create', 'Amount validation on callback'],
    slo:'Session create P95 < 500ms',
    nodes:['FACADE','ORCH','PAY','EVENT','AUDIT'],
    rfp:['-07','-03'], nfr:['NFR-18'] },
  { id:'US-23', title:'Payment Reconciliation', cat:'Integration', color:'#f59e0b',
    purpose:'Nightly reconciliation between platform payment records and PSP settlement reports to ensure financial accuracy.',
    happy:'Nightly ADF job → pull PSP settlement file → compare with ODS payment records → flag mismatches → generate reconciliation report → auto-process refunds within policy → alert ops for manual review items',
    failures:['Discrepancy found → ops task created + hold case until resolved','Refund API failure → DLQ + manual intervention','PSP report late → retry next window'],
    controls:['Immutable audit trail (all payment events in WORM)', 'Reconciliation report archived to Blob', 'Ops escalation SLA (< 24h for discrepancies)'],
    slo:'Reconciliation completed ≤ 06:00 next business day',
    nodes:['ORCH','PAY','ODS_PG','AUDIT','BRONZE'],
    rfp:['-07','-06'], nfr:[] },
  { id:'US-24', title:'Submit Application (Idempotent)', cat:'Core', color:'#f97316',
    purpose:'Final, irreversible application submission with idempotency guarantee and WORM audit receipt.',
    happy:'POST /applications with Idempotency-Key → validate all prerequisites complete (eSign, payment, docs) → persist submission → create case → write WORM JWS-signed audit receipt → emit application_submitted event → return confirmation',
    failures:['Duplicate key → 200 with original receipt (no re-processing)','Missing prerequisite → 409 with which step is incomplete','Case creation transient → retry/backoff → DLQ on max with full saga state'],
    controls:['Idempotency ledger (NFR-15)', 'WORM JWS receipt (non-repudiation)', 'Prerequisite validation before commit', 'corrId links all upstream events'],
    slo:'Submit P95 ≤ 1.5s (NFR-03)',
    nodes:['PORTAL','FACADE','ORCH','SEC','CASESYS','AUDIT','EVENT','DLQ','ODS_PG'],
    rfp:['-01','-07','-03'], nfr:['NFR-03','NFR-15'] },
  { id:'US-25', title:'Case Create / Update / Status', cat:'Integration', color:'#3b82f6',
    purpose:'Create and update back-office case records and provide status visibility to both citizen and officer.',
    happy:'Controller calls Case Adapter → create case with application bundle → receive caseId → store in ODS → emit case_created event → Portal subscribes for status updates via Event Grid subscription or polling GET /cases/{id}/status',
    failures:['Case system transient → retry/backoff → DLQ on max','Unknown application reference → 404','Case system schema drift → 422 + alert for adapter update'],
    controls:['Case adapter circuit breaker', 'Idempotent case creation (applicationId as idempotency key)', 'Case status webhook subscription for real-time updates'],
    slo:'Case creation P95 < 2s (excl. back-office)',
    nodes:['ORCH','CASESYS','EVENT','DLQ','ODS_PG'],
    rfp:['-02'], nfr:[] },
  { id:'US-26', title:'Threat Detection (Sentinel)', cat:'Security', color:'#ef4444',
    purpose:'Detect and respond to security threats in real-time using AI-powered analytics and automated playbooks.',
    happy:'Structured logs from all services → Log Analytics → Sentinel KQL analytics rules evaluate → anomaly detected → incident created with severity → SOAR playbook triggered → auto-containment (IP block) → SOC notified',
    failures:['False positive → SOC tunes rule → suppress recurrence','Detection gap → new rule created in after-action review','Playbook failure → manual SOC escalation'],
    controls:['KQL rules: impossible travel, brute force, webhook replay, off-hours admin','SOAR playbooks: auto-block IP in Front Door WAF','MTTR P1 ≤ 30min (NFR-30)', 'Monthly false-positive tuning cadence'],
    slo:'P1 containment MTTR ≤ 30min (NFR-30)',
    nodes:['APPLOGS','SENT','APIM','FACADE'],
    rfp:['-09','-03'], nfr:['NFR-30'] },
  { id:'US-27', title:'End-to-End Distributed Tracing', cat:'Observability', color:'#06b6d4',
    purpose:'Enable fast incident triage by propagating x-correlation-id and W3C traceparent across all platform hops.',
    happy:'APIM generates corrId if missing → propagated as x-correlation-id header to Facade → Controller → Adapters → Service Bus message headers → webhooks → App Insights links all spans by corrId + traceId',
    failures:['Missing corrId on ingress → APIM generates new UUID + logs warning','Span link broken (missing traceparent) → alert if > 1% of spans','Queue message without traceparent → Collector inserts synthetic root span'],
    controls:['100% corrId propagation SLO (NFR-13)', 'W3C traceparent + tracestate', 'OTel Collector validation rules', 'Alert on propagation failure rate > 1%'],
    slo:'corrId+traceparent present in 100% of spans (NFR-13)',
    nodes:['APIM','FACADE','ORCH','AD_CIV','EVENT','APPLOGS'],
    rfp:['-09'], nfr:['NFR-13'] },
  { id:'US-28', title:'Cache-First Prefill (MDM)', cat:'Data', color:'#06b6d4',
    purpose:'Achieve P95 ≤ 600ms prefill by serving from Redis MDM cache before calling any registry.',
    happy:'Orchestrator → GET /mdm/snapshot/{nid} with If-None-Match ETag → Redis HIT → 304 → return cached bundle → P95 < 5ms from Redis → total < 600ms',
    failures:['Cache MISS → fan-out to adapters → store in Redis with ETag + TTL → P95 ≤ 1.2s','Redis unavailable → degrade to direct adapter fetch → log + increment degraded_mode counter','ETag collision → fetch fresh + update'],
    controls:['ETag/TTL (NFR-16, NFR-25)', 'Cache hit-rate monitoring ≥ 80%', 'Redis HA (zonal cluster)', 'Graceful degrade to direct fetch'],
    slo:'Cache hit P95 ≤ 600ms · Cache hit-rate ≥ 80% (NFR-16)',
    nodes:['ORCH','MDM','REDIS','AD_CIV','AD_ADDR','AD_BUS','AD_LIC','AD_TAX','AD_LAND'],
    rfp:['-01','-05'], nfr:['NFR-01','NFR-16'] },
  { id:'US-29', title:'Event-Driven Cache Invalidation', cat:'Data', color:'#22c55e',
    purpose:'Maintain MDM cache freshness through event-driven SoR change propagation rather than polling.',
    happy:'Registry SoR change → Event Grid → MDM invalidation Azure Function → rotate ETag → reset TTL to 0 (force miss on next access) → optional active session notification',
    failures:['Event parse error → DLQ → event replayed from Event Grid dead-letter','SoR down during invalidation → partial refresh → fields marked stale → stale-field counter increment'],
    controls:['Event-driven (< 60s freshness after SoR change)', 'Stale field rate < 2% SLO (NFR-25)', 'DLQ for failed invalidations'],
    slo:'Cache stale field rate < 2% (NFR-25)',
    nodes:['EVENT','MDM','AD_CIV','AD_ADDR','AD_BUS','AD_LIC','AD_TAX','AD_LAND','DLQ'],
    rfp:['-08','-05'], nfr:['NFR-25'] },
  { id:'US-30', title:'Civil Registry Read (Adapter)', cat:'Registries', color:'#22c55e',
    purpose:'Fetch verified identity data (name, DOB, NIN) from Civil Registry via dedicated adapter.',
    happy:'Orchestrator selects AD_CIV → authenticate (Managed Identity or API key from Key Vault) → GET /persons/{nid} → map to Canonical DTO → attach provenance (source:civil, fetchedAt) → return',
    failures:['Rate limit → 429 + exponential backoff','Schema drift (registry changed API) → 422 schema_mismatch + alert for adapter update','Circuit breaker open → partial canonical bundle with civil fields missing + problems[]'],
    controls:['Circuit breaker per adapter', 'Schema version pinning', 'Adapter policy pack (timeout, retry, CB settings)', 'Key Vault for credentials'],
    slo:'Civil adapter call success ≥ 99%/hr',
    nodes:['ORCH','SEC','AD_CIV','MAPVAL','DQ','MDM'],
    rfp:['-02','-08'], nfr:['NFR-06'] },
  { id:'US-31', title:'Address Registry Read (Adapter)', cat:'Registries', color:'#22c55e',
    purpose:'Fetch verified address data from the national Address Registry.',
    happy:'Orchestrator selects AD_ADDR → authenticate → GET /addresses?nid={nid} → map to canonical address DTO (street, postcode, city, country) → provenance → return',
    failures:['Address not found → partial bundle with address fields empty + warning','Registry maintenance window → circuit breaker open → cached last-known + stale flag'],
    controls:['Stale flag on cached address during registry downtime', 'Canonical address schema versioned', 'Event-driven invalidation when address changes'],
    slo:'Address adapter call success ≥ 99%/hr',
    nodes:['ORCH','SEC','AD_ADDR','MAPVAL','DQ','MDM'],
    rfp:['-02','-08'], nfr:['NFR-06'] },
  { id:'US-32', title:'Business Registry Read (Adapter)', cat:'Registries', color:'#22c55e',
    purpose:'Fetch KvK/CoC business registration data for business service journeys.',
    happy:'Orchestrator selects AD_BUS → authenticate → GET /businesses/{kvk} → map to canonical business DTO (name, KvK, legalForm, status, directors[]) → provenance → return',
    failures:['Business dissolved → return status=dissolved in canonical DTO (not an error)','KvK not found → 404 + guidance for user to register first'],
    controls:['Business status field in canonical DTO', 'Director list with ownership percentages', 'Change-event subscription for invalidation'],
    slo:'Business adapter call success ≥ 99%/hr',
    nodes:['ORCH','SEC','AD_BUS','MAPVAL','DQ','MDM'],
    rfp:['-02','-08'], nfr:['NFR-06'] },
  { id:'US-33', title:'License Registry Read (Adapter)', cat:'Registries', color:'#22c55e',
    purpose:'Fetch professional licenses, permits, and certifications from the License Registry.',
    happy:'Orchestrator selects AD_LIC → authenticate → GET /licenses/{nid} → map to canonical license[] DTO → include: licenseType, status, issuedDate, expiryDate, issuingAuthority → return',
    failures:['License expired → include in DTO with status=expired (not filtered — let rules engine decide)','Pagination required → adapter handles pagination transparently → return merged result'],
    controls:['Expiry date preserved in canonical DTO', 'Pagination transparent to Orchestrator', 'Provenance: issuingAuthority field'],
    slo:'License adapter call success ≥ 99%/hr',
    nodes:['ORCH','SEC','AD_LIC','MAPVAL','DQ','MDM'],
    rfp:['-02','-08'], nfr:['NFR-06'] },
  { id:'US-34', title:'Tax Registry Read (Adapter)', cat:'Registries', color:'#22c55e',
    purpose:'Fetch tax status and obligation data from the Tax Authority registry.',
    happy:'Orchestrator selects AD_TAX → authenticate (mTLS or API key) → GET /tax-status/{nid} → map to canonical tax DTO → include: taxNumber, vatStatus, complianceStatus, lastFilingDate → return with higher ACR requirement',
    failures:['ACR too low for tax data → 403 acr_insufficient + step_up required at acr=2','Tax data classification restricted → scoped consent required before adapter call'],
    controls:['Higher ACR requirement (acr=2 minimum)', 'Mandatory consent scope for tax data', 'mTLS for registry auth where supported'],
    slo:'Tax adapter call success ≥ 99%/hr (high-assurance path)',
    nodes:['ORCH','SEC','CLAIMS','AD_TAX','MAPVAL','DQ','MDM'],
    rfp:['-02','-03','-08'], nfr:['NFR-09','NFR-06'] },
  { id:'US-35', title:'Land/Kadaster Registry Read (Adapter)', cat:'Registries', color:'#22c55e',
    purpose:'Fetch property and land ownership records from the Kadaster registry.',
    happy:'Orchestrator selects AD_LAND → authenticate → GET /properties?nid={nid} → map to canonical property[] DTO → include: cadastralId, address, ownershipType, encumbrances[], area → return',
    failures:['Property not registered under NID → empty array (not 404 — citizen may not own property)','Large encumbrances list → adapter paginates → merged canonical list returned'],
    controls:['Empty array for no ownership (explicit empty, not error)', 'Ownership evidence hash in canonical DTO', 'Change-event subscription'],
    slo:'Kadaster adapter call success ≥ 99%/hr',
    nodes:['ORCH','SEC','AD_LAND','MAPVAL','DQ','MDM'],
    rfp:['-02','-08'], nfr:['NFR-06'] },
  { id:'US-36', title:'Circuit Breakers & Bulkheads', cat:'Resilience', color:'#ef4444',
    purpose:'Contain adapter failures to prevent cascade degradation across independent registry connections.',
    happy:'Each adapter has isolated CB: monitors 5xx+timeout rate over 60s window → CLOSED (normal) → threshold hit (≥20% over 60s) → OPEN (fail-fast, return partial) → after 30s → HALF_OPEN (5 probe requests) → if healthy → CLOSED',
    failures:['CB stays open → degraded mode with cached/partial data → ops alert via Sentinel + KQL rule','False positive open → half-open probes recover → auto-close → ops informed'],
    controls:['Per-adapter CB (isolated bulkheads)', 'CB state gauge in Prometheus (0=closed, 1=open, 2=half-open)', 'Partial canonical bundle returned (not total failure)', 'Ops alert on CB open > 5min'],
    slo:'CB state visible in Adapter Health dashboard < 1min lag',
    nodes:['ORCH','AD_CIV','AD_ADDR','AD_BUS','AD_LIC','AD_TAX','AD_LAND','APPLOGS','SENT'],
    rfp:['-08','-09'], nfr:['NFR-06'] },
  { id:'US-37', title:'Retry, Backoff & DLQ Operations', cat:'Resilience', color:'#ef4444',
    purpose:'Ensure safe retry with exponential backoff and DLQ-based recovery for all asynchronous failures.',
    happy:'Transient failure → retry 1 (250ms) → retry 2 (1s) → retry 3 (4s) → if all fail → DLQ with full context (corrId, saga state, error detail, retryCount) → DLQ monitor alert if age > 4h → operator executes re-drive runbook',
    failures:['Non-idempotent retry causes duplicate → prevented by Idempotency-Key ledger','DLQ grows unbounded → alert → SRE investigates root cause → re-drive or discard with justification'],
    controls:['Exponential backoff 250ms/1s/4s + jitter', 'Idempotent retry (NFR-15)', 'DLQ message age SLO: alert > 4h', 'Re-drive runbook documented'],
    slo:'DLQ message age alert threshold ≤ 4h',
    nodes:['ORCH','EVENT','DLQ','APPLOGS','SENT'],
    rfp:['-08','-09'], nfr:['NFR-06','NFR-24'] },
  { id:'US-38', title:'Disaster Recovery — Regional Failover', cat:'Resilience', color:'#8b5cf6',
    purpose:'Restore full service in Region B within RPO ≤ 5min data loss and RTO ≤ 60min downtime after a regional failure.',
    happy:'Region A failure detected → Front Door health probe fails → origin switched to Region B APIM → Region B Container Apps warmed up → PostgreSQL replica promoted → Service Bus alias switched → Cosmos auto-failover → smoke tests pass → traffic live in Region B',
    failures:['Postgres promotion takes > 30min → RTO risk → escalate → run manual promotion steps','Cosmos auto-failover not triggered → manual failover via portal + CLI → alert data team','Split-brain avoided by single-writer promotion procedure (only one primary at a time)'],
    controls:['RPO ≤ 5min (PostgreSQL WAL lag monitoring)', 'RTO ≤ 60min (runbook + pre-warmed Region B)', 'Front Door origin health probes every 30s', 'Quarterly DR drill with signed report (NFR-07)'],
    slo:'RPO ≤ 5min · RTO ≤ 60min (NFR-07)',
    nodes:['APIM','FACADE','ORCH','ODS_PG','COSMOS','REDIS','EVENT','AUDIT'],
    rfp:['-11','-09'], nfr:['NFR-07'] }
];

const US_CATS = ['All','Core','Security','Data','Integration','Documents','Portal','Registries','Resilience','Observability','Architecture'];

function buildUserJourneys() {
  const grid = document.getElementById('us-grid');
  const detail = document.getElementById('us-detail');
  const filters = document.getElementById('us-filters');
  const search = document.getElementById('us-search');
  if (!grid) return;

  // Filters
  US_CATS.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'us-filter-btn' + (cat === 'All' ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      filters.querySelectorAll('.us-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid(cat, search?.value || '');
    });
    filters.appendChild(btn);
  });

  if (search) search.addEventListener('input', () => {
    const activeCat = filters.querySelector('.us-filter-btn.active')?.textContent || 'All';
    renderGrid(activeCat, search.value);
  });

  function renderGrid(cat, q) {
    grid.innerHTML = '';
    const filtered = USER_STORIES.filter(u => {
      const catMatch = cat === 'All' || u.cat === cat;
      const qMatch = !q || u.title.toLowerCase().includes(q.toLowerCase()) || u.id.toLowerCase().includes(q.toLowerCase()) || u.purpose.toLowerCase().includes(q.toLowerCase());
      return catMatch && qMatch;
    });
    filtered.forEach(u => {
      const card = document.createElement('div');
      card.className = 'us-card';
      card.innerHTML = `
        <div class="us-strip" style="background:${u.color}"></div>
        <div class="us-id">${u.id}</div>
        <div class="us-title">${u.title}</div>
        <div class="us-rfp" style="margin-top:4px">${u.rfp.map(r=>`<span style="background:var(--orange-50);border:1px solid rgba(234,88,12,.2);color:var(--accent-dk);border-radius:3px;padding:0 4px;font-size:.58rem">RFP${r}</span>`).join(' ')}</div>`;
      card.addEventListener('click', () => {
        grid.querySelectorAll('.us-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        renderUSDetail(u, detail);
      });
      grid.appendChild(card);
    });
  }

  renderGrid('All', '');
}

function renderUSDetail(u, wrap) {
  wrap.innerHTML = `
    <div style="border-left:4px solid ${u.color};padding-left:12px;margin-bottom:14px">
      <div style="font-family:var(--font-mono);font-size:.62rem;color:var(--text-3)">${u.id} · ${u.cat}</div>
      <div style="font-size:.9rem;font-weight:700;color:var(--text-1);margin:3px 0">${u.title}</div>
      <div style="font-size:.76rem;color:var(--text-2);line-height:1.6">${u.purpose}</div>
    </div>

    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">Happy Path</div>
    <div style="font-size:.74rem;color:var(--text-2);line-height:1.7;margin-bottom:12px;border-left:3px solid ${u.color};padding-left:9px">${u.happy}</div>

    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">Failure Modes & Handling</div>
    <ul style="list-style:none;margin-bottom:12px">${u.failures.map(f=>`<li style="font-size:.73rem;color:var(--text-2);padding:3px 0 3px 14px;position:relative"><span style="position:absolute;left:0;color:#dc2626;font-size:.65rem">⚠</span>${f}</li>`).join('')}</ul>

    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">Controls & Guarantees</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">${u.controls.map(c=>`<span style="font-size:.68rem;background:var(--bg-elevated);border:1px solid var(--border-mid);border-radius:3px;padding:2px 7px;color:var(--text-2)">${c}</span>`).join('')}</div>

    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">Architecture Components Touched</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">${u.nodes.map(n=>`<span class="us-arch-tag"><span style="width:7px;height:7px;border-radius:2px;background:${(ND.sw[n]||{}).color||u.color};flex-shrink:0"></span>${ARCH_NODES_MAP[n]||n}</span>`).join('')}</div>

    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
      <div style="font-family:var(--font-mono);font-size:.68rem;color:var(--accent-dk);background:var(--orange-50);border:1px solid rgba(234,88,12,.2);border-radius:4px;padding:4px 10px">${u.slo}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">${u.nfr.map(n=>`<span style="font-family:var(--font-mono);font-size:.6rem;padding:2px 6px;border-radius:3px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);color:#7c3aed">${n}</span>`).join('')}${u.rfp.map(r=>`<span style="font-family:var(--font-mono);font-size:.6rem;padding:2px 6px;border-radius:3px;background:var(--orange-50);border:1px solid rgba(234,88,12,.2);color:var(--accent-dk)">RFP${r}</span>`).join('')}</div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// NFR MATRIX
// ══════════════════════════════════════════════════════════════════════════════
const NFRS = [
  { id:'NFR-01', cat:'Performance', req:'US-1 prefill cache P95 latency', target:'≤ 600 ms', metric:'APIM→Facade→Controller trace span timer', accept:'Synthetic + live A/B; 48h sustained run', priority:'Must', rfp:'-01, -04, -09',
    detail:'Measured from APIM ingress to response body received. Cache hit path includes: APIM policy (< 150ms) + Facade build-command (< 100ms) + Redis GET (< 5ms). Budget: APIM 150ms + Facade 100ms + Redis 5ms + network 50ms = 305ms P50 target. P95 budget 600ms includes tail latency. Verified via k6 load test with 8k concurrent users for 48h with Redis warmed to ≥ 80% hit rate.',
    enabler:'Redis Enterprise MDM cache + ETag/TTL + KEDA autoscale on Container Apps', us:['US-1','US-28'] },
  { id:'NFR-02', cat:'Performance', req:'US-1 prefill miss (1 SoR) P95', target:'≤ 1.2 s', metric:'OTel spans across adapter hop', accept:'Load test with civil adapter stub; 500 concurrent users', priority:'Must', rfp:'-02, -09',
    detail:'Cache miss path adds one adapter round-trip. Budget: APIM 150ms + Facade 100ms + Redis 5ms + Orchestrator 100ms + Adapter (Civil) ≤ 500ms + MapVal/DQ 80ms + Redis write 10ms + network 80ms = ~1025ms P50. P95 budget 1.2s. Circuit breaker prevents cascade if adapter is slow.',
    enabler:'Per-adapter timeout settings (read 5-10s budget but target < 500ms) + circuit breaker', us:['US-1','US-28'] },
  { id:'NFR-03', cat:'Performance', req:'US-2 submit→case P95', target:'≤ 1.5 s', metric:'End-to-end OTel trace span', accept:'Scenario load 500 RPS sustained 30min', priority:'Must', rfp:'-01, -07',
    detail:'Full submit path: APIM → Facade → Orchestrator (prerequisite check) → ODS write → Case Adapter → Audit WORM write → event emit. Synchronous path P95 ≤ 1.5s. eSign/payment confirmations are async via webhook so not in this budget.',
    enabler:'Async saga pattern (eSign/payment separated from synchronous submit path)', us:['US-2','US-24'] },
  { id:'NFR-04', cat:'Availability', req:'Portal + APIM availability', target:'≥ 99.9%/month', metric:'Synthetic probes every 1min from 3 Azure regions', accept:'30-day report; error budget = 43.8 min/month', priority:'Must', rfp:'-01, -04, -11',
    detail:'Measured as (successful_requests / total_requests) × 100% across synthetic and real-user blended signal. Error budget: 43.8 min/month. Burn-rate alerts: 14× @ 5min/1h window AND 6× @ 30min/6h window. Zone-redundant deployment in Region A; Region B standby activated on probe failure.',
    enabler:'Azure Front Door global anycast + APIM Premium zonal + Container Apps zonal replicas', us:['US-38'] },
  { id:'NFR-05', cat:'Availability', req:'Platform (Facade + Controllers) availability', target:'≥ 99.9%/month', metric:'Health endpoint /healthz + error budget tracking', accept:'30-day report from App Insights availability tests', priority:'Must', rfp:'-04, -11',
    detail:'Internal platform health measured via /healthz (readiness) and /livez (liveness) endpoints polled by Container Apps health probes. Restart on liveness failure; traffic removed on readiness failure. Error budget same as NFR-04.',
    enabler:'Container Apps health probes + blue/green deploy (zero downtime) + min replicas > 1', us:['US-38'] },
  { id:'NFR-06', cat:'Reliability', req:'Retry success on transient failure', target:'≥ 95%', metric:'retry_success_counter / (retry_success + max_retry_exhausted)', accept:'Chaos test: inject 5xx/timeouts at 20% rate for 30min; verify ≥ 95% eventual success', priority:'Must', rfp:'-08',
    detail:'Retry policy: 3 attempts, exponential backoff 250ms/1s/4s with ±20% jitter. Only applied to idempotent operations (GET, idempotent PUT). On max retry exhaustion: park to DLQ with full context. Chaos test baseline: 20% error injection → 95%+ of requests eventually succeed within budget.',
    enabler:'Polly resilience library in adapter clients + Service Bus retry policy + KEDA-based consumer autoscale', us:['US-36','US-37'] },
  { id:'NFR-07', cat:'DR', req:'RPO and RTO targets', target:'RPO ≤ 5min · RTO ≤ 60min', metric:'DB WAL replication lag (RPO) + DR drill total time (RTO)', accept:'Quarterly DR drill; signed report; SLO green after failover', priority:'Must', rfp:'-11',
    detail:'RPO: PostgreSQL WAL streaming replication lag to Region B replica monitored every 30s. Alert if lag > 3min. Cosmos DB continuous backup RPO ≈ seconds. RTO: Front Door origin switch < 5min + Container Apps warm-start < 15min + PostgreSQL promotion < 30min (runbook) + smoke tests < 10min = 60min budget.',
    enabler:'PostgreSQL geo-replica + Cosmos multi-region + Service Bus Geo-DR + Front Door origin swap', us:['US-38'] },
  { id:'NFR-08', cat:'Scalability', req:'Horizontal autoscale headroom', target:'≥ 20% capacity headroom at peak', metric:'HPA / APIM autoscale metrics at peak load', accept:'Peak event test: 2× normal RPS for 15min; verify no queue saturation > 10s', priority:'Must', rfp:'-09',
    detail:'KEDA scales Container Apps on: HTTP concurrency (APIM → Facade), queue depth (Service Bus → Controllers), CPU/memory. APIM units sized for peak + 20% headroom. Load test must demonstrate: at 2× peak, queue lag stays < 10s and P95 latency stays within SLO × 1.5.',
    enabler:'KEDA on Container Apps + APIM Premium autoscale units + Service Bus TU autoscale', us:['US-9'] },
  { id:'NFR-09', cat:'Security', req:'OAuth/OIDC + PKCE (S256) enforced', target:'100% enforced (0 bypass)', metric:'APIM policy logs + pen-test results', accept:'Pen-test black-box; APIM auth black-box tests; 0 bypasses found', priority:'Must', rfp:'-03',
    detail:'All external API calls validated via APIM JWT validation policy: signature (RS256/ES256), expiry, issuer, audience, required scopes. PKCE S256 enforced at IdP — no implicit flow, no password grant. APIM blocks all requests without valid Bearer JWT. Facade re-validates ownership claims.',
    enabler:'APIM validate-jwt policy + eID IdP PKCE enforcement + Facade ABAC ownership checks', us:['US-7','US-14'] },
  { id:'NFR-10', cat:'Privacy', req:'Consent gate before every external call', target:'100% (0 calls without consent)', metric:'Controller audit logs: consent_check outcome before adapter_call', accept:'Targeted test: attempt adapter call without consent → must 403. Audit log proves gate on every call.', priority:'Must', rfp:'-10',
    detail:'SEC component wraps every Orchestrator → Adapter call. Checks: (1) valid consent record exists, (2) purposeId matches current operation, (3) requested scopes ⊆ granted scopes, (4) consent not expired. On any failure: 403 with consent_required problem code. Zero bypass is a hard SLO.',
    enabler:'SEC component (explicit consent gate class) + consent_check span in OTel trace', us:['US-1','US-5'] },
  { id:'NFR-11', cat:'Authorization', req:'Layered RBAC/ABAC — 0 false grants', target:'0 false privilege grants', metric:'RBAC denial accuracy from audit logs', accept:'Negative access control tests (horizontal + vertical + cross-tenant)', priority:'Must', rfp:'-03',
    detail:'Three-layer authorization: (1) APIM: scope/role/acr from JWT, (2) Facade: resource ownership ABAC (callerSubjectId matches resourceOwnerId), (3) Controller: business authorization (edit own draft only). 0 false grants measured by: horizontal privilege escalation tests, vertical escalation tests, cross-tenant access tests — all must return 403.',
    enabler:'Claims Mapper JWT enrichment + Facade ABAC middleware + Controller authorization policy', us:['US-7'] },
  { id:'NFR-12', cat:'Interop', req:'No point-to-point integrations', target:'100% via APIM/Facade', metric:'Network topology audit + architectural review', accept:'Network scan shows no direct service→registry calls bypassing APIM', priority:'Should', rfp:'-04',
    detail:'All external data access flows through APIM → Facade → Orchestrator → Adapter. No adapter has a direct inbound connection from Portal or any consumer. No direct database queries from Portal. Verified via network topology scan (NSG rules, Private Endpoint configuration) and code review.',
    enabler:'VNet segmentation + Private Endpoints + NSG deny-by-default + mandatory APIM authentication', us:['US-8'] },
  { id:'NFR-13', cat:'Observability', req:'corrId + traceparent propagated 100%', target:'100% of spans have corrId + traceparent', metric:'OTel span linkage ratio in App Insights', accept:'Trace sampling audit: sample 1000 traces — count those missing corrId or traceparent', priority:'Should', rfp:'-09',
    detail:'APIM injects x-correlation-id (UUID v4) if absent. W3C traceparent propagated as HTTP header and as message attribute in Service Bus / Event Grid. OTel Collector validates propagation; alert if missing rate > 1%. Queue messages without traceparent get synthetic root span from Collector.',
    enabler:'APIM correlation-id policy + OTel SDK auto-instrumentation + Collector validation rules', us:['US-27'] },
  { id:'NFR-14', cat:'Error semantics', req:'problem+json for all API faults', target:'100% of API faults return application/problem+json', metric:'Content-type header + RFC 7807 field presence checks', accept:'Contract tests: every 4xx/5xx response checked for proper problem+json structure', priority:'Must', rfp:'-04, -09',
    detail:'All Facade-level and below error responses must conform to RFC 7807 application/problem+json with fields: type (URI), title, status, detail, instance (corrId), and optionally extensions (problemCode, retryAfter). No raw stack traces. Verified via contract test suite run in CI.',
    enabler:'Facade error handling middleware + controller exception mapper + problem+json serializer', us:['US-8'] },
  { id:'NFR-15', cat:'Idempotency', req:'Mutating APIs honour Idempotency-Key', target:'100% of POST/PUT honour the key', metric:'Idempotency ledger hit vs repeat outcome', accept:'Replay tests: send same request with same key twice; second must return first response without side effects', priority:'Must', rfp:'-08',
    detail:'Idempotency-Key (UUID) required for: POST /applications, POST /esign/packages, POST /payments/sessions, POST /drafts. Ledger in ODS stores: key, requestHash, responseStatus, responseBody (compressed), createdAt (TTL 24h). On key match: return stored response without re-executing. On body mismatch: 422 idempotency_key_reuse.',
    enabler:'Facade idempotency-key middleware + ODS ledger table + key TTL management', us:['US-2','US-4','US-24'] },
  { id:'NFR-16', cat:'Cache', req:'MDM cache hit-rate for prefill', target:'≥ 80%', metric:'Redis cache hit counter / total prefill requests', accept:'Load + warmup test: 1000 requests after warm-up; measure hit-rate', priority:'Should', rfp:'-05',
    detail:'Hit-rate measured per 24h rolling window. Warmup: on first prefill for each NID, cache populated; subsequent requests within TTL hit. TTL varies by data type (address: 24h, business: 4h, civil status: 48h). Event-driven invalidation maintains freshness. Alert if 24h rolling hit-rate < 75%.',
    enabler:'Redis Enterprise MDM cache + ETag/TTL policy + event-driven invalidation', us:['US-1','US-28','US-5','US-29'] },
  { id:'NFR-17', cat:'Content safety', req:'AV/MIME scan 100% of uploads', target:'100%', metric:'Document intake audit log: scanned=true before status→Ready', accept:'EICAR test file upload → must be Rejected. MIME spoof (PDF with ZIP magic bytes) → must be Rejected.', priority:'Must', rfp:'-07',
    detail:'AV scan triggered synchronously on Blob upload via Azure Event Grid blob_created event → scan function. MIME magic byte check compares declared Content-Type vs actual file header. Results: Ready (clean + MIME match), Rejected (malware or MIME spoof). Scan timeout 90s → DLQ + manual quarantine.',
    enabler:'Document Intake service + Azure Blob Event Grid trigger + AV scan integration + EICAR CI test', us:['US-3','US-18'] },
  { id:'NFR-18', cat:'Webhooks', req:'Signature verification + replay guard', target:'100%', metric:'webhook_verify_outcome metric (pass/fail/replay)', accept:'Invalid signature → 400 reject. Duplicate nonce → 200 idempotent. Clock skew > ±5min → 400.', priority:'Must', rfp:'-07, -03',
    detail:'Verification: (1) JWS/HMAC-SHA256 signature over payload using Key Vault secret, (2) timestamp within ±5min (clock skew tolerance), (3) nonce not in Redis nonce store (TTL 10min). On any failure: 400 + DLQ park for SOC review. On nonce reuse: 200 idempotent + metric increment. P95 verification < 50ms (Redis lookup).',
    enabler:'Facade webhook verifier + Redis nonce store + Key Vault signing secrets + APIM IP allowlist', us:['US-4','US-21','US-22'] },
  { id:'NFR-19', cat:'Accessibility', req:'WCAG 2.1 AA conformance', target:'Conformant', metric:'Axe automated scan + manual audit', accept:'Third-party accessibility audit report; no Critical/High issues', priority:'Should', rfp:'-01',
    detail:'WCAG 2.1 AA covers 4 principles: Perceivable (alt text, captions, contrast ≥ 4.5:1), Operable (keyboard nav, no traps, skip links), Understandable (error identification, lang attribute), Robust (valid HTML, ARIA roles). Axe CI gate: 0 critical violations. Manual test: NVDA + JAWS + VoiceOver on key journeys.',
    enabler:'React/HTML accessible component library + Axe CI gate + schema-driven form renderer', us:['US-13'] },
  { id:'NFR-20', cat:'Localization', req:'EN/NL full parity', target:'100% strings', metric:'i18n coverage report (missing key count)', accept:'i18n lint in CI: 0 missing keys. Manual review of NL translations by native speaker.', priority:'Should', rfp:'-01',
    detail:'All user-facing strings externalised in JSON locale files (en.json, nl.json). i18n lint runs in CI: fails if NL file is missing any key present in EN file. Date, number, currency formatting via Intl API with locale context. Content team owns translations; engineering owns technical string keys.',
    enabler:'i18n framework (react-i18next) + schema-driven form labels + CI lint gate', us:['US-13'] },
  { id:'NFR-21', cat:'Data', req:'Retention & legal holds', target:'Per §8.8 schedule', metric:'Purview retention policies + WORM lock verification', accept:'Policy test: drafts > 180d auto-deleted; consent records 7y; audit 7-10y; logs 90-180d', priority:'Must', rfp:'-05, -12',
    detail:'Retention schedule: Drafts 180d (soft delete then purge), Consent records 7y (WORM), Audit/WORM receipts 7-10y (WORM legal hold available), Application logs 90d (Log Analytics), Security logs 180d (Sentinel), MDM cache TTL per data type. Purview DLP policies enforce classification and access. Legal hold API available for litigation support.',
    enabler:'Blob WORM immutability + Purview retention policies + ODS soft-delete + Log Analytics workspace retention', us:['US-21'] },
  { id:'NFR-22', cat:'Compliance', req:'Secure SDLC & SBOM', target:'In place and evidenced', metric:'CI pipeline evidence: CodeQL scan, SBOM artifact, signed image, Trivy scan', accept:'Release gate review: all CI artifacts present; no Critical findings open', priority:'Should', rfp:'-03, -09',
    detail:'SDLC controls: CodeQL SAST on every PR (Critical/High = CI fail), CycloneDX SBOM generated per build, Trivy container scan (Critical CVE = CI fail), cosign image signing with Sigstore, Dependabot weekly dependency updates, no-secrets pre-commit hook + CI scanner, pen-test pre-go-live and annually.',
    enabler:'GitHub Actions/Azure DevOps pipeline + CodeQL + Trivy + cosign + Dependabot + SBOM Action', us:['US-26'] },
  { id:'NFR-23', cat:'Throughput', req:'Gateway sustained RPS', target:'≥ 600 RPS sustained', metric:'APIM requests/second metrics at P95 latency in-SLO', accept:'Load ramp test: ramp to 800 RPS; verify P95 latency stays within SLO for 30min', priority:'Must', rfp:'-04',
    detail:'APIM Premium units sized for 600 RPS sustained + 20% headroom = 720 RPS capacity at baseline. Each unit handles ~1k RPS simple JWT validate + route. Load test must sustain 600 RPS for 30min with no SLO breach. Autoscale adds units when CPU > 70% or RPS > threshold.',
    enabler:'APIM Premium with multiple units + autoscale policy + Front Door global distribution', us:['US-8'] },
  { id:'NFR-24', cat:'Queueing', req:'Service Bus message lag P95', target:'< 2s', metric:'Service Bus: oldest_message_age_seconds P95', accept:'Soak test: sustained 600 RPS for 1h; verify queue lag stays < 2s', priority:'Must', rfp:'-08',
    detail:'Service Bus Premium with partitioned topics for parallelism. KEDA scales consumers on queue depth: scale trigger = 10 messages → add replica. Scale-to-zero when idle. Lag alert: P95 > 10s = PagerDuty. Lag > 4h in DLQ = PagerDuty. Throughput units auto-scale on Server Busy (429) responses.',
    enabler:'Service Bus Premium + KEDA queue-depth autoscale + partitioned topics + TU autoscale', us:['US-9','US-37'] },
  { id:'NFR-25', cat:'Data integrity', req:'ETag prevents lost updates', target:'100% conditional ops honoured', metric:'412_rate when ETag mismatched / total conditional updates', accept:'Concurrency tests: 2 concurrent updates with same ETag → exactly 1 succeeds, 1 gets 412', priority:'Should', rfp:'-05',
    detail:'Conditional update flow: GET /drafts/{id} returns ETag header → PUT /drafts/{id} with If-Match: {etag} → ODS checks: SELECT FOR UPDATE WHERE etag = ? → if mismatch: 412 Precondition Failed → client must GET fresh state. Same pattern for MDM cache snapshots. 0% ETag bypass.',
    enabler:'ODS conditional update query (SELECT FOR UPDATE + etag column) + Facade If-Match enforcement', us:['US-5','US-12','US-29'] },
  { id:'NFR-26', cat:'Cost', req:'Autoscale + budgets within plan', target:'≤ planned monthly budget', metric:'Azure Cost Management: actual vs planned by service tag', accept:'Monthly FinOps review; alert on >110% of budget', priority:'Could', rfp:'-09',
    detail:'Cost controls: non-Prod environments scaled to business hours (scale-to-zero off-hours), budget alerts at 80% and 100% of monthly envelope, Azure Policy enforces resource tags (costCenter, env, service), Power BI FinOps dashboard tracks per-service spend, commitment discounts on compute.',
    enabler:'KEDA scale-to-zero + budget alerts + Azure Policy tag enforcement + reserved instances', us:[] },
  { id:'NFR-27', cat:'Browser support', req:'Evergreen + LTS browsers', target:'Edge/Chrome/Firefox/Safari latest + n-1', metric:'Browser compatibility matrix from Playwright CI', accept:'UI regression suite on all 4 browsers', priority:'Must', rfp:'-01',
    detail:'Playwright E2E runs against: Chrome latest + n-1, Firefox latest + n-1, Edge latest, Safari/WebKit latest. Mobile: iOS Safari + Android Chrome. Test suite covers key journeys (auth, prefill, submit). CI fails on any Critical visual or functional regression.',
    enabler:'Playwright multi-browser CI matrix + BrowserStack for physical device testing', us:['US-13'] },
  { id:'NFR-28', cat:'Mobile', req:'PWA performance', target:'Lighthouse PWA score ≥ 90', metric:'Lighthouse CI score', accept:'CI gate: Lighthouse PWA ≥ 90 on mobile profile', priority:'Should', rfp:'-01',
    detail:'Portal built as Progressive Web App: service worker for offline form saving, manifest for home screen install, HTTPS-only, responsive layout, ARIA-compliant, performance budget: FCP < 2s, TTI < 3.5s on 4G mobile. Lighthouse CI runs on every PR targeting main.',
    enabler:'React PWA template + Workbox service worker + responsive CSS + Lighthouse CI GitHub Action', us:['US-13'] },
  { id:'NFR-29', cat:'Maintainability', req:'Lead time: code to production', target:'< 1 day (business hours)', metric:'DORA metric: commit timestamp to prod deploy timestamp', accept:'Pipeline report: median lead time tracked in DORA dashboard', priority:'Should', rfp:'-09',
    detail:'Enabled by: automated CI/CD pipeline (build + test + scan + sign = < 20min), automated Dev/Int/Perf deployment, Stage manual approval (< 2h on business day), Prod canary rollout (< 2h). Total target: commit 09:00 → Prod 17:00. DORA dashboard in Power BI with 30-day rolling average.',
    enabler:'Fully automated pipeline + small PRs policy + blue/green zero-downtime deploy', us:[] },
  { id:'NFR-30', cat:'Supportability', req:'MTTR P1 incident containment', target:'≤ 30 min', metric:'Incident timeline: detection to containment timestamp', accept:'On-call drill; post-incident review confirms ≤ 30min containment', priority:'Must', rfp:'-09',
    detail:'P1 = platform down or data breach. Response: Sentinel alert → PagerDuty page on-call within 2min → on-call joins bridge within 5min → runbook-guided containment (APIM route flip, kill switch, IP block) within 30min. SOAR playbooks auto-contain IP-based attacks immediately.',
    enabler:'Sentinel SOAR playbooks + runbooks + on-call rotation + PagerDuty escalation policies', us:['US-26'] }
];

const PRIORITY_ORDER = { Must: 0, Should: 1, Could: 2 };
const CAT_COLORS = {
  Performance:'#3b82f6', Availability:'#22c55e', Reliability:'#f59e0b',
  Security:'#ef4444', Privacy:'#ec4899', DR:'#8b5cf6',
  Observability:'#06b6d4', Data:'#16a34a', Authorization:'#dc2626',
  Interop:'#f97316', Throughput:'#3b82f6', Queueing:'#f59e0b',
  Idempotency:'#8b5cf6', Cache:'#06b6d4', Scalability:'#3b82f6',
  'Content safety':'#ef4444', Webhooks:'#ec4899', Accessibility:'#22c55e',
  Localization:'#06b6d4', Compliance:'#f97316', Maintainability:'#8b5cf6',
  Cost:'#22c55e', 'Browser support':'#3b82f6', Mobile:'#f97316', Supportability:'#ef4444',
  'Error semantics':'#8b5cf6'
};

function buildNFRMatrix() {
  const tbody = document.getElementById('nfr-tbody');
  const detail = document.getElementById('nfr-detail');
  const filters = document.querySelectorAll('[data-nfr-cat]');
  if (!tbody) return;

  function renderRows(catFilter) {
    tbody.innerHTML = '';
    const filtered = catFilter === 'ALL' ? NFRS : NFRS.filter(n => n.cat === catFilter);
    filtered.forEach(nfr => {
      const pClass = nfr.priority === 'Must' ? 'must-badge' : nfr.priority === 'Should' ? 'should-badge' : 'could-badge';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><div class="nfr-cell" data-nfr="${nfr.id}">
          <div class="nfr-id">${nfr.id}</div>
          <span class="nfr-cat-badge ${pClass}">${nfr.priority}</span>
        </div></td>
        <td><div class="nfr-cell" data-nfr="${nfr.id}">
          <span style="font-size:.68rem;padding:2px 6px;border-radius:3px;background:${hexA4(CAT_COLORS[nfr.cat]||'#888',0.1)};color:${CAT_COLORS[nfr.cat]||'#888'};border:1px solid ${hexA4(CAT_COLORS[nfr.cat]||'#888',0.25)};font-weight:600">${nfr.cat}</span>
        </div></td>
        <td><div class="nfr-cell" data-nfr="${nfr.id}"><div style="font-size:.74rem;color:var(--text-1);font-weight:500">${nfr.req}</div></div></td>
        <td><div class="nfr-cell" data-nfr="${nfr.id}"><div class="nfr-target">${nfr.target}</div></div></td>
        <td><div class="nfr-cell" data-nfr="${nfr.id}"><div class="nfr-metric">${nfr.metric}</div></div></td>
        <td><div class="nfr-cell" data-nfr="${nfr.id}"><div class="nfr-accept">${nfr.accept}</div></div></td>
        <td><div class="nfr-cell" data-nfr="${nfr.id}"><span class="nfr-cat-badge ${pClass}">${nfr.priority}</span></div></td>
        <td><div class="nfr-cell" data-nfr="${nfr.id}"><div class="nfr-rfp-cell">${nfr.rfp}</div></div></td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.nfr-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        tbody.querySelectorAll('.nfr-cell').forEach(c => c.classList.remove('active'));
        tbody.querySelectorAll(`[data-nfr="${cell.dataset.nfr}"]`).forEach(c => c.classList.add('active'));
        const nfr = NFRS.find(n => n.id === cell.dataset.nfr);
        if (nfr) renderNFRDetail(nfr, detail);
      });
    });
  }

  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      filters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRows(btn.dataset.nfrCat);
    });
  });

  renderRows('ALL');
}

function renderNFRDetail(nfr, wrap) {
  const pClass = nfr.priority === 'Must' ? 'must-badge' : nfr.priority === 'Should' ? 'should-badge' : 'could-badge';
  const cc = CAT_COLORS[nfr.cat] || '#888';
  wrap.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
      <div>
        <div style="font-family:var(--font-mono);font-size:.65rem;color:var(--text-3)">${nfr.id}</div>
        <div style="font-size:.88rem;font-weight:700;color:var(--text-1);margin:4px 0">${nfr.req}</div>
        <span style="font-size:.65rem;padding:2px 8px;border-radius:3px;background:${hexA4(cc,0.1)};color:${cc};border:1px solid ${hexA4(cc,0.3)};font-weight:700">${nfr.cat}</span>
      </div>
      <span class="nfr-cat-badge ${pClass}" style="font-size:.65rem;padding:3px 10px">${nfr.priority}</span>
    </div>
    <div style="background:var(--bg-elevated);border-left:3px solid ${cc};padding:10px 12px;border-radius:0 var(--r-md) var(--r-md) 0;margin-bottom:12px">
      <div style="font-family:var(--font-mono);font-size:.72rem;font-weight:700;color:var(--text-1);margin-bottom:4px">Target: ${nfr.target}</div>
    </div>
    <div style="font-size:.75rem;color:var(--text-2);line-height:1.7;margin-bottom:12px">${nfr.detail}</div>
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">How Measured</div>
    <div style="font-size:.74rem;color:var(--text-2);margin-bottom:10px">${nfr.metric}</div>
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">Acceptance Test</div>
    <div style="font-size:.74rem;color:var(--text-2);margin-bottom:10px;font-style:italic">${nfr.accept}</div>
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">Design Enabler</div>
    <div style="font-size:.74rem;color:var(--text-2);margin-bottom:12px">${nfr.enabler}</div>
    ${nfr.us?.length ? `<div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px">Related User Stories</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">${nfr.us.map(u=>`<span style="font-family:var(--font-mono);font-size:.62rem;padding:2px 7px;border-radius:3px;background:var(--orange-50);border:1px solid rgba(234,88,12,.2);color:var(--accent-dk)">${u}</span>`).join('')}</div>` : ''}
    <div style="margin-top:10px;font-family:var(--font-mono);font-size:.62rem;color:var(--accent-dk)">RFP: ${nfr.rfp}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// DELIVERY PIPELINE
// ══════════════════════════════════════════════════════════════════════════════
const PIPE_STAGES = [
  { id:'DEV', label:'Dev Branch / PR', sub:'GitHub/ADO', color:'#3b82f6', icon:'🌿',
    what:'Developer opens short-lived feature branch. Small PRs ≤ 400 lines of diff. Pre-commit hooks block secrets and run fast linting. PR required reviews: 1 peer + 1 lead.',
    inputs:['Feature branch from trunk (main)', 'Linked issue/ticket (JIRA/ADO)', 'Conventional commit message format'],
    checks:['Pre-commit: no-secrets scanner (detect-secrets)', 'Pre-commit: ESLint / Python flake8 / Go vet', 'Conventional commit lint', 'PR template filled (description, test coverage, rollback plan)'],
    outputs:['PR opened → triggers CI pipeline automatically'],
    gates:['1 peer review approval', '1 tech-lead approval for API contract changes'],
    rfp:['-04','-09'] },
  { id:'CI', label:'Build & Unit Test', sub:'GitHub Actions / Azure DevOps', color:'#3b82f6', icon:'🔨',
    what:'Compile source code, run unit tests, generate test coverage report. Fail fast on compile errors or test failures. Target: CI pipeline completes in < 10 minutes.',
    inputs:['Source code from PR branch', 'Dependency lock files (package-lock.json, go.sum, requirements.txt)'],
    checks:['Compile / transpile (TypeScript → JS, Java Maven, Go build)', 'Unit tests (Jest / JUnit / Go test) — coverage gate ≥ 80%', 'Contract tests (Pact) for Facade API contracts and Adapter contracts', 'Mutation test (optional): verify tests catch code changes'],
    outputs:['Test report artifact', 'Coverage report (Codecov)', 'Build artifacts ready for image build'],
    gates:['Unit tests: 0 failures', 'Coverage: ≥ 80% line coverage', 'Contract tests: all Pact contracts verified'],
    rfp:['-04','-09'] },
  { id:'SAST', label:'SAST / Security Scan', sub:'CodeQL + Dependabot + Checkov', color:'#ef4444', icon:'🔍',
    what:'Static analysis security testing across three dimensions: application code (CodeQL), dependencies (Dependabot), and infrastructure-as-code (Checkov/Conftest). This is the security gate — Critical/High findings block the pipeline.',
    inputs:['Source code', 'Dependency manifests (package.json, pom.xml, go.mod)', 'Bicep/Terraform IaC files'],
    checks:['CodeQL SAST: SQL injection, XSS, path traversal, insecure crypto, hardcoded secrets — 50+ query packs', 'Dependabot: known CVEs in dependencies — Critical/High block release', 'Checkov: IaC misconfiguration (public storage, no encryption, missing NSG rules)', 'Conftest/OPA: custom policy-as-code rules (e.g., no public endpoints, mandatory tags)', 'SBOM generation: CycloneDX format, all transitive dependencies catalogued'],
    outputs:['CodeQL SARIF report (uploaded to GitHub Security tab)', 'SBOM artifact (CycloneDX JSON)', 'Dependabot advisory list', 'IaC scan HTML report'],
    gates:['CodeQL: 0 Critical, 0 High (or approved waiver with remediation date)', 'Dependabot: 0 Critical CVEs unresolved', 'Checkov: 0 Critical IaC misconfigs'],
    rfp:['-03','-09'] },
  { id:'IMG', label:'Build OCI Image + SBOM', sub:'Docker / Buildah', color:'#f97316', icon:'📦',
    what:'Build a minimal, hardened OCI container image. Use multi-stage builds to reduce attack surface. Pin base image to digest (not tag) for reproducibility. Embed SBOM into image annotation.',
    inputs:['Application build artifacts', 'Dockerfile with multi-stage build (build → distroless runtime)', 'Base image pinned by SHA-256 digest (e.g., gcr.io/distroless/java17@sha256:…)'],
    checks:['Multi-stage build: build stage (full SDK) → runtime stage (distroless, no shell)', 'Non-root user in runtime stage (USER 1001:1001)', 'No unnecessary packages or tools in runtime image', 'SBOM embedded in image OCI annotation (org.opencontainers.image.sbom)', 'Image labels: version, commit SHA, build date, maintainer'],
    outputs:['OCI image tar (local)', 'Embedded SBOM annotation', 'Build metadata JSON (version, commit, timestamp)'],
    gates:['Image build completes without error', 'SBOM annotation present', 'Non-root user configured'],
    rfp:['-03'] },
  { id:'SCAN', label:'Image Scan + Sign (cosign)', sub:'Trivy + cosign + Sigstore', color:'#ef4444', icon:'🔐',
    what:'Scan the built container image for known CVEs using Trivy. Sign the image with cosign using Sigstore keyless signing (OIDC-backed ephemeral keys). Signature stored in OCI registry alongside image.',
    inputs:['OCI image tar from build stage', 'CI OIDC token (GitHub Actions / Azure DevOps) for keyless signing'],
    checks:['Trivy scan: OS packages + application dependencies in image → Critical/High = CI fail', 'cosign sign: keyless signing using OIDC token → signature pushed to registry', 'cosign verify: verify signature is present and valid before push', 'Attestation: CycloneDX SBOM attested as OCI attestation object'],
    outputs:['Trivy SARIF report', 'cosign signature (OCI artifact in registry)', 'SBOM attestation (OCI attestation in registry)', 'Image ready for push to ACR'],
    gates:['Trivy: 0 Critical CVEs unpatched', 'cosign signature: verified before push', 'SBOM attestation: present'],
    rfp:['-03','-09'] },
  { id:'ACR', label:'Push to ACR', sub:'Azure Container Registry (GeoReplicated)', color:'#f97316', icon:'📤',
    what:'Push signed image and attestations to Azure Container Registry. Image tagged immutably with semantic version + Git commit SHA. ACR geo-replicated to Region A and Region B for DR.',
    inputs:['Signed OCI image', 'cosign signature artifact', 'SBOM attestation artifact'],
    checks:['ACR push: image tagged as app:X.Y.Z-{gitsha} (immutable tag — no mutable :latest in prod path)', 'ACR geo-replication: image replicated to Region B ACR before deploy', 'ACR Content Trust: verify signature policy enforced at registry level', 'Quarantine policy: new images held in quarantine until all security gates pass'],
    outputs:['Immutable image reference: app:X.Y.Z@sha256:…', 'Registry metadata (push time, digest, signature reference)'],
    gates:['Push success', 'Image available in both Region A and B ACR', 'Signature verification at ACR level'],
    rfp:['-03','-11'] },
  { id:'DEVDEP', label:'Deploy Dev/Int via IaC', sub:'Bicep/Terraform + Container Apps', color:'#22c55e', icon:'🚀',
    what:'Automated deployment to Dev and Int environments using IaC (Bicep/Terraform). Container Apps updated via rolling deploy. Dev deploy auto-triggers on merge to main. Int deploy auto-triggers after Dev health probes green.',
    inputs:['Immutable image reference from ACR', 'Bicep/Terraform manifests from repo', 'Environment-specific Key Vault reference for secrets', 'APIM policy files versioned in repo'],
    checks:['Bicep what-if diff shown in PR comment (no surprise infrastructure changes)', 'Container Apps rolling deploy (zero downtime): new revision deployed → health probes checked → traffic shifted → old revision scaled to 0', 'IaC drift detection: alert if live infra differs from repo state', 'Smoke test: hit /healthz on all services after deploy'],
    outputs:['Container Apps revision deployed to Dev', 'IaC state updated in Terraform remote state', 'Deployment manifest (image digest, revision ID, timestamp)'],
    gates:['Health probe /healthz returns 200 on all services', 'Smoke test: auth → prefill → health check passes'],
    rfp:['-04','-09','-11'] },
  { id:'E2E', label:'E2E & Contract Tests (Int)', sub:'Playwright + Pact', color:'#22c55e', icon:'🧪',
    what:'Full end-to-end test suite run against the Int environment with stub/mock registry adapters. Covers US-1 through US-6 happy and unhappy paths. Contract tests verify Facade API contracts match consumer expectations.',
    inputs:['Int environment URL', 'Pact broker (consumer contract expectations)', 'Synthetic test user credentials (no real PII)', 'Mock registry adapter stubs (returning synthetic canonical DTOs)'],
    checks:['Playwright E2E: US-1 prefill (cache hit + miss), US-2 submit flow, US-3 doc upload, US-4 webhook, US-5 invalidation, US-6 notification', 'Pact provider verification: Facade publishes provider verification results to Pact Broker', 'Accessibility check: Axe assertions in Playwright tests', 'Correlation ID check: every API call has corrId + traceparent in response headers'],
    outputs:['E2E test report (pass/fail per scenario)', 'Pact broker: provider verification published', 'Axe accessibility report', 'Video recordings of failed tests'],
    gates:['E2E: 0 test failures on critical paths (US-1, US-2, US-24)', 'Pact: all provider verifications pass', 'Axe: 0 critical accessibility violations'],
    rfp:['-01','-04','-09'] },
  { id:'PERF', label:'Perf / Chaos Tests', sub:'k6 + Gatling + chaos-monkey', color:'#f59e0b', icon:'⚡',
    what:'Performance and chaos testing in the dedicated Perf environment with synthetic data at scale. Verify P95 latency SLOs under realistic load. Inject faults to verify resilience patterns (circuit breaker, retry, DLQ, partial degrade).',
    inputs:['Perf environment URL', 'k6 / Gatling load test scripts (calibrated to 600-800 RPS)', 'Chaos experiment scripts (fault injection: 5xx, timeout, DNS break, queue fill, Redis evict)'],
    checks:['Load ramp: 0 → 300 → 600 → 800 RPS; sustain 600 RPS for 30min', 'NFR-01 verify: prefill cache hit P95 ≤ 600ms at 600 RPS', 'NFR-06 verify: inject 20% 5xx → retry success ≥ 95%', 'Chaos: kill one Civil adapter → circuit breaker opens → partial bundle returned', 'Chaos: fill Service Bus queue → 429 backpressure → autoscale consumers → lag recovers < 10s', 'Chaos: evict Redis → degrade to direct fetch → latency increases but requests succeed'],
    outputs:['k6 / Gatling HTML report with P50/P95/P99 charts', 'Chaos experiment outcomes (pass/fail per scenario)', 'App Insights performance dashboard screenshot (PDF)', 'SLO breach count = 0 (required for gate)'],
    gates:['NFR-01: P95 ≤ 600ms at sustained 600 RPS', 'NFR-06: retry success ≥ 95% under 20% fault injection', 'NFR-24: queue lag P95 < 2s', 'All chaos scenarios: graceful degrade confirmed (no 500 on total failure)'],
    rfp:['-08','-09'] },
  { id:'STAGE', label:'Deploy Stage (Blue/Green)', sub:'Blue/Green + UAT + Pen-test', color:'#8b5cf6', icon:'🔵',
    what:'Deploy new version to Stage Green slot behind APIM. Run UAT with business stakeholders using masked production data subset. Conduct DAST (OWASP ZAP) pen-test. Security Lead reviews before promotion approval.',
    inputs:['Signed image from ACR', 'Masked prod data subset (via Fabric anonymisation pipeline)', 'UAT test scripts (business scenarios)', 'ZAP DAST scan configuration'],
    checks:['Blue/Green: deploy Green slot → Container Apps traffic split: Green 0% initially', 'APIM canary: x-api-canary: true header routes subset of traffic to Green', 'DAST (OWASP ZAP): full scan against Stage Green → OWASP Top 10 + header checks + CORS', 'UAT: Business PO signs off each scenario (prefill, eligibility, docs, eSign, pay, submit, case)', 'SLO soak: 7 days of steady traffic on Stage → SLO dashboards green'],
    outputs:['ZAP DAST report', 'UAT sign-off sheets per scenario', 'Stage SLO dashboard (7-day report)', 'Security Lead sign-off email/ticket'],
    gates:['DAST: 0 Critical/High security findings open', 'UAT: Business PO sign-off on all priority-1 scenarios', 'SLO green for 7 days on Stage', 'Security Lead approval for API/security-critical changes'],
    rfp:['-03','-09'] },
  { id:'CANARY', label:'Canary 5% → 100%', sub:'APIM routing + Front Door weights', color:'#f97316', icon:'🐤',
    what:'Graduated production rollout: route increasing % of real traffic to Green slot while monitoring SLO dashboards. Automatic rollback trigger if error rate spikes.',
    inputs:['Stage-approved Green slot', 'APIM product canary routing configuration', 'SLO burn-rate alert thresholds'],
    checks:['5% canary: route 5% via APIM header/Front Door weight for 30min → SLO green', '25% canary: increase to 25% for 1h → SLO green', '50% canary: increase to 50% for 1h → SLO green', '100% flip: shift all traffic to Green → decommission Blue (kept 48h hot rollback)', 'Auto-rollback trigger: if P95 latency > SLO × 1.5 OR error rate > baseline × 2 → APIM flip to Blue automatically'],
    outputs:['Canary health dashboard (live SLO per slot)', 'Rollout event timeline', 'Final prod deployment manifest'],
    gates:['SLO green at each canary step', 'Error rate within baseline', 'No P1 incidents during rollout'],
    rfp:['-09','-04'] },
  { id:'GATE', label:'Security & SLO Gates + CAB', sub:'Automated + manual approval', color:'#ef4444', icon:'🚦',
    what:'Final quality and security gate before production promotion. Aggregates all automated evidence and requires human approval from: Product Owner, Platform SRE, and Security Lead for major changes.',
    inputs:['All CI/CD artifact evidence: CodeQL report, SBOM, Trivy report, cosign signature, ZAP report, perf report', 'UAT sign-off', 'SLO dashboard (Stage green 7 days)'],
    checks:['Evidence checklist: all required artifacts present and passing', 'Change Advisory Board (CAB) ticket approved for major / schema / DR changes', 'Product Owner approval', 'Platform SRE approval', 'Security Lead approval (pen-test for major changes)', 'Rollback plan documented and tested in Stage'],
    outputs:['Release approval record (immutable, linked to pipeline run)', 'CAB approval reference', 'Release notes published to confluence'],
    gates:['All automated gate checks green', 'CAB approval (if required)', 'Three-party approval: PO + SRE + Security Lead'],
    rfp:['-03','-09'] },
  { id:'PROD', label:'Prod Green Rollout', sub:'Live traffic — Region A primary', color:'#22c55e', icon:'✅',
    what:'Final production deployment. Traffic shifted to Green via canary steps. SLO dashboards monitored on big screen during rollout. Blue slot kept as hot rollback for 48 hours.',
    inputs:['CAB-approved image reference', 'Prod environment Key Vault configuration', 'On-call SRE on bridge during rollout'],
    checks:['Deploy Green slot in Prod Container Apps environment', 'Synthetic smoke tests: auth → prefill → submit dry-run from 3 regions', 'SLO dashboards: P95, error rate, queue lag all green for 10min post-flip', 'DR standby: Region B Container Apps updated with same image in parallel'],
    outputs:['Production deployment manifest (version, digest, timestamp, approver)', 'Post-deployment SLO screenshot', 'Release tag in Git repository'],
    gates:['Synthetic smoke tests all pass', 'SLO green 10min post-deploy', 'Region B updated'],
    rfp:['-04','-09','-11'] },
  { id:'ROLLBACK', label:'Health Check', sub:'Auto-rollback decision', color:'#f59e0b', icon:'🩺',
    what:'Automated health check immediately post-deploy. If any SLO breach detected within the observation window, automatic rollback to Blue slot via APIM route flip. Zero manual intervention required for rollback.',
    inputs:['App Insights real-time metrics feed', 'SLO thresholds configured in alerting rules', 'APIM canary routing configuration (Blue slot kept ready)'],
    checks:['P95 latency: within SLO × 1.2 tolerance for 10min', 'Error rate: not more than 2× baseline for 5min', 'Availability probe: synthetic tests all passing', 'Queue lag: P95 < 10s'],
    outputs:['Health check outcome: PASS or FAIL', 'If FAIL: automatic APIM route flip to Blue + PagerDuty alert + incident opened'],
    gates:['All health metrics within tolerance for 10min observation window'],
    rfp:['-09'] },
  { id:'FLIP', label:'Rollback to Blue', sub:'Emergency: APIM route flip', color:'#ef4444', icon:'🔄',
    what:'If health check fails (or manual decision): instant rollback by flipping APIM route back to Blue slot. Blue slot kept warm for 48h after each deploy specifically for this case. Database changes must be backward-compatible to allow rollback.',
    inputs:['APIM routing configuration', 'Blue slot (previous version, still running)', 'Incident ticket opened'],
    checks:['APIM canary weight: Green → 0%, Blue → 100% (< 30 seconds to complete)', 'Verify Blue slot health probes green', 'SLO recovery confirmed: error rate returns to baseline', 'Root cause investigation opened', 'Database rollback: expand-migrate-contract pattern ensures v-1 schema is still compatible'],
    outputs:['Rollback manifest (time, trigger reason, approver)', 'Incident post-mortem template created', 'Pipeline blocked for root-cause fix'],
    gates:['Blue slot responding within 2min of flip', 'SLO green within 5min of flip'],
    rfp:['-09','-11'] },
  { id:'CLOSE', label:'Close Release & Tag', sub:'Git tag + release notes', color:'#22c55e', icon:'🏷',
    what:'Formal closure of the release: Git tag, release notes, evidence archive, pipeline run record linked to deployment. Hypercare period begins (2-4 weeks post-go-live for major releases).',
    inputs:['Successful deployment manifest', 'All CI/CD evidence artifacts', 'Post-deploy SLO screenshots'],
    checks:['Git tag: v{major}.{minor}.{patch} + annotation with release summary', 'Release notes: changes, known issues, rollback procedure', 'Evidence archive: CodeQL, SBOM, Trivy, ZAP, perf report, UAT sign-off stored immutably', 'DORA metrics updated: lead time, deployment frequency, change fail rate', 'Hypercare: elevated on-call, daily war room for major releases'],
    outputs:['Git tag with signed annotation (gpg/cosign)', 'Release notes document', 'Evidence archive in WORM-equivalent storage', 'DORA dashboard updated'],
    gates:['Git tag pushed', 'Evidence archive complete', 'DORA metrics recorded'],
    rfp:['-09'] }
];

function buildPipeline() {
  const wrap = document.getElementById('pipeline-diagram');
  const detail = document.getElementById('pipe-detail');
  if (!wrap) return;

  const row = document.createElement('div');
  row.className = 'pipeline-row';
  row.style.cssText = 'display:flex;align-items:center;flex-wrap:nowrap;gap:0;overflow-x:auto;padding:10px 0 20px';

  PIPE_STAGES.forEach((stage, i) => {
    const stageWrap = document.createElement('div');
    stageWrap.style.cssText = 'display:flex;align-items:center;gap:0';

    const node = document.createElement('div');
    node.className = 'pipe-node';
    node.style.cssText = `background:${hexA4(stage.color,0.08)};border-color:${hexA4(stage.color,0.4)};min-width:90px;max-width:110px`;
    node.innerHTML = `<div style="font-size:.9rem;margin-bottom:4px">${stage.icon}</div><div class="pipe-node-label" style="color:${stage.color}">${stage.label}</div><div class="pipe-node-sub" style="color:${stage.color}">${stage.sub}</div>`;
    node.addEventListener('click', () => {
      wrap.querySelectorAll('.pipe-node').forEach(n => n.classList.remove('active'));
      node.classList.add('active');
      renderPipeDetail(stage, detail);
      detail.style.display = 'block';
      detail.scrollIntoView({ behavior:'smooth', block:'nearest' });
    });
    stageWrap.appendChild(node);

    if (i < PIPE_STAGES.length - 1) {
      const arrColor = stage.id === 'ROLLBACK' && PIPE_STAGES[i+1].id === 'FLIP' ? '#ef4444' : '#ccc';
      const arrow = document.createElement('div');
      arrow.style.cssText = `color:${arrColor};font-size:1rem;padding:0 3px;flex-shrink:0`;
      arrow.textContent = '→';
      stageWrap.appendChild(arrow);
    }
    row.appendChild(stageWrap);
  });

  wrap.appendChild(row);
}

function renderPipeDetail(stage, wrap) {
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div style="font-size:1.4rem">${stage.icon}</div>
      <div>
        <div style="font-family:var(--font-mono);font-size:.62rem;color:var(--text-3)">${stage.id}</div>
        <div style="font-size:.88rem;font-weight:700;color:${stage.color}">${stage.label}</div>
        <div style="font-size:.72rem;color:var(--text-2)">${stage.sub}</div>
      </div>
    </div>
    <div style="font-size:.77rem;color:var(--text-2);line-height:1.7;margin-bottom:14px;border-left:3px solid ${stage.color};padding-left:10px">${stage.what}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <div class="pipe-section-title">Checks Performed</div>
        <ul class="pipe-checklist">${stage.checks.map(c=>`<li>${c}</li>`).join('')}</ul>
      </div>
      <div>
        <div class="pipe-section-title">Quality Gates (must pass)</div>
        <ul class="pipe-checklist">${stage.gates.map(g=>`<li>${g}</li>`).join('')}</ul>
        <div class="pipe-section-title" style="margin-top:10px">Outputs</div>
        <ul class="pipe-checklist">${stage.outputs.map(o=>`<li>${o}</li>`).join('')}</ul>
      </div>
    </div>
    <div style="margin-top:10px;display:flex;gap:4px;flex-wrap:wrap">${stage.rfp.map(r=>`<span style="font-family:var(--font-mono);font-size:.6rem;padding:2px 7px;border-radius:3px;background:var(--orange-50);border:1px solid rgba(234,88,12,.2);color:var(--accent-dk)">RFP${r}</span>`).join('')}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// FAILOVER TIMELINE
// ══════════════════════════════════════════════════════════════════════════════
const FT_STEPS = [
  { id:'FT-0', t:'T+0:00', color:'#ef4444', title:'Region A Incident Detected', actors:'Front Door WAF · APIM A · Container Apps A · PostgreSQL A',
    what:'Region A services begin experiencing failures. PostgreSQL primary starts returning write timeouts. Container Apps health probes start failing. Front Door health probe detects APIM A is unresponsive.',
    commands:['Front Door: health probe to APIM A returns 503 or times out (probe every 30s)','App Insights: P95 latency breaches SLO burn-rate alert (14× in 5min window)','Sentinel: anomaly detection fires on error rate spike → PagerDuty P1 page','On-call SRE receives page → opens incident bridge'],
    criteria:['Front Door probe failure count ≥ 3 consecutive','SLO burn-rate alert: 14× @ 5min/1h window triggered','P1 incident declared — freeze all feature deployments'],
    us_impact:['US-1: prefill requests failing → degraded mode (no prefill)', 'US-2: submit blocked → saga paused', 'US-38: DR procedure activated'] },
  { id:'FT-1', t:'T+2:00', color:'#ef4444', title:'Freeze & Declare DR Mode', actors:'Platform SRE · Security Lead · Communications',
    what:'Incident commander declares DR mode. Freeze all feature deployments. Notify stakeholders. Begin executing DR runbook.',
    commands:['APIM: set maintenance-mode header on Region A to return 503 with Retry-After to Region B','Deploy freeze: block all pipeline promotions (GitHub branch protection + Azure DevOps gate)', 'Status page: update to "Investigating service disruption"','Stakeholder notification: email + Teams channel alert'],
    criteria:['Deployment freeze confirmed in pipeline tooling', 'Status page updated', 'DR runbook opened by primary SRE'],
    us_impact:['All journeys: new requests start routing to Region B within 5min of origin switch'] },
  { id:'FT-2', t:'T+3:00', color:'#f59e0b', title:'Front Door Origin Switch to Region B', actors:'Azure Front Door · APIM B',
    what:'Front Door automatically switches traffic from APIM A (failing) to APIM B (standby) based on health probe failure threshold. APIM B is pre-provisioned with same Products, Policies, and Named Values.',
    commands:['Front Door: origin group priority failover — APIM A priority 1 → APIM B priority 2 auto-activated', 'APIM B: verify Products and API policies are current (last IaC sync < 1h)', 'DNS TTL: Front Door uses anycast — TTL effectively 0 for Anycast failover', 'Verify: Front Door health probe to APIM B returns 200'],
    criteria:['Front Door origin active = APIM B', 'Front Door probe to APIM B: 200 OK', 'First requests reaching APIM B within 2min of failover decision'],
    us_impact:['US-1/US-2/US-24: new requests now routing via APIM B', 'Active sessions: re-auth required (JWT signed by eID IdP — valid in both regions)'] },
  { id:'FT-3', t:'T+5:00', color:'#f59e0b', title:'Region B Container Apps Warm-Up', actors:'Container Apps B · Facade B · Orchestrator B · Adapters B',
    what:'Region B Container Apps environment scaled up from warm-idle (0 replicas) to minimum operational replicas. Health probes checked on all services.',
    commands:['Container Apps B: scale Facade to min=2 replicas', 'Container Apps B: scale Orchestrator to min=2 replicas', 'Container Apps B: scale all 6 Adapters to min=1 replica each', 'Health probe: GET /healthz on all services — expect 200 within 60s', 'Verify: APIM B backend pool shows Facade B healthy'],
    criteria:['All services in Region B: /healthz returns 200', 'APIM B: backend health check green for Facade B', 'First test request through full stack: auth → prefill → 200 OK'],
    us_impact:['US-1: prefill available in Region B (cache cold — expect cache miss rate 100% initially)', 'US-38: Region B now serving traffic'] },
  { id:'FT-4', t:'T+8:00', color:'#f59e0b', title:'Service Bus Geo-DR Alias Switch', actors:'Service Bus Alias · Operations',
    what:'Switch the Service Bus Geo-DR alias from primary namespace (Region A) to secondary namespace (Region B). In-flight messages that reached DLQ in Region A will need re-drive from Region B.',
    commands:['Azure CLI: az servicebus georecovery-alias fail-over --resource-group rg-prod --namespace sb-prod-a --alias sb-alias-prod', 'Verify: alias DNS now points to Region B namespace', 'Consumer apps: restart to pick up new alias endpoint (rolling restart in Container Apps B)', 'DLQ inspection: list any DLQ messages from Region A partition that need re-drive'],
    criteria:['Service Bus alias DNS resolves to Region B namespace within 5min', 'Consumers reconnected to Region B Service Bus', 'No DLQ message age > 4h (alert threshold)'],
    us_impact:['US-9 (Sagas): saga messages now flowing through Region B Service Bus', 'US-37 (DLQ): DLQ monitoring switched to Region B namespace'] },
  { id:'FT-5', t:'T+15:00', color:'#ef4444', title:'PostgreSQL Replica Promotion', actors:'PostgreSQL B (Replica) · SRE · Azure DBA',
    what:'Promote PostgreSQL Region B read replica to primary. This is the highest-risk step — must be done carefully to avoid split-brain. Single-writer constraint enforced.',
    commands:['Step 1: Confirm Region A PostgreSQL is truly unavailable (not a network partition — avoid split-brain)', 'Step 2: Azure CLI: az postgres flexible-server promote --resource-group rg-prod-b --name pg-prod-b --mode switchover', 'Step 3: Update Key Vault secret: pg-connection-string → Region B primary endpoint', 'Step 4: Container Apps B: restart Orchestrator and Adapters to pick up new connection string (Key Vault reference auto-refresh or manual restart)', 'Step 5: Verify: test write to Region B PostgreSQL succeeds'],
    criteria:['PostgreSQL B promoted to primary: read/write mode confirmed', 'Connection string in Key Vault updated', 'First write to Region B ODS: success (< 30s after connection string update)', 'No duplicate writes: Region A PostgreSQL confirmed offline before promotion'],
    us_impact:['US-12 (Draft save): draft writes now go to Region B ODS', 'US-24 (Submit): application records now written to Region B ODS', 'US-9 (Sagas): saga state written to Region B ODS'] },
  { id:'FT-6', t:'T+18:00', color:'#22c55e', title:'Cosmos DB & Redis Verification', actors:'Cosmos DB · Redis Enterprise B · SRE',
    what:'Verify Cosmos DB multi-region automatic failover and Redis geo-replication status.',
    commands:['Cosmos DB: verify failover status in Azure portal — auto-failover should have triggered automatically', 'If Cosmos auto-failover not triggered: az cosmosdb failover-priority-change --failover-policies Region-B=0', 'Redis Enterprise: check geo-replication link status — if geo-link degraded, expect cold cache start', 'Redis B: if cold start — MDM cache warmers run automatically on first prefill miss (gradual warm-up)'],
    criteria:['Cosmos DB: write region = Region B confirmed', 'Cosmos DB: first read/write from Orchestrator B: success', 'Redis B: either geo-link active (warm cache) or warm-up underway (degraded mode acceptable)'],
    us_impact:['US-28 (MDM Cache): expect higher cache miss rate (100% on cold start) → graceful degrade to direct adapter fetch', 'US-5/US-29 (Invalidation): event-driven invalidation will repopulate cache as events flow through Region B'] },
  { id:'FT-7', t:'T+25:00', color:'#22c55e', title:'Smoke Tests & Validation', actors:'SRE · Automated Smoke Suite',
    what:'Run automated smoke test suite against Region B endpoints to verify full platform functionality before declaring recovery.',
    commands:['Run: playwright smoke-suite --env prod-b --suite dr-validation', 'Test 1: OIDC+PKCE auth flow → expect 200 + valid JWT', 'Test 2: GET /v1/prefill/profile (cache miss expected) → expect 200 + canonical bundle (partial OK)', 'Test 3: POST /applications (dry-run=true) → expect 202 + correlationId', 'Test 4: Webhook ingress test → POST signed webhook → expect 200 idempotent', 'Test 5: Health probes all services → /healthz + /livez → 200 OK'],
    criteria:['All 5 smoke tests pass', 'No 5xx errors in smoke suite', 'Auth round-trip P95 < 3s (relaxed SLO during DR)', 'Prefill P95 < 3s (relaxed — cache cold, miss path expected)'],
    us_impact:['US-1: prefill functional (miss path, higher latency than normal — declared in status page)', 'US-2: full submit flow: functional', 'US-38: DR validation complete'] },
  { id:'FT-8', t:'T+30:00', color:'#22c55e', title:'Communicate Recovery', actors:'Incident Commander · Communications · Product Owner',
    what:'Declare service restored in Region B. Update status page. Notify stakeholders. Begin post-incident analysis.',
    commands:['Status page: update to "Service restored — running in Region B (DR mode)"', 'Stakeholder notification: email + Teams with: RTO achieved, data loss status (RPO), users affected, ETA for Region A restoration', 'Error budget: document burn during incident → monthly SLO report update', 'Post-incident review: schedule within 48h → produce blameless post-mortem + runbook PRs'],
    criteria:['Status page updated with accurate RTO achieved', 'Stakeholder notification sent < 5min after smoke tests pass', 'Post-incident review scheduled'],
    us_impact:['All journeys: restored in Region B', 'Performance: slightly degraded (cache cold, single region) — acceptable DR mode', 'US-38: DR scenario complete — document actual RTO for quarterly report'] },
  { id:'FT-9', t:'T+Recovery', color:'#8b5cf6', title:'Region A Restoration & Failback', actors:'SRE · Azure Support · DBA',
    what:'After Region A is restored (Azure infrastructure fix, outage resolution), plan and execute controlled failback. This is not emergency — done carefully during low-traffic window.',
    commands:['Verify Region A infrastructure is stable (24h observation after restoration)', 'Re-sync PostgreSQL: Region A becomes new replica (logical replication from Region B primary)', 'Gradual failback: Front Door canary 5% → 25% → 50% → 100% back to Region A (same canary process as normal release)', 'Service Bus alias: switch back to Region A namespace during low-traffic window', 'Post-failback: verify Region B returns to warm standby state'],
    criteria:['PostgreSQL Region A re-synced as replica (lag < 5min)', 'Canary failback: SLO green at each % step', 'Region B: returned to warm standby (scale to min=1 or 0)', 'Failback report: documented RPO/RTO achieved, lessons learned'],
    us_impact:['All journeys: fully restored to normal Region A primary performance', 'MDM cache: warm in Region A (populated during DR period)', 'US-38: DR cycle complete — update quarterly DR drill report'] }
];

const FT_US_MAP = [
  { us:'US-1 Prefill', impact:'Cache cold in Region B initially → 100% miss rate → degrade to direct adapter fetch → P95 ≤ 3s (relaxed DR SLO). Recovers to normal ≥ 80% hit rate within 1-2h as cache warms.', severity:'medium' },
  { us:'US-2 Full Application', impact:'In-flight saga steps may be interrupted at Region A failure. Saga state persisted in ODS — re-driven from Region B ODS after promotion. eSign/payment webhooks: re-routed to Region B via Front Door.', severity:'high' },
  { us:'US-9 Sagas', impact:'Orchestrator saga state stored in PostgreSQL — available in Region B after replica promotion. In-flight sagas retried from last committed step. Service Bus messages re-queued via geo-DR alias.', severity:'high' },
  { us:'US-24 Submit (Idempotent)', impact:'Idempotency ledger in ODS — available after PostgreSQL B promotion. Duplicate submissions (from client retry) handled correctly by idempotency key.', severity:'medium' },
  { us:'US-28 MDM Cache', impact:'Redis cold start → 100% miss rate → graceful degrade → direct registry adapter calls → higher latency but requests succeed. Cache warms up gradually as new prefill requests populate Redis B.', severity:'low' },
  { us:'US-38 DR', impact:'This IS the DR scenario. RTO target ≤ 60min. Smoke tests validate recovery. Quarterly drill validates this timeline is achievable.', severity:'info' },
];

function buildFailoverTimeline() {
  const timeline = document.getElementById('ft-timeline');
  const detail = document.getElementById('ft-detail');
  const usMap = document.getElementById('ft-us-map');
  if (!timeline) return;

  FT_STEPS.forEach(step => {
    const div = document.createElement('div');
    div.className = 'ft-step';
    div.innerHTML = `
      <div class="ft-dot" style="color:${step.color};background:${hexA4(step.color,0.25)}"></div>
      <div class="ft-card">
        <div class="ft-time">${step.t}</div>
        <div class="ft-title">${step.title}</div>
        <div class="ft-actors">${step.actors}</div>
      </div>`;
    div.querySelector('.ft-card').addEventListener('click', () => {
      timeline.querySelectorAll('.ft-card').forEach(c => c.classList.remove('active'));
      div.querySelector('.ft-card').classList.add('active');
      renderFTDetail(step, detail);
    });
    timeline.appendChild(div);
  });

  if (usMap) {
    const sevColors = { high:'#ef4444', medium:'#f59e0b', low:'#22c55e', info:'#3b82f6' };
    usMap.innerHTML = FT_US_MAP.map(m => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--font-mono);font-size:.65rem;font-weight:700;color:${sevColors[m.severity]||'#888'};background:${hexA4(sevColors[m.severity]||'#888',0.1)};border:1px solid ${hexA4(sevColors[m.severity]||'#888',0.25)};border-radius:3px;padding:1px 6px;flex-shrink:0;margin-top:1px">${m.us.split(' ')[0]}</span>
        <div>
          <div style="font-size:.74rem;font-weight:600;color:var(--text-1)">${m.us}</div>
          <div style="font-size:.71rem;color:var(--text-2);line-height:1.55;margin-top:2px">${m.impact}</div>
        </div>
      </div>`).join('');
  }
}

function renderFTDetail(step, wrap) {
  wrap.innerHTML = `
    <div style="border-left:4px solid ${step.color};padding-left:12px;margin-bottom:14px">
      <div style="font-family:var(--font-mono);font-size:.62rem;color:var(--text-3)">${step.id} · ${step.t}</div>
      <div style="font-size:.86rem;font-weight:700;color:${step.color};margin:3px 0">${step.title}</div>
      <div style="font-size:.68rem;color:var(--accent-dk);font-family:var(--font-mono)">${step.actors}</div>
    </div>
    <div style="font-size:.75rem;color:var(--text-2);line-height:1.7;margin-bottom:12px">${step.what}</div>
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">Commands & Actions</div>
    <ul style="list-style:none;margin-bottom:12px">${step.commands.map(c=>`<li style="font-size:.7rem;color:var(--text-2);padding:3px 0 3px 14px;position:relative"><span style="position:absolute;left:0;color:${step.color}">▸</span>${c}</li>`).join('')}</ul>
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">Acceptance Criteria</div>
    <ul style="list-style:none;margin-bottom:12px">${step.criteria.map(c=>`<li style="font-size:.71rem;color:var(--text-2);padding:3px 0 3px 14px;position:relative"><span style="position:absolute;left:0;color:#16a34a;font-weight:700">✓</span>${c}</li>`).join('')}</ul>
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">User Story Impact</div>
    <ul style="list-style:none">${step.us_impact.map(u=>`<li style="font-size:.7rem;color:var(--text-2);padding:3px 0 3px 14px;position:relative"><span style="position:absolute;left:0;color:#f97316">→</span>${u}</li>`).join('')}</ul>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// DR & CHAOS
// ══════════════════════════════════════════════════════════════════════════════
const DR_DRILL_STEPS = [
  { icon:'📋', color:'#3b82f6', label:'Announce Drill', sub:'Notify stakeholders, freeze prod deploys, open bridge' },
  { icon:'💥', color:'#ef4444', label:'Inject Fault', sub:'Simulate Region A failure: kill APIM A or block DNS' },
  { icon:'🔀', color:'#f59e0b', label:'Front Door Failover', sub:'Verify origin switch to Region B within 5min' },
  { icon:'🌿', color:'#22c55e', label:'Region B Warm-Up', sub:'Scale Container Apps B, verify /healthz all green' },
  { icon:'📨', color:'#f59e0b', label:'Service Bus Alias Switch', sub:'Execute geo-DR alias failover, verify consumer reconnect' },
  { icon:'🗄', color:'#ef4444', label:'PostgreSQL Promotion', sub:'Promote replica to primary, update Key Vault, restart apps' },
  { icon:'🧪', color:'#22c55e', label:'Smoke Tests', sub:'Run DR smoke suite: auth → prefill → submit dry-run' },
  { icon:'📊', color:'#8b5cf6', label:'Measure RTO/RPO', sub:'Record actual time, verify RPO ≤ 5min, RTO ≤ 60min' },
  { icon:'📝', color:'#3b82f6', label:'After-Action Review', sub:'Blameless post-mortem, runbook PRs, thresholds update' },
  { icon:'✅', color:'#22c55e', label:'Sign Off Report', sub:'Signed drill report filed, next drill scheduled (quarterly)' }
];

const CHAOS_EXP = [
  { id:'CE-01', title:'Civil Registry Adapter Timeout', severity:'high', fault:'Inject 5s timeout for 30% of calls to Civil adapter',
    expected:'Circuit breaker opens after ≥20% 5xx over 60s window. Partial canonical bundle returned (civil fields missing + problems[]). User sees partial prefill — other registry fields still present. DLQ count = 0 (timeout is retried, not DLQed).',
    accept:'User journey continues with partial data. CB state gauge = OPEN in Prometheus. Alert fires to on-call. Prefill P95 stays under 3s (miss path budget). Retries eventually succeed on non-civil fields.',
    restore:'Remove fault injection. CB enters HALF_OPEN after 30s. 5 probe requests succeed. CB returns to CLOSED. Full canonical bundle restored.',
    nfr:['NFR-06','NFR-01'], us:['US-1','US-36'] },
  { id:'CE-02', title:'Service Bus Queue Saturation', severity:'high', fault:'Reduce Service Bus throughput units to 1; throttle consumer restart to simulate backlog build-up',
    expected:'Backpressure: APIM returns 429 with RETRY_AFTER header when queue depth > threshold. KEDA autoscale triggers new consumer replicas. Queue lag recovers < 10s after consumers scale out.',
    accept:'Alert fires on queue lag > 10s. KEDA adds consumer replicas (visible in Container Apps dashboard). 429 responses to clients include correct Retry-After. Lag P95 returns < 2s within 5min of autoscale.',
    restore:'Restore Service Bus TUs to baseline. Verify consumer count scales back down after queue drains.',
    nfr:['NFR-24','NFR-08'], us:['US-9','US-37'] },
  { id:'CE-03', title:'Redis MDM Cache Outage', severity:'medium', fault:'Kill Redis Enterprise cluster (simulate: stop container / block port 6380)',
    expected:'MDM cache calls fail immediately. Orchestrator detects Redis unavailable. Graceful degrade: fall back to direct registry adapter calls. latency increases (miss path budget ~1.2s) but requests succeed. degraded_mode_counter increments.',
    accept:'Requests succeed (no 5xx from platform). P95 latency increases to ≤ 3s (relaxed DR latency). degraded_mode counter visible in App Insights. No data loss. Cache warmers auto-run on Redis recovery.',
    restore:'Restore Redis. Cache warmers populate MDM cache from adapter calls. Hit rate recovers to ≥ 80% within 30min.',
    nfr:['NFR-16','NFR-06'], us:['US-28','US-36'] },
  { id:'CE-04', title:'Webhook Replay Attack', severity:'medium', fault:'Send same signed webhook payload twice with identical nonce and timestamp',
    expected:'First webhook: 200 OK, state updated, event emitted. Second webhook (duplicate): 200 idempotent (NOT a new state update). Nonce store in Redis records nonce as used (TTL 10min). No duplicate events emitted. No duplicate case state changes.',
    accept:'Idempotency ledger: exactly 1 record for packageId. State change event: emitted exactly once. Second webhook response: 200 with x-idempotent-replay: true header. No audit receipt duplicated.',
    restore:'Nonce expires from Redis after 10min. System returns to normal state.',
    nfr:['NFR-18','NFR-15'], us:['US-4','US-21'] },
  { id:'CE-05', title:'All Registry Adapters Simultaneously Unavailable', severity:'high', fault:'Block DNS resolution for all 6 registry endpoints simultaneously',
    expected:'All adapter calls fail (connection refused). All 6 circuit breakers open. MDM cache serves cached snapshots within TTL. For cache-miss requests: return empty canonical bundle with all fields in problems[]. Journey can continue only with user-entered data. No 500 errors.',
    accept:'Platform returns partial bundle + problems[] (not 500). All 6 CB state gauges = OPEN. Sentinel alert fires on multiple CBs open simultaneously. Portal shows "some data unavailable" banner. Citizens can still submit manually.',
    restore:'Restore DNS. CBs enter HALF_OPEN. Probe requests succeed. CBs CLOSED. Full prefill restored.',
    nfr:['NFR-06','NFR-10'], us:['US-1','US-36'] },
  { id:'CE-06', title:'JWT Key Rotation (JWKS Rollover)', severity:'medium', fault:'Rotate eID IdP signing key (RS256 → new key pair). Old tokens still in circulation with previous kid claim.',
    expected:'APIM refreshes JWKS from IdP within 5min (cache TTL). New tokens with new kid: accepted immediately. Tokens signed with old kid: rejected with 401 after JWKS refresh. Portal detects 401 → silent refresh → new token with new kid → transparent to user.',
    accept:'Graceful key rollover: zero user-visible errors during transition. Token with new kid: accepted within 30s of key rotation. Token with old kid post-TTL: 401 → portal refresh → transparent re-auth.',
    restore:'Old kid removed from JWKS. System normalised on new key.',
    nfr:['NFR-09','NFR-13'], us:['US-1','US-7'] },
  { id:'CE-07', title:'PostgreSQL Primary Failover (Zonal)', severity:'high', fault:'Simulate availability zone failure: kill PostgreSQL primary in Zone 1 (ZRS will promote standby in Zone 2)',
    expected:'PostgreSQL ZRS: automatic promotion of Zone 2 standby to primary within 60-120s. Application reconnects using Azure managed failover (DNS CNAME update). Write operations resume. Data loss: 0 (synchronous ZRS replication).',
    accept:'Application write errors during promotion window (< 120s). After promotion: writes succeed. Data loss: 0 confirmed by record count check. P95 latency: recovers within 5min. No DLQ messages created from write failures (saga retries succeed after reconnect).',
    restore:'PostgreSQL ZRS re-provisions replacement zone replica automatically.',
    nfr:['NFR-07','NFR-05'], us:['US-24','US-9'] },
  { id:'CE-08', title:'Malicious Document Upload (EICAR)', severity:'medium', fault:'Upload EICAR standard antivirus test file with valid Content-Type: application/pdf header',
    expected:'Document Intake: Blob receives file. AV scan triggered within 5s. EICAR signature detected. Document status set to Rejected. SHA-256 hash recorded in audit log. SOC alert raised in Sentinel. Document inaccessible to any user.',
    accept:'Document status = Rejected within 90s of upload. Sentinel incident created with severity Medium. Document not accessible via signed URL (403). Audit log: scan_outcome=rejected, reason=malware_detected.',
    restore:'Rejected document quarantined. SOC reviews Sentinel incident. Test evidence archived.',
    nfr:['NFR-17'], us:['US-18'] },
  { id:'CE-09', title:'APIM Rate Limit Exhaustion', severity:'low', fault:'Generate 10× normal RPS from a single subscription to trigger rate limit',
    expected:'APIM rate limit policy triggers 429 Too Many Requests with Retry-After header after quota exhausted. Legitimate users on other subscriptions unaffected. Spike-arrest policy protects backend from burst.',
    accept:'429 responses within 2s of quota exhaustion. Retry-After header present. Other subscriptions: zero impact. APIM policy dashboard: quota exhaustion event recorded. Alert fires for unusual 429 rate from single subscription.',
    restore:'Rate limit resets on next window. Normal traffic resumes.',
    nfr:['NFR-23','NFR-09'], us:['US-7'] },
  { id:'CE-10', title:'Consent Gate Bypass Attempt', severity:'high', fault:'Craft an API request with valid JWT but missing consent record for the requested purposeId',
    expected:'Orchestrator → SEC component → consent gate: consent not found for purposeId → 403 with problem+json: consent_required + purposeId in response. No adapter called. Audit log records: consent_check_outcome=DENIED. Metric: consent_gate_denial_counter increments.',
    accept:'403 returned with correct problem+json. No adapter call initiated (verified via trace: no adapter span in trace). Audit log: consent_check_outcome=DENIED. consent_gate_denial_counter +1. Zero false passes.',
    restore:'Consent record created with correct purposeId. Retry succeeds.',
    nfr:['NFR-10','NFR-11'], us:['US-1','US-7'] }
];

function buildDRChaos() {
  const drSteps = document.getElementById('dr-drill-steps');
  const chaosGrid = document.getElementById('chaos-grid');
  const chaosDetail = document.getElementById('chaos-detail');
  if (!drSteps) return;

  DR_DRILL_STEPS.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'tel-hop';
    div.innerHTML = `
      <div class="tel-hop-icon" style="background:${hexA4(step.color,0.12)};border:1.5px solid ${hexA4(step.color,0.35)}">${step.icon}</div>
      <div>
        <div style="font-family:var(--font-mono);font-size:.62rem;color:var(--text-3)">Step ${i+1}</div>
        <div class="tel-hop-title">${step.label}</div>
        <div class="tel-hop-sub">${step.sub}</div>
      </div>`;
    div.addEventListener('click', () => {
      drSteps.querySelectorAll('.tel-hop').forEach(h => h.classList.remove('active'));
      div.classList.add('active');
      const ft = FT_STEPS.find(s => s.title.toLowerCase().includes(step.label.toLowerCase().split(' ')[1]) || i < FT_STEPS.length ? FT_STEPS[Math.min(i, FT_STEPS.length-1)] : null);
      if (ft) renderChaosDetail(`DR Drill Step ${i+1}: ${step.label}`, step.sub, step.color, chaosDetail);
    });
    drSteps.appendChild(div);
    if (i < DR_DRILL_STEPS.length - 1) {
      const arr = document.createElement('div');
      arr.className = 'tel-arrow';
      arr.textContent = '↓';
      drSteps.appendChild(arr);
    }
  });

  if (chaosGrid) {
    CHAOS_EXP.forEach(exp => {
      const card = document.createElement('div');
      card.className = 'chaos-card';
      const sevClass = exp.severity === 'high' ? 'sev-high' : exp.severity === 'medium' ? 'sev-med' : 'sev-low';
      card.innerHTML = `
        <div class="chaos-id">${exp.id}</div>
        <div class="chaos-title">${exp.title}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
          <span class="chaos-severity ${sevClass}">${exp.severity.toUpperCase()}</span>
          <span style="font-size:.65rem;color:var(--text-3);font-family:var(--font-mono)">${exp.nfr.join(' · ')}</span>
        </div>
        <div style="font-size:.68rem;color:var(--text-3);margin-top:5px;line-height:1.4">${exp.fault}</div>`;
      card.addEventListener('click', () => {
        chaosGrid.querySelectorAll('.chaos-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        renderChaosExpDetail(exp, chaosDetail);
      });
      chaosGrid.appendChild(card);
    });
  }
}

function renderChaosDetail(title, sub, color, wrap) {
  wrap.innerHTML = `
    <div style="border-left:4px solid ${color};padding-left:12px">
      <div style="font-size:.86rem;font-weight:700;color:${color}">${title}</div>
      <div style="font-size:.73rem;color:var(--text-2);margin-top:4px">${sub}</div>
    </div>`;
}

function renderChaosExpDetail(exp, wrap) {
  const sevColor = exp.severity === 'high' ? '#ef4444' : exp.severity === 'medium' ? '#f59e0b' : '#22c55e';
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div>
        <div style="font-family:var(--font-mono);font-size:.63rem;color:var(--text-3)">${exp.id}</div>
        <div style="font-size:.85rem;font-weight:700;color:var(--text-1);margin:3px 0">${exp.title}</div>
        <span class="chaos-severity ${exp.severity==='high'?'sev-high':exp.severity==='medium'?'sev-med':'sev-low'}">${exp.severity.toUpperCase()} IMPACT</span>
      </div>
    </div>
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:4px;padding-bottom:3px;border-bottom:1px solid var(--border)">Fault Injected</div>
    <div style="font-size:.74rem;color:var(--text-2);margin-bottom:10px;font-family:var(--font-mono);background:var(--bg-elevated);padding:8px 10px;border-radius:var(--r-md)">${exp.fault}</div>
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:4px;padding-bottom:3px;border-bottom:1px solid var(--border)">Expected Platform Behaviour</div>
    <div style="font-size:.74rem;color:var(--text-2);line-height:1.65;margin-bottom:10px">${exp.expected}</div>
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:4px;padding-bottom:3px;border-bottom:1px solid var(--border)">Acceptance Criteria</div>
    <div style="font-size:.74rem;color:var(--text-2);line-height:1.65;margin-bottom:10px">${exp.accept}</div>
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:4px;padding-bottom:3px;border-bottom:1px solid var(--border)">Restoration Procedure</div>
    <div style="font-size:.74rem;color:var(--text-2);line-height:1.65;margin-bottom:10px">${exp.restore}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      ${exp.nfr.map(n=>`<span style="font-family:var(--font-mono);font-size:.6rem;padding:2px 6px;border-radius:3px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);color:#7c3aed">${n}</span>`).join('')}
      ${exp.us.map(u=>`<span style="font-family:var(--font-mono);font-size:.6rem;padding:2px 6px;border-radius:3px;background:var(--orange-50);border:1px solid rgba(234,88,12,.2);color:var(--accent-dk)">${u}</span>`).join('')}
    </div>`;
}

// ── Utility ───────────────────────────────────────────────────────────────────
function hexA4(hex, a) {
  try {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  } catch { return hex; }
}

})();
