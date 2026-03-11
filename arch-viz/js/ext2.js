// ─── Interop Platform — Enhancement Module v5 ────────────────────────────────
(function () {
'use strict';

const NS2 = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const e = document.createElementNS(NS2, tag);
  if (attrs) Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v));
  return e;
}
function hexA2(hex, a) {
  try { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; }
  catch { return hex; }
}
function makeZone(svg, x,y,w,h,c,lbl) {
  const g = svgEl('g');
  g.appendChild(svgEl('rect',{x,y,width:w,height:h,rx:7,fill:hexA2(c,0.04),stroke:c,'stroke-width':'1','stroke-dasharray':'5 3','stroke-opacity':'0.4'}));
  const bw = lbl.length*5.4+16;
  g.appendChild(svgEl('rect',{x:x+10,y:y-8,width:bw,height:15,rx:4,fill:'#fafaf9',stroke:c,'stroke-width':'0.7','stroke-opacity':'0.5'}));
  const t = svgEl('text',{x:x+18,y:y+3,'font-family':'Inter,sans-serif','font-size':'7','font-weight':'700',fill:c,opacity:'0.85','letter-spacing':'0.6','pointer-events':'none'});
  t.textContent = lbl; g.appendChild(t); svg.appendChild(g);
}
function makeNode(svg, x,y,w,h,color,label,sub,onClick) {
  const g = svgEl('g',{class:'n-group',style:'cursor:pointer'});
  const rect = svgEl('rect',{x,y,width:w,height:h,rx:6,fill:hexA2(color,0.09),stroke:color,'stroke-width':'1.3','stroke-opacity':'0.6'});
  g.appendChild(rect);
  g.appendChild(svgEl('rect',{x:x+8,y:y,width:w-16,height:3,rx:1.5,fill:color,opacity:'0.7'}));
  const t1 = svgEl('text',{x:x+w/2,y:y+20,'text-anchor':'middle','font-family':'Inter,sans-serif','font-size':'9','font-weight':'700',fill:'#1a1a18','pointer-events':'none'});
  t1.textContent = label;
  const t2 = svgEl('text',{x:x+w/2,y:y+31,'text-anchor':'middle','font-family':'JetBrains Mono,monospace','font-size':'6.5',fill:color,opacity:'0.85','pointer-events':'none'});
  t2.textContent = sub;
  g.appendChild(t1); g.appendChild(t2);
  g.addEventListener('mouseenter',()=>{ if(!g.classList.contains('sel')) rect.setAttribute('fill',hexA2(color,0.18)); });
  g.addEventListener('mouseleave',()=>{ if(!g.classList.contains('sel')) rect.setAttribute('fill',hexA2(color,0.09)); });
  g.addEventListener('click', e => { e.stopPropagation(); onClick(g, rect, color); });
  svg.appendChild(g); return g;
}
function makeEdge(svg, x1,y1,x2,y2,c,lbl,dashed) {
  const dx=x2-x1, dy=y2-y1;
  const cp1x=x1+dx*0.35, cp1y=y1, cp2x=x2-dx*0.35, cp2y=y2;
  svg.appendChild(svgEl('path',{d:`M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`,stroke:c,'stroke-width':'1.1','stroke-opacity':'0.45',fill:'none','stroke-dasharray':dashed?'5 3':'none'}));
  if(lbl) {
    const mx=(x1+x2)/2, my=(y1+y2)/2-9;
    svg.appendChild(svgEl('rect',{x:mx-lbl.length*2.7,y:my-6,width:lbl.length*5.4+4,height:11,rx:3,fill:'rgba(255,255,255,0.95)',stroke:hexA2(c,0.3),'stroke-width':'0.6'}));
    const t = svgEl('text',{x:mx,y:my+2,'text-anchor':'middle','font-family':'JetBrains Mono,monospace','font-size':'6.5',fill:hexA2(c,0.9),'pointer-events':'none'});
    t.textContent = lbl; svg.appendChild(t);
  }
}

// Deselect all nodes in an svg
function clearSel(svg, color) {
  svg.querySelectorAll('.n-group').forEach(x => {
    x.classList.remove('sel');
    const r = x.querySelector('rect'); if(r) r.setAttribute('fill', hexA2(color||'#888',0.09));
  });
}
function clearSelAll(svg) {
  svg.querySelectorAll('.n-group').forEach(x => {
    x.classList.remove('sel');
    const r = x.querySelector('rect'); if(r&&x._nc) r.setAttribute('fill', hexA2(x._nc,0.09));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  buildSecurityEnhanced();
  buildDataLayerEnhanced();
  buildTelemetryDiagram();
  buildFailoverDiagram();
  buildDRDiagram();
});

// ══════════════════════════════════════════════════════════════════════════════
// SECURITY
// ══════════════════════════════════════════════════════════════════════════════
const SEC_DATA = {
  CITIZEN:{ cat:'End User', lbl:'Citizen / Officer', sub:'Browser · Mobile · Kiosk', c:'#3b82f6',
    plain:'The person using the service. The browser/app generates a PKCE challenge locally — platform never sees passwords or biometrics.',
    tech:'React SPA. code_verifier (32 random bytes) → code_challenge = BASE64URL(SHA-256(verifier)). Refresh token in HttpOnly Secure SameSite=Lax cookie. x-correlation-id UUID v4 on every request.',
    why:'PKCE prevents authorisation code interception. Even if an attacker intercepts the code, they cannot redeem it without the verifier that never left the client.',
    controls:['PKCE S256 — RFC 7636 mandatory','HttpOnly cookie: JS cannot read refresh token on XSS','Content-Security-Policy prevents script injection','15-min idle timeout on kiosk channel'] },
  PORTAL:{ cat:'Channel Layer', lbl:'Portal (Web/Mobile/Kiosk)', sub:'Multi-Channel · WCAG 2.1 AA', c:'#3b82f6',
    plain:'Multi-channel frontend. Handles PKCE flow, calls Facade API with Bearer JWT, renders schema-driven forms.',
    tech:'Container App. Silent token refresh via /token before expiry. Forwards traceparent + x-correlation-id on every request.',
    why:'One portal codebase avoids diverging security postures across channels.',
    controls:['Silent refresh: proactive renewal before 15-min expiry','traceparent: every user action traceable end-to-end','CORS: only portal origins allowed by APIM policy'] },
  EID:{ cat:'Identity Provider', lbl:'eID IdP (OIDC+PKCE)', sub:'National eID · RS256/ES256', c:'#ec4899',
    plain:'National identity provider. Issues three tokens after eID auth. Platform never sees the citizen\'s password or biometric.',
    tech:'OIDC Auth Server. JWKS for public key distribution. ACR levels: 1 (password), 2 (eID Midden), 3 (hardware token). Claims: sub (hashed), name, acr, scope.',
    why:'Delegating identity to the national IdP means zero authentication liability — passwords are never stored here.',
    controls:['RS256/ES256 signing — asymmetric, no shared secret','JWKS auto-rotation: zero-downtime key rollover','State+nonce: prevent CSRF and replay','ACR step-up: re-auth if acr < required for operation'] },
  CONS:{ cat:'Consent Layer', lbl:'Consent Service', sub:'Purpose-Bound · Scoped · Expiry', c:'#ec4899',
    plain:'Stores and enforces all data-sharing consents. Every consent is bound to a purpose, scopes, and expiry.',
    tech:'Microservice (PostgreSQL). Record: {subjectHash, purposeId, scopesGranted[], grantedAt, expiresAt, withdrawnAt, receiptId}. JWS-signed WORM receipt on every state change.',
    why:'Without a dedicated service, consent logic leaks into every controller — inconsistent enforcement and no clean GDPR withdrawal path.',
    controls:['Purpose limitation: each consent bound to one purposeId','Expiry checked at call time, not grant time','WORM JWS receipt: legally admissible tamper-evident audit','Withdrawal propagated within 60s via Event Grid'] },
  CLAIMS:{ cat:'Claims Mapper', lbl:'Claims Mapper (RBAC)', sub:'ACR · Scopes · Role Mapping', c:'#ec4899',
    plain:'Translates IdP JWT claims into the platform\'s internal role and permission model.',
    tech:'APIM inbound policy. Reads: iss, aud, sub, acr, scope. Maps to: platform role, resource permission level. ACR threshold declared per operation.',
    why:'Decouples IdP claim vocabulary from business access control. A future IdP switch only updates the mapper.',
    controls:['ACR check per operation: low-assurance token blocked before business logic','Role-to-scope validation','No raw sub: SHA-256 hashed across services'] },
  APIM:{ cat:'API Gateway', lbl:'APIM Premium', sub:'JWT · RBAC · Rate Limits · VNet', c:'#f97316',
    plain:'Single front door for all API traffic. Validates identity, enforces permissions, protects backends from overload.',
    tech:'Azure APIM Premium. VNet-injected (internal mode). validate-jwt (RS256/ES256+JWKS), rate-limit-by-key (citizen=100/min, officer=500/min), ip-filter (webhook IPs), cors.',
    why:'Centralising JWT + rate limiting at the gateway means no microservice can accidentally bypass auth.',
    controls:['JWT validated on every request: sig, expiry, issuer, audience, scopes','Rate limit: prevents DDoS reaching backend','VNet: no public endpoint on any backend','IP allowlist: webhook callbacks from unknown IPs → 403'] },
  FACADE:{ cat:'API Facade', lbl:'API Facade — Versioned', sub:'Idempotency · problem+json · ABAC', c:'#8b5cf6',
    plain:'Stable contract surface. Versioned API paths with idempotency guarantees.',
    tech:'Container App. Idempotency-Key ledger (PostgreSQL, 24h TTL). ABAC: callerSubjectHash == resourceOwnerHash. RFC 7807 problem+json errors.',
    why:'Without a stable Facade, any internal refactor risks breaking consumers.',
    controls:['ABAC: callers only read/write own resources','Idempotency-Key: duplicate POST returns 200','problem+json: machine-readable errors','Schema validation rejects malformed requests'] },
  SEC_GATE:{ cat:'Interop Core', lbl:'SEC / Consent Gate', sub:'ABAC · Per-Call Consent · Zero Bypass', c:'#06b6d4',
    plain:'Consent enforcement called before EVERY registry adapter call. No bypass path exists.',
    tech:'Component within Orchestrator. Steps: GET /consents, verify scopesRequired ⊆ scopesGranted, verify expiresAt > now(). ConsentException → saga compensates → 403.',
    why:'GDPR Article 6 requires a lawful basis for every processing activity. Making it a mandatory saga step means zero bypass is an architectural property.',
    controls:['Zero bypass: ConsentException aborts and compensates','100% audit: OTel consent_gate span on every call','Denial SLO = 0 violations (NFR-11)','Scope check: even valid consent cannot exceed explicit scopes'] },
  MULTITOKEN:{ cat:'Token Lifecycle', lbl:'Token Lifecycle', sub:'ID 5min · Access 15min · Refresh rotating', c:'#ec4899',
    plain:'Three tokens: who you are (ID ≤5min), what you can do now (Access ≤15min), silent renewal (Refresh, rotating).',
    tech:'Access Token ≤15min — validated by APIM on every request. Rotating Refresh in HttpOnly cookie. Silent refresh calls /token before expiry.',
    why:'Short tokens limit blast radius. Rotating refresh tokens detect theft: using a previously-rotated token returns invalid_grant.',
    controls:['Access ≤15 min: stolen token expires quickly (NFR-09)','Refresh rotation: theft detected on next legitimate use','Silent refresh: no user-facing 401 mid-journey','no_store: token never cached by browser/CDN'] },
  SENTINEL:{ cat:'Security Operations', lbl:'Microsoft Sentinel (SIEM)', sub:'KQL Rules · Anomaly · SOAR', c:'#ef4444',
    plain:'The software security operations centre. Watches all platform logs for attack patterns and auto-contains threats.',
    tech:'Sentinel + Log Analytics. KQL rules: impossible_travel, brute_force (>5 PKCE fails/min), webhook_replay. AI Fusion. SOAR: Logic App auto-adds IP to Front Door WAF on brute-force.',
    why:'Manual log review at 600 RPS is impossible. ML-based fusion detects patterns that rule-based systems miss.',
    controls:['KQL brute-force: auto-block IP via SOAR < 5 min','AI Fusion: low-signal anomalies → high-confidence incidents','All alerts enriched with corrId for full forensic trace','Monthly FP review: < 5% false positive rate target'] },
  KV:{ cat:'Secrets Management', lbl:'Azure Key Vault', sub:'Managed Identity · HSM · No Static Creds', c:'#ef4444',
    plain:'Secure vault for all platform secrets. No service stores a secret in code, config, or environment variables.',
    tech:'Key Vault Premium SKU (HSM-backed). All services use Managed Identity. Rotation: webhook secrets 90 days auto-rotated. TLS certs via DigiCert CA integration.',
    why:'Managed Identity eliminates static credentials. A compromised container image has no secrets to extract.',
    controls:['Managed Identity: zero static credentials anywhere','HSM backing: signing keys cannot be exported in plaintext','Rotation policy: system enforces, humans cannot forget','Audit: every access logged with caller identity + corrId'] },
};

function buildSecurityEnhanced() {
  const panel = document.getElementById('panel-security');
  if (!panel) return;
  const existing = panel.querySelector('.two-col');
  if (!existing) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:0';

  // Intro card
  const intro = document.createElement('div');
  intro.className = 'card'; intro.style.marginBottom = '16px';
  intro.innerHTML = `<div class="card-hdr"><div class="card-hdr-accent"></div>Security Architecture — Click any component for specification &amp; design rationale</div>
    <div class="card-body" style="font-size:.81rem;color:var(--text-2);line-height:1.75">Five nested security boundaries: <strong>Internet → Front Door WAF → APIM JWT/RBAC → Facade ABAC → Consent Gate → Data Private Endpoints</strong>. Every request passes all five. Click any component to see its role in plain English, the technology, and why this design was chosen over alternatives.</div>`;
  wrap.appendChild(intro);

  // Compact component grid (replaces the oversized SVG)
  const gridWrap = document.createElement('div');
  gridWrap.className = 'card'; gridWrap.style.marginBottom = '16px';
  gridWrap.innerHTML = '<div class="card-hdr"><div class="card-hdr-accent"></div>Security Components — Click any to open detail panel</div><div class="card-body" style="padding:12px"></div>';
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px';

  // Boundary labels
  const boundaries = [
    { label:'Channel & Identity', ids:['CITIZEN','PORTAL','EID'], c:'#3b82f6' },
    { label:'Consent & Claims', ids:['CONS','CLAIMS'], c:'#ec4899' },
    { label:'Gateway', ids:['APIM','FACADE'], c:'#f97316' },
    { label:'Interop Core', ids:['SEC_GATE','MULTITOKEN'], c:'#06b6d4' },
    { label:'SecOps & Secrets', ids:['SENTINEL','KV'], c:'#ef4444' },
  ];

  boundaries.forEach(bnd => {
    const zone = document.createElement('div');
    zone.style.cssText = `border:1.5px solid ${hexA2(bnd.c,0.3)};border-radius:10px;padding:8px 8px 6px;background:${hexA2(bnd.c,0.025)}`;
    const zlbl = document.createElement('div');
    zlbl.style.cssText = `font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:${bnd.c};margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid ${hexA2(bnd.c,0.2)}`;
    zlbl.textContent = bnd.label; zone.appendChild(zlbl);
    bnd.ids.forEach(id => {
      const n = SEC_DATA[id];
      const card = document.createElement('div');
      card.style.cssText = `background:var(--bg-surface);border:1px solid ${hexA2(n.c,0.25)};border-radius:6px;padding:8px 10px;cursor:pointer;margin-bottom:5px;position:relative;overflow:hidden;transition:all .15s`;
      card.innerHTML = `<div style="position:absolute;top:0;left:0;bottom:0;width:3px;background:${n.c};opacity:.7"></div>
        <div style="padding-left:8px">
          <div style="font-size:.73rem;font-weight:700;color:var(--text-1);line-height:1.3">${n.lbl}</div>
          <div style="font-family:var(--font-mono);font-size:.59rem;color:${n.c};margin-top:2px">${n.sub}</div>
        </div>`;
      card.addEventListener('mouseenter',()=>{ card.style.borderColor=n.c; card.style.background=hexA2(n.c,0.05); });
      card.addEventListener('mouseleave',()=>{ card.style.borderColor=hexA2(n.c,0.25); card.style.background='var(--bg-surface)'; });
      card.addEventListener('click', () => {
        GSP.open({
          color: n.c, cat: n.cat, title: n.lbl, sub: n.sub,
          sections: [
            { label:'In Plain English', type:'prose', body: n.plain },
            { label:'Technical Detail', type:'prose', body: n.tech },
            { label:'Why This Design?', type:'prose', body: `<em>${n.why}</em>` },
            { label:'Security Controls', type:'list', body: n.controls },
          ]
        });
      });
      zone.appendChild(card);
    });
    grid.appendChild(zone);
  });
  gridWrap.querySelector('.card-body').appendChild(grid);
  wrap.appendChild(gridWrap);

  // Original OIDC diagrams
  const origWrap = document.createElement('div');
  origWrap.className = 'card';
  origWrap.innerHTML = '<div class="card-hdr"><div class="card-hdr-accent"></div>OIDC+PKCE Sequence Flow &amp; Zero-Trust Boundary Zones</div><div class="card-body" style="padding:0"></div>';
  origWrap.querySelector('.card-body').appendChild(existing.cloneNode(true));
  wrap.appendChild(origWrap);
  panel.innerHTML = ''; panel.appendChild(wrap);
}

// ══════════════════════════════════════════════════════════════════════════════
// DATA LAYER — DB schema tables added
// ══════════════════════════════════════════════════════════════════════════════
const DATA_STORES = {
  PG:{ icon:'🗄', lbl:'Azure PostgreSQL Flexible', sub:'ZRS · PITR · WAL CDC · Primary ODS', c:'#16a34a',
    plain:'The primary transactional database. Stores all real-time operational data — draft applications, saga state, idempotency ledger, consent records, case references.',
    tech:'PostgreSQL Flexible Server ZRS. Cross-region read replica in Region B (WAL, RPO ≤5min). PgBouncer pooler. Flyway versioned migrations. Debezium reads WAL → Event Hubs → Bronze.',
    why:'ACID transactions are non-negotiable: "submit" must atomically create the case record, write the idempotency key, and emit the audit receipt.',
    decisions:['ZRS → 99.99% SLA; zone failure = no failover','PITR → any-second restore for audit scenarios','Flexible Server → in-place major version upgrades, cross-region replicas','WAL CDC → zero application instrumentation; Debezium reads DB log'],
    tables:[
      { icon:'📋', name:'applications', rows:['<code>id</code> UUID PK · <code>owner_subject_hash</code> · <code>service_type</code> · <code>status</code> ENUM · <code>created_at</code> · <code>submitted_at</code> · <code>case_ref</code>','<code>idempotency_key</code> VARCHAR(64) UNIQUE · <code>channel</code> · <code>locale</code>'] },
      { icon:'📝', name:'application_drafts', rows:['<code>id</code> UUID · <code>application_id</code> FK · <code>form_data</code> JSONB (encrypted at rest) · <code>schema_version</code>','<code>last_saved_at</code> · <code>prefill_source</code> · <code>prefill_etag</code>'] },
      { icon:'✅', name:'consents', rows:['<code>id</code> UUID PK · <code>subject_hash</code> · <code>purpose_id</code> · <code>scopes_granted</code> TEXT[] · <code>granted_at</code>','<code>expires_at</code> · <code>withdrawn_at</code> · <code>receipt_id</code> → audit blob','<code>corr_id</code> · <code>channel</code>'] },
      { icon:'🔑', name:'idempotency_ledger', rows:['<code>key</code> VARCHAR(64) PK · <code>operation</code> · <code>owner_hash</code> · <code>response_status</code> INT','<code>response_body</code> JSONB · <code>created_at</code> · <code>expires_at</code> (TTL 24h)'] },
      { icon:'📦', name:'saga_instances', rows:['<code>id</code> UUID PK · <code>application_id</code> FK · <code>state</code> JSONB · <code>current_step</code>','<code>retries</code> INT · <code>last_error</code> TEXT · <code>created_at</code> · <code>updated_at</code>'] },
      { icon:'📄', name:'document_receipts', rows:['<code>id</code> UUID PK · <code>application_id</code> FK · <code>blob_url</code> · <code>sha256</code>','<code>mime_type</code> · <code>av_scanned_at</code> · <code>av_result</code> · <code>uploaded_at</code>'] },
      { icon:'🏢', name:'case_references', rows:['<code>id</code> UUID PK · <code>application_id</code> FK · <code>case_system_ref</code> · <code>submitted_at</code>','<code>case_worker_id</code> · <code>status_last_updated</code>'] },
    ]
  },
  COSMOS:{ icon:'🌍', lbl:'Azure Cosmos DB', sub:'Multi-Region · Change Feed · Read Models', c:'#16a34a',
    plain:'Globally distributed NoSQL for read-optimised data — application status snapshots and document metadata that the portal polls frequently.',
    tech:'Cosmos DB API for NoSQL. Two-region active-active. Session consistency. Change Feed → Azure Functions → Bronze Delta Lake. TTL per container for expiring drafts.',
    why:'CQRS: Cosmos handles reads (status checks), PostgreSQL handles writes. Portal polling never generates load on the transactional DB.',
    decisions:['CQRS → read/write separation','Session consistency → user always sees own writes, lower cost than Strong','Change Feed → lakehouse ingestion < 30s latency, no polling','Multi-region active-active → read models available even during Region A outage'],
    tables:[
      { icon:'📊', name:'application_status (container)', rows:['<code>id</code> (application_id) · <code>ownerId</code> (subject_hash) · <code>serviceType</code> · <code>status</code>','<code>submittedAt</code> · <code>caseRef</code> · <code>lastUpdated</code> · <code>channel</code> · <code>_ts</code>','Partition key: <code>/ownerId</code> — ensures citizen reads only scan own partition'] },
      { icon:'📋', name:'form_schemas (container)', rows:['<code>id</code> (schema_id) · <code>serviceType</code> · <code>version</code> · <code>schema</code> OBJECT','<code>uiRules</code> · <code>effectiveFrom</code> · <code>locale</code> · <code>ttl</code> (24h for draft)','Partition key: <code>/serviceType</code>'] },
      { icon:'🔔', name:'webhook_events (container)', rows:['<code>id</code> (event_id) · <code>eventType</code> (esign.completed, payment.confirmed) · <code>applicationId</code>','<code>payload</code> OBJECT · <code>receivedAt</code> · <code>processedAt</code> · <code>nonce</code>','TTL: 72h · Partition key: <code>/applicationId</code>'] },
    ]
  },
  REDIS:{ icon:'⚡', lbl:'Redis Enterprise', sub:'MDM ETag/TTL Cache · Session · Once-Only', c:'#0891b2',
    plain:'In-memory cache implementing the Once-Only Principle. Cached registry responses served in <5ms — no registry call made within TTL.',
    tech:'Azure Cache for Redis Enterprise (E10 clustered). Geo-replication to Region B. Key schema: mdm:{NIDhash}:{registryId} → JSON + ETag. Per-registry TTL: civil 48h, address 24h, business 4h, tax 1h.',
    why:'Without caching, 600 RPS prefill = up to 3,600 registry calls/second — exceeding all six registry rate limits simultaneously.',
    decisions:['Redis Enterprise → geo-replication, higher throughput, Redis Modules','ETag invalidation → event-driven freshness < 60s after SoR change','Per-registry TTL → business changes hourly; civil changes yearly','Nonce store in Redis → O(1) anti-replay check, TTL auto-expires used nonces'],
    tables:[
      { icon:'🗂', name:'Key namespace: mdm:{hash}:{registryId}', rows:['Value: canonical DTO JSON + ETag header value · TTL: per registry (48h–1h)','Registries: civil, address, business, license, tax, land','Example: <code>mdm:a3f9...:civil</code> → {name, dob, nin_hash, retrievedAt}','Example: <code>mdm:a3f9...:address</code> → {street, postcode, municipality}'] },
      { icon:'🔐', name:'Key namespace: nonce:{nonce}', rows:['Value: "1" · TTL: 10 min · Anti-replay for webhook callbacks','Example: <code>nonce:wh_abc123xyz</code> → SET NX EX 600'] },
      { icon:'🎫', name:'Key namespace: session:{token_hash}', rows:['Value: {subjectHash, role, acr, issuedAt} · TTL: 15 min','Used for portal server-side session if applicable'] },
      { icon:'🚦', name:'Key namespace: rl:{ip}:{window}', rows:['Value: counter INT · TTL: sliding window (60s)','Rate-limit counters for APIM backup throttle'] },
    ]
  },
  BLOB:{ icon:'📁', lbl:'Azure Blob (WORM + Docs)', sub:'Documents · Audit Receipts · Immutable · GRS', c:'#dc2626',
    plain:'Permanent file storage for citizen-uploaded documents (AV-scanned) and legally immutable audit receipts.',
    tech:'Two containers: (1) documents: standard tier, Event Grid AV scan, SHA-256 in metadata, 180-day lifecycle for unsubmitted drafts. (2) audit: WORM immutability, 7–10y retention, GRS. JWS-signed receipts.',
    why:'WORM storage is a legal requirement — records must be tamper-evident and un-deletable by anyone, including platform operators.',
    decisions:['WORM immutability → tamper-evident by design, not policy','GRS for audit → cross-region durability for 7+ year legal retention','Event Grid AV trigger → guaranteed scan on every upload','SHA-256 in metadata → detect silent blob corruption without reading full file'],
    tables:[
      { icon:'📎', name:'documents/ container (path structure)', rows:['<code>documents/{applicationId}/{documentId}/{filename}</code>','Metadata: <code>x-ms-meta-sha256</code>, <code>x-ms-meta-application-id</code>, <code>x-ms-meta-mime-type</code>','Metadata: <code>x-ms-meta-av-result</code> (CLEAN/INFECTED), <code>x-ms-meta-uploaded-by</code>'] },
      { icon:'🔒', name:'audit/ container (WORM, path structure)', rows:['<code>audit/{year}/{month}/{day}/{corrId}.jws</code>','JWS payload: {eventType, corrId, subjectHash, timestamp, data_hash, platform_version}','Event types: consent.granted, consent.withdrawn, application.submitted, document.uploaded, case.created'] },
    ]
  },
  BRONZE:{ icon:'🥉', lbl:'Bronze — Raw Landing', sub:'Delta Lake · Append-Only · Full Provenance', c:'#7c3aed',
    plain:'Permanent, unmodified copy of every database event. Nothing is transformed, deleted, or overwritten.',
    tech:'Delta Lake on Fabric OneLake (ADLS Gen2). Append-only, partitioned by source and event_date. Schema-on-read. Populated by Debezium → Event Hubs → Spark Structured Streaming.',
    why:'Bronze is an insurance policy for all downstream transforms and provides complete audit lineage.',
    decisions:['Append-only → true historical record, replay capability','Schema-on-read → survives registry API schema changes without pipeline rewrites','Indefinite retention → legal archive','Delta Lake → ACID, schema enforcement, time-travel queries'],
    tables:[
      { icon:'📥', name:'bronze.pg_cdc_events (Delta)', rows:['<code>_source</code> STRING (postgres) · <code>_table</code> STRING · <code>_op</code> (c/u/d) · <code>_ts_ms</code> BIGINT','<code>_corrId</code> STRING · <code>before</code> STRUCT (nullable) · <code>after</code> STRUCT','Partitioned by: <code>_table</code>, <code>event_date</code>'] },
      { icon:'📥', name:'bronze.cosmos_change_feed (Delta)', rows:['<code>_source</code> STRING (cosmos) · <code>_container</code> STRING · <code>_op</code> · <code>_ts</code>','<code>document</code> VARIANT/STRUCT (full Cosmos document)','Partitioned by: <code>_container</code>, <code>event_date</code>'] },
      { icon:'📥', name:'bronze.registry_adapter_calls (Delta)', rows:['<code>corrId</code> · <code>adapterId</code> · <code>registryId</code> · <code>subjectHash</code>','<code>requestTs</code> · <code>responseTs</code> · <code>httpStatus</code> · <code>cacheHit</code> BOOLEAN','<code>responsePayloadHash</code> (not payload itself) · <code>event_date</code>'] },
    ]
  },
  SILVER:{ icon:'🥈', lbl:'Silver — Cleansed & Conformed', sub:'PII Redaction · De-dup · DQ Rules', c:'#7c3aed',
    plain:'The cleaned layer. De-duplicated records with PII tokenised, consistent types, and DQ rules applied.',
    tech:'Delta Lake. Databricks/Fabric Spark incremental MERGE. Presidio NLP for PII detection — tokenises NIN, name, DOB with salted HMAC. Schema-on-write.',
    why:'Separating PII redaction into Silver means Gold/Fabric Warehouse never contain raw PII — GDPR compliance by architecture.',
    decisions:['PII tokenisation > deletion → preserves join key (hashed NIN) for analytics without exposing identity','Incremental MERGE > full rebuild → 100× faster at scale','Quarantine bucket → bad data visible and fixable','Soft vs hard DQ → hard quarantined; soft annotated — analytics remain usable'],
    tables:[
      { icon:'🧹', name:'silver.applications (Delta)', rows:['<code>id</code> · <code>owner_token</code> (HMAC of subject_hash) · <code>service_type</code> · <code>status</code>','<code>channel</code> · <code>submitted_date</code> (date only, not time) · <code>case_ref</code>','<code>dq_flags</code> ARRAY · <code>event_date</code>'] },
      { icon:'🧹', name:'silver.consents (Delta)', rows:['<code>id</code> · <code>subject_token</code> (HMAC) · <code>purpose_id</code> · <code>scopes_granted</code> ARRAY','<code>granted_at</code> · <code>expires_at</code> · <code>withdrawn_at</code> · <code>event_date</code>','No raw NIN, name, or DOB in this table — Presidio has tokenised all PII fields'] },
      { icon:'🧹', name:'silver.registry_calls (Delta)', rows:['<code>corr_id</code> · <code>adapter_id</code> · <code>registry_id</code> · <code>subject_token</code>','<code>request_ts</code> · <code>response_ts</code> · <code>latency_ms</code> · <code>cache_hit</code> · <code>http_status</code>','<code>dq_flag</code> (BOOLEAN) · <code>event_date</code>'] },
    ]
  },
  GOLD:{ icon:'🏆', lbl:'Gold — Curated & Aggregated', sub:'Star Schema · KPIs · SLO Metrics · RLS', c:'#7c3aed',
    plain:'Analytics-ready dimensional models and pre-aggregated KPIs designed for fast BI queries.',
    tech:'Delta Lake. Star schema: fact_applications, fact_prefill_requests, dim_services, dim_channels, dim_time. Pre-aggregated P50/P95 latency (rolling 1h/24h/7d). Purview lineage. RLS.',
    why:'Pre-aggregating avoids scanning billions of Silver rows to compute P95 latency. Star schema reduces join complexity for Power BI.',
    decisions:['Star schema > normalised → fewer joins = faster BI queries','Pre-aggregated SLO metrics → Power BI renders without scanning raw events','RLS at Fabric → one dataset, multiple secure views','Purview lineage → every KPI traceable to raw source event for GDPR audit'],
    tables:[
      { icon:'⭐', name:'gold.fact_applications (Delta)', rows:['<code>application_sk</code> INT · <code>date_sk</code> · <code>service_sk</code> · <code>channel_sk</code>','<code>submit_latency_ms</code> · <code>prefill_latency_ms</code> · <code>cache_hit_count</code> · <code>adapters_called</code>','<code>consent_granted</code> BOOLEAN · <code>dq_flag_count</code> · <code>status_final</code>'] },
      { icon:'⭐', name:'gold.fact_prefill_requests (Delta)', rows:['<code>request_sk</code> · <code>date_sk</code> · <code>adapter_sk</code> · <code>cache_hit</code>','<code>latency_ms</code> · <code>http_status</code> · <code>circuit_breaker_state</code>'] },
      { icon:'📐', name:'gold.dim_services / dim_channels / dim_time', rows:['<code>dim_services</code>: service_sk, service_type, department, description','<code>dim_channels</code>: channel_sk, channel (web/mobile/kiosk), locale','<code>dim_time</code>: date_sk, date, hour, week, month, quarter, year'] },
      { icon:'📈', name:'gold.agg_slo_metrics (Delta, pre-computed)', rows:['<code>window_end</code> · <code>window_size</code> (1h/24h/7d) · <code>service_type</code>','<code>p50_ms</code> · <code>p95_ms</code> · <code>p99_ms</code> · <code>error_rate</code> · <code>request_count</code>','<code>cache_hit_rate</code> · <code>cb_open_count</code> · <code>consent_denial_count</code>'] },
    ]
  },
  FABWH:{ icon:'🏢', lbl:'Fabric Warehouse', sub:'Direct Lake · T-SQL · Semantic Models · RLS', c:'#7c3aed',
    plain:'SQL interface to the lakehouse. Analysts run standard T-SQL against Gold Delta data with millisecond response via Direct Lake.',
    tech:'Microsoft Fabric Warehouse, Direct Lake mode. T-SQL interface. Semantic models (Power BI datasets). RLS policies by role. Deployment pipelines (Dev→Test→Prod).',
    why:'Direct Lake eliminates the import-into-warehouse step. Data written to Gold Delta is immediately queryable — no ETL refresh window.',
    decisions:['Direct Lake > Import mode → zero latency between Delta commit and SQL query','Fabric > Synapse Dedicated Pool → serverless billing, Direct Lake native','T-SQL → familiar to existing data analysts','Centralised semantic models → one definition of P95 shared by all Power BI reports'],
    tables:[
      { icon:'🔍', name:'Views exposed via T-SQL (over Gold Delta)', rows:['<code>vw_application_summary</code>: joins fact_applications + dims, RLS on channel_sk','<code>vw_slo_current</code>: latest 1h window from agg_slo_metrics per service_type','<code>vw_adapter_health</code>: cache_hit_rate, cb_state, error_rate per adapter','<code>vw_consent_metrics</code>: consent granted/denied/expired counts per purpose_id, date'] },
    ]
  },
  PBI:{ icon:'📊', lbl:'Power BI (Fabric)', sub:'Dashboards · Embedded · Direct Lake · RLS', c:'#7c3aed',
    plain:'Reporting and dashboard layer — Journey Health (SRE), Adapter Health, DQ Monitor, DR Readiness, FinOps.',
    tech:'Power BI Embedded in Fabric workspace. Direct Lake refresh. RLS policy by role. 5-min auto-refresh for SRE dashboards.',
    why:'Natively integrated with Fabric via Direct Lake — no connector, no API key, no ETL extract. One semantic model serves all roles.',
    decisions:['Direct Lake → dashboards update within 5 min of new data','Semantic model sharing → one source of truth for KPI definitions','Fabric-native → unified governance, lineage, access control'],
    tables:[
      { icon:'📊', name:'Semantic model measures (Power BI)', rows:['<code>P95 Prefill Latency</code> = PERCENTILEX.INC(fact_prefill_requests, latency_ms, 0.95)','<code>Error Rate %</code> = DIVIDE(COUNTROWS(FILTER(fact_applications, status_final="ERROR")), COUNTROWS(fact_applications))','<code>Cache Hit Rate</code> = DIVIDE(SUM(cache_hit_count), SUM(request_count))','<code>SLO Compliance</code> = IF([P95 Prefill Latency] <= 600, "✅", "🔴")'] },
    ]
  },
  PURVIEW:{ icon:'🔍', lbl:'Microsoft Purview', sub:'Data Catalog · Lineage · PII Classification', c:'#7c3aed',
    plain:'Data governance layer — auto-scans all stores for personal data, tracks lineage Bronze→Silver→Gold→Fabric→PBI, enforces retention.',
    tech:'Purview Data Map. Auto-scan PostgreSQL, Cosmos, Blob, Delta Lake, Fabric. PII rules: NIN, IBAN, full name, DOB → sensitivity labels. Lineage API. DLP alerts.',
    why:'GDPR Subject Access Requests require responding within 30 days. Purview automates: one search identifies every record containing a given subjectHash.',
    decisions:['Automated scanning > manual cataloguing → at scale, manual classification is always stale','Lineage as compliance evidence → regulators accept Purview lineage','DLP on Gold → catches accidental PII leakage from a flawed Silver transform','Retention enforcement → system auto-deletes; humans cannot forget'],
    tables:[
      { icon:'🗂', name:'Purview scanned assets (auto-catalogued)', rows:['PostgreSQL: applications, consents, idempotency_ledger, saga_instances, document_receipts','Cosmos: application_status, form_schemas, webhook_events','Blob: documents/ container, audit/ container (WORM)','Delta Bronze: pg_cdc_events, cosmos_change_feed, registry_adapter_calls','Delta Silver: applications, consents, registry_calls','Delta Gold: fact_*, dim_*, agg_slo_metrics','Fabric Warehouse: all views + semantic model measures'] },
    ]
  },
};

function buildDataLayerEnhanced() {
  const panel = document.getElementById('panel-data');
  if (!panel) return;
  const existing = panel.querySelector('.two-col');
  if (!existing) return;
  const outer = document.createElement('div');
  outer.style.cssText = 'padding:16px 20px';

  const intro = document.createElement('div');
  intro.className = 'card'; intro.style.marginBottom = '16px';
  intro.innerHTML = `<div class="card-hdr"><div class="card-hdr-accent"></div>Data Architecture — Click any store for purpose, tables, tech spec &amp; design rationale</div>
    <div class="card-body" style="font-size:.81rem;color:var(--text-2);line-height:1.75">Six distinct data technologies, each chosen for a specific job. Click any store to see <em>what tables live there</em>, why it was selected over alternatives, and its precise technical configuration.</div>`;
  outer.appendChild(intro);

  const left = document.createElement('div');
  left.className = 'card'; left.style.marginBottom = '16px';
  left.innerHTML = '<div class="card-hdr"><div class="card-hdr-accent"></div>Data Stores — Click any to open detail panel</div><div class="card-body" style="padding:12px"></div>';
  const body = left.querySelector('.card-body');

  function section(title) {
    const d = document.createElement('div');
    d.style.cssText = 'font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:12px 0 7px;padding-bottom:3px;border-bottom:1px solid var(--border)';
    d.textContent = title; return d;
  }
  function nodeRow(ids, cols) {
    const row = document.createElement('div');
    row.style.cssText = `display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;margin-bottom:4px`;
    ids.forEach(id => {
      const n = DATA_STORES[id];
      const card = document.createElement('div');
      card.style.cssText = `background:var(--bg-surface);border:1.5px solid ${hexA2(n.c,0.3)};border-radius:var(--r-lg);padding:10px 10px 8px;cursor:pointer;position:relative;overflow:hidden;transition:all .15s`;
      card.innerHTML = `<div style="position:absolute;top:0;left:0;right:0;height:3px;background:${n.c};opacity:.7"></div>
        <div style="font-size:1rem;margin-bottom:3px">${n.icon}</div>
        <div style="font-size:.71rem;font-weight:700;color:var(--text-1);line-height:1.3;margin-bottom:2px">${n.lbl}</div>
        <div style="font-family:var(--font-mono);font-size:.58rem;color:${n.c}">${n.sub}</div>`;
      card.addEventListener('mouseenter',()=>{ card.style.borderColor=n.c; card.style.background=hexA2(n.c,0.05); });
      card.addEventListener('mouseleave',()=>{ card.style.borderColor=hexA2(n.c,0.3); card.style.background='var(--bg-surface)'; });
      card.addEventListener('click',()=>{
        GSP.open({
          color: n.c, cat: 'Data Store', title: n.lbl, sub: n.sub,
          sections: [
            { label:'In Plain English', type:'prose', body: n.plain },
            { label:'Technical Specification', type:'prose', body: n.tech },
            { label:'Why This Technology?', type:'prose', body: `<em>${n.why}</em>` },
            { label:'Key Design Decisions', type:'list', body: n.decisions },
            { label:'Tables & Data Schema', type:'tables', body: n.tables },
          ]
        });
      });
      row.appendChild(card);
    });
    return row;
  }

  body.appendChild(section('OLTP — Real-Time Transactional'));
  body.appendChild(nodeRow(['PG','COSMOS','REDIS'], 3));
  body.appendChild(section('Documents & Audit (Immutable)'));
  body.appendChild(nodeRow(['BLOB'], 1));
  body.appendChild(section('Analytics Lakehouse — Delta Medallion'));
  body.appendChild(nodeRow(['BRONZE','SILVER','GOLD'], 3));
  body.appendChild(section('Analytics & Governance'));
  body.appendChild(nodeRow(['FABWH','PBI','PURVIEW'], 3));

  const flowNote = document.createElement('div');
  flowNote.style.cssText = 'text-align:center;font-size:.69rem;color:var(--text-3);padding:8px;background:var(--bg-elevated);border-radius:var(--r-md);border:1px solid var(--border);font-family:var(--font-mono);margin-top:10px';
  flowNote.innerHTML = 'PostgreSQL WAL → Debezium → Event Hubs → Bronze → Silver (PII redact) → Gold (dims/KPIs) → Fabric Warehouse → Power BI &nbsp;·&nbsp; Purview governs all layers';
  body.appendChild(flowNote);

  outer.appendChild(left);

  const origWrap = document.createElement('div');
  origWrap.className = 'card';
  origWrap.innerHTML = '<div class="card-hdr"><div class="card-hdr-accent"></div>Data Flow Diagrams</div><div class="card-body" style="padding:0"></div>';
  origWrap.querySelector('.card-body').appendChild(existing.cloneNode(true));
  outer.appendChild(origWrap);
  panel.innerHTML = ''; panel.appendChild(outer);
}

// ══════════════════════════════════════════════════════════════════════════════
// TELEMETRY — SVG diagram, GSP for node details
// ══════════════════════════════════════════════════════════════════════════════
const TEL_COMP = [
  {id:'S_PORTAL', x:10,  y:40,  w:168,h:44,c:'#3b82f6',lbl:'Portal & Channels',  sub:'traceparent · corrId · No PII'},
  {id:'S_APIM',   x:10,  y:97,  w:168,h:44,c:'#f97316',lbl:'APIM Premium',        sub:'Policy latency · JWT abuse'},
  {id:'S_FACADE', x:10,  y:154, w:168,h:44,c:'#8b5cf6',lbl:'API Facade',          sub:'Idempotency hits · Errors'},
  {id:'S_ORCH',   x:10,  y:211, w:168,h:44,c:'#3b82f6',lbl:'Orchestrator',        sub:'Saga spans · CB states · DLQ'},
  {id:'S_SEC',    x:10,  y:268, w:168,h:44,c:'#06b6d4',lbl:'SEC / Consent Gate',  sub:'Grant/Deny/Expire'},
  {id:'S_ADAPT',  x:10,  y:325, w:168,h:44,c:'#22c55e',lbl:'Registry Adapters ×6',sub:'Per-adapter latency · cache hit'},
  {id:'S_SB',     x:10,  y:382, w:168,h:44,c:'#f59e0b',lbl:'Service Bus',         sub:'Queue depth · DLQ age'},
  {id:'S_PG',     x:10,  y:439, w:168,h:44,c:'#22c55e',lbl:'PostgreSQL ODS',      sub:'Query P95 · replication lag'},
  {id:'S_REDIS',  x:10,  y:496, w:168,h:44,c:'#06b6d4',lbl:'Redis Enterprise',    sub:'Cache hit-rate ≥80%'},
  {id:'C_OTEL',   x:215, y:220, w:182,h:44,c:'#f97316',lbl:'OTel Collector',       sub:'Sampling · Batch · Export'},
  {id:'C_HEAD',   x:215, y:277, w:182,h:44,c:'#f97316',lbl:'Head Sampling',        sub:'10% default · 100% errors'},
  {id:'C_TAIL',   x:215, y:334, w:182,h:44,c:'#f97316',lbl:'Tail Sampling',        sub:'2×SLO latency → 100%'},
  {id:'ST_AI',    x:435, y:40,  w:182,h:44,c:'#8b5cf6',lbl:'App Insights',         sub:'Traces · Metrics · Availability'},
  {id:'ST_LA',    x:435, y:110, w:182,h:44,c:'#8b5cf6',lbl:'Log Analytics',        sub:'Structured Logs · KQL · corrId'},
  {id:'O_SLO',    x:658, y:40,  w:182,h:44,c:'#8b5cf6',lbl:'SLO Burn-Rate Alerts', sub:'14× / 6× multi-window'},
  {id:'O_KQL',    x:658, y:110, w:182,h:44,c:'#8b5cf6',lbl:'KQL Dashboards',       sub:'P50/P95 · Error rate'},
  {id:'O_SENT',   x:658, y:200, w:182,h:44,c:'#ef4444',lbl:'Sentinel SIEM',        sub:'Anomaly · KQL rules · SOAR'},
  {id:'O_SOAR',   x:658, y:260, w:182,h:44,c:'#ef4444',lbl:'SOAR Playbook',        sub:'Auto-block · Enrich · Ticket'},
  {id:'O_PBI',    x:658, y:370, w:182,h:44,c:'#8b5cf6',lbl:'Power BI Dashboards',  sub:'Journey · Adapter · DR'},
  {id:'O_SCHEMA', x:658, y:440, w:182,h:44,c:'#3b82f6',lbl:'Canonical Log Schema', sub:'JSON · traceparent · PII-stripped'},
];


const TEL_DETAIL = {
  S_PORTAL:{ t:'Portal & Channels', plain:'The browser/app injects W3C traceparent and a UUID v4 x-correlation-id into every XHR request. No PII is ever included in telemetry — subjectId is SHA-256 hashed.', signals:['W3C traceparent on every XHR','x-correlation-id UUID v4 per user action','PerformanceObserver: TTFB, FCP, LCP → App Insights','No raw PII: subjectId is SHA-256 hashed'], metrics:['Page load P95 < 2s','XHR error rate per route/channel','Client JS exception rate'] },
  S_APIM:{ t:'APIM Premium', plain:'APIM emits per-request diagnostics — method, route, status, latency, JWT claims subset. Rate-limit hit events go to Log Analytics.', signals:['Diagnostics: method, route, status, latencyMs, backendId','JWT claims subset (iss, aud, acr, scopes) — sub NEVER logged','Rate-limit hit events (429) → Log Analytics','Policy execution time: inbound + backend + outbound phases'], metrics:['APIM policy exec P95 < 150ms','4xx rate per API product (alert on 5% threshold)','Backend latency per origin'] },
  S_FACADE:{ t:'API Facade', plain:'Facade emits OTel spans for each handler step. All problem+json fault events are logged with problemCode and corrId for correlation.', signals:['OTel spans: validate_request, idempotency_check, build_command, route','traceparent + x-correlation-id forwarded to Orchestrator','problem+json fault events: problemCode, httpStatus, corrId','Idempotency hit/miss counter per operation type'], metrics:['Facade handler P95 < 100ms (NFR-01)','problem+json 4xx breakdown by problemCode','Schema validation failure rate per API version'] },
  S_ORCH:{ t:'Orchestrator', plain:'Orchestrator emits a distributed OTel span for every saga step. Circuit breaker state changes and DLQ park events are emitted as structured logs.', signals:['Distributed OTel span per saga step: consent_check, adapter_fan_out, map_validate, rules_eval','Consent gate outcome: subjectHash, purposeId, outcome (GRANT/DENY/EXPIRE)','Circuit breaker state change events per adapterId','DLQ park events: messageId, reason, retryCount, payload_hash (no PII)'], metrics:['Handler P95 < 300ms (NFR-01)','Consent gate denial rate SLO = 0 (NFR-11)','CB open duration per adapter (alert > 5 min)','DLQ age alert > 4h (NFR-24)'] },
  S_SEC:{ t:'SEC / Consent Gate', plain:'Every consent evaluation is logged with subject hash, purpose, scopes requested, and outcome. ABAC denials and step-up triggers are always emitted.', signals:['Every evaluation: subjectHash, purposeId, scopesRequested[], outcome, latencyMs','ABAC denial events: callerRole, resourceType, reason','Step-up auth triggers: callerACR, requiredACR','Consent expiry warnings: TTL < 24h'], metrics:['Consent gate P95 < 50ms','ABAC denial count/hr (alert on non-zero)','consent_required error rate SLO = 0 (NFR-11)'] },
  S_ADAPT:{ t:'Registry Adapters ×6', plain:'Each adapter emits an OTel span per registry call. ETag cache hit/miss counters and circuit breaker state gauges are polled every 30s.', signals:['OTel span per registry call: adapterId, registryId, latencyMs, httpStatus, cacheHit','ETag cache hit/miss counters per adapterId/hour','Circuit breaker state gauges: 0=CLOSED, 1=OPEN, 2=HALF_OPEN','Retry attempt counters with backoff delays'], metrics:['Adapter success rate ≥99%/hr per registry (NFR-06)','P95 latency per registry (alert > 2×SLO)','MDM cache hit-rate ≥80% (NFR-16)'] },
  S_SB:{ t:'Service Bus', plain:'Service Bus queue depth and DLQ age are polled every 60s. Consumer scale-out events from KEDA are also captured.', signals:['ActiveMessageCount, DeadLetterMessageCount per queue — polled every 60s','DLQ oldest message age → alert if > 4h','KEDA scale-out events (pod count changes)'], metrics:['Queue depth P95 < 2s lag (NFR-24)','DLQ age alert > 4h','Message delivery success > 99.9%'] },
  S_PG:{ t:'PostgreSQL ODS', plain:'pg_stat_statements exports query performance metrics. Replication lag to Region B is monitored for RPO SLO compliance.', signals:['pg_stat_statements: query hash, mean_exec_time, calls, rows','Lock wait events and deadlock detection','Replication lag to Region B replica (bytes → seconds)','PgBouncer pool utilisation and connection wait time'], metrics:['Query P95 < 50ms reads / < 200ms writes (NFR-08)','Replication lag ≤ 5 min (RPO SLO, NFR-07)','Connection pool saturation < 80%'] },
  S_REDIS:{ t:'Redis Enterprise', plain:'Redis INFO stats are polled every 30s for cache hit-rate per key prefix. LRU eviction of MDM keys triggers a critical alert.', signals:['Cache hit/miss rate per key prefix (mdm:, session:, nonce:) — polled 30s','LRU eviction events — alert if MDM key evicted','Geo-replication lag to Region B','Cluster failover events'], metrics:['MDM cache hit-rate ≥80% (NFR-16)','Eviction alert: any eviction of mdm: prefix = critical','Geo-replication lag < 30s (DR readiness)'] },
  C_OTEL:{ t:'OTel Collector (Gateway Mode)', plain:'The OTel Collector is the centralised point for all telemetry — it samples, batches, and exports to App Insights and Log Analytics.', signals:['Span ingestion rate — alert on drop > 1%','Export queue saturation (alert > 80% full)','Sampling decision log: spans kept vs dropped/sec','Trace context validation: reject spans without valid traceparent'], metrics:['Collector queue saturation < 80%','Export success rate > 99.9%','Error span capture rate = 100%'] },
  C_HEAD:{ t:'Head-Based Sampling', plain:'10% default sample rate for healthy requests. 100% for errors and canary deployments — full visibility on every release without drowning in noise.', signals:['10% default, configurable per service','100% for x-error:1 header (fast error path)','100% for x-canary:1 header (new deployment)','Per-journey override: 100% during incident investigation'], metrics:['Sample rate per service/hour','Error capture rate = 100%','Canary traffic fully visible in App Insights'] },
  C_TAIL:{ t:'Tail-Based Sampling', plain:'After a trace is complete, if any span has P95 latency > 2× SLO or any error, the entire trace is elevated to 100% capture — ensuring no slow or failed request is missed.', signals:['Elevate to 100% when any span P95 > 2× SLO','Elevate to 100% when any error span in complete trace','Reservoir sampling for background traffic (10%)'], metrics:['Coverage of slow/error traces = 100%','OTel buffer utilisation during high-latency events < 80%'] },
  ST_AI:{ t:'App Insights', plain:'The distributed trace store. All spans from all services appear in one trace view, enabling cross-service latency attribution in seconds.', signals:['Full distributed trace with span hierarchy','Custom metrics: prefill_latency_ms, consent_gate_outcome, cb_state, cache_hit_rate','Availability tests: synthetic auth→prefill→submit every 1 min from 3 regions','Dependency tracking: all downstream HTTP/SQL/Redis auto-instrumented'], metrics:['Availability test success ≥99.9% (NFR-01)','Trace ingestion rate vs sampling budget','Custom metric cardinality < 200 per service'] },
  ST_LA:{ t:'Log Analytics Workspace', plain:'All structured JSON logs from all services land here — PII-stripped at source. corrId and traceparent are indexed for instant cross-service lookup.', signals:['All structured JSON logs (PII-stripped at source)','KQL workspace for SLO dashboards and Sentinel analytics rules','corrId and traceparent indexed: lookup any event in < 1s','Log retention: 90 days hot, 12 months archive'], metrics:['Log ingestion lag < 1 min','KQL query response time < 10s','corrId lookup completeness = 100%'] },
  O_SLO:{ t:'SLO Burn-Rate Alerts', plain:'Multi-window burn-rate algorithm from the Google SRE book. Two alert windows catch both sudden spikes (fast) and sustained degradation (slow) without excessive paging.', signals:['Fast: 14× burn rate over 5 min AND 1 hour → page immediately','Slow: 6× burn rate over 30 min AND 6 hour → page (sustained degradation)','Error budget: 43.8 min/month for 99.9% SLO'], metrics:['Alert latency < 5 min','False positive rate < 5% (monthly tuning)','MTTR P1 ≤ 30 min (NFR-30)'] },
  O_KQL:{ t:'KQL Dashboards', plain:'KQL dashboards in Log Analytics cover journey health, adapter health, queue metrics, and DR readiness indicators — all refreshing every < 5 minutes.', signals:['Journey Health: P50/P95 trend (1h/24h/7d), error rate, funnel drop-off','Adapter Health: CB state heatmap, throttle rate, latency scatter','Queue & Retries: SB depth over time, DLQ reason distribution','DR Readiness: Postgres replica lag gauge, Cosmos region status'], metrics:['Dashboard refresh < 5 min','SLO compliance: 🟢/🟡/🔴 per journey','MDM cache hit-rate 7-day trend visible'] },
  O_SENT:{ t:'Sentinel SIEM', plain:'Sentinel ingests all Log Analytics data and runs KQL-based analytics rules to detect attacks, with AI Fusion correlating low-signal events into high-confidence incidents.', signals:['KQL: impossible_travel (>500km/h between requests)','KQL: brute_force (>5 PKCE failures/min same IP)','KQL: webhook_replay (Redis nonce reuse > 0)','AI Fusion: correlates multiple low-severity anomalies'], metrics:['Detection latency < 15 min for L1 rules','FP rate < 5% (monthly tuning)','P1 containment time ≤ 30 min (NFR-30) via SOAR'] },
  O_SOAR:{ t:'SOAR Logic App Playbook', plain:'On a Sentinel brute-force incident, the Logic App automatically extracts the source IP, adds a block rule to Front Door WAF, posts to Teams, and opens a DevOps ticket — all within 5 minutes.', signals:['Trigger: Sentinel L1 brute-force incident','Extract source IP from incident entities','Add custom block rule to Front Door WAF','Post to Teams #security-ops + open Azure DevOps ticket'], metrics:['Auto-block time < 5 min from incident creation','Playbook success rate > 99.9%'] },
  O_PBI:{ t:'Power BI Dashboards', plain:'Five dashboards give different stakeholders the view they need: SREs see live journey health; product managers see submission funnels; security sees auth anomalies.', signals:['Journey Health (SRE): P50/P95 by journey, error heatmap, 5-min refresh','Adapter Health: CB state gauge, throttle rate per registry','Data Quality: DQ violation trend, quarantine bucket size','DR Readiness: replica lag gauge, region health'], metrics:['Dashboard load < 3s (Direct Lake query)','SLO status: 🟢/🟡/🔴 per journey (used in SRE standup)','MDM cache hit-rate: 7-day rolling average'] },
  O_SCHEMA:{ t:'Canonical Log Schema', plain:'Every service MUST emit structured JSON logs conforming to the canonical schema. CI pipeline rejects non-compliant log calls. This ensures corrId and traceparent are always present for cross-service correlation.', signals:['Required fields: ts, level, svc, corrId, traceparent, env, msg','Sub-schemas for: consent_gate_checked, adapter_called, cb_state_changed, dlq_parked','PII rules: subjectId → SHA-256(salt+NIN), no name/address/DOB','Enforced at build time: JSON schema lint in CI pipeline'], metrics:['Schema compliance = 100% (CI gate)','corrId present = 100% (lint rule)','PII leak detection in CI: Presidio scan of log fixtures'] },
};


function buildTelemetryDiagram() {
  // Called at DOMContentLoaded — sets up structure only.
  // Actual SVG render deferred until tab is visible (real clientWidth).
  window._rebuildTelemetry = null; // will be set below after structure is ready

  const panel = document.getElementById('panel-telemetry');
  if (!panel) return;

  // Replace panel contents with diagram-fullpage layout matching arch tabs
  panel.innerHTML = `
    <div class="diagram-fullpage" id="tel-fullpage">
      <div class="diagram-canvas-wrap" id="tel-canvas" style="background:#ffffff">
        <div class="diagram-toolbar" id="tel-toolbar">
          <span class="diag-label">Telemetry Architecture</span>
          <button class="tool-btn" id="tel-zi">＋</button>
          <button class="tool-btn" id="tel-zo">－</button>
          <button class="tool-btn" id="tel-rs">Reset</button>
        </div>
        <div class="diagram-hint">
          <span class="s-dot"></span>&nbsp;
          Click any node for signals &amp; SLIs &nbsp;·&nbsp; Drag to pan &nbsp;·&nbsp; Scroll to zoom
        </div>
        <div id="tel-svg-wrap" style="width:100%;height:100%;position:relative"></div>
      </div>
      <aside class="diagram-sidebar">
        <div class="sidebar-hdr">
          <div class="sidebar-hdr-title">Node Details</div>
        </div>
        <div class="sidebar-body">
          <div id="tel-sidebar-empty" style="padding:24px 16px;text-align:center;color:var(--text-3);font-size:.78rem">
            <div style="font-size:1.6rem;margin-bottom:8px;opacity:.25">📡</div>
            Click any node to see its emitted signals and SLIs
          </div>
        </div>
      </aside>
    </div>`;

  // Only ever called when the Telemetry tab is clicked (panel is visible, clientWidth is real)
  window._rebuildTelemetry = function() {
    const wrap = document.getElementById('tel-svg-wrap');
    if (!wrap) return;
    _renderTelSVG(wrap);
    if (wrap._ro) return;
    wrap._ro = new ResizeObserver(() => _renderTelSVG(wrap));
    wrap._ro.observe(wrap);
  };

  // Toolbar pan/zoom state
  const state = { x:0, y:0, scale:1 };
  function applyTransform() {
    const inner = document.getElementById('tel-inner');
    if (inner) inner.setAttribute('transform', `translate(${state.x},${state.y}) scale(${state.scale})`);
  }
  window._telZoomIn  = () => { state.scale = Math.min(4, state.scale*1.2); applyTransform(); };
  window._telZoomOut = () => { state.scale = Math.max(0.2, state.scale*0.83); applyTransform(); };
  window._telReset   = () => { state.x=0; state.y=0; state.scale=1; applyTransform(); };
  document.getElementById('tel-zi').onclick = window._telZoomIn;
  document.getElementById('tel-zo').onclick = window._telZoomOut;
  document.getElementById('tel-rs').onclick = window._telReset;

  // Pan/zoom on canvas
  const canvas = document.getElementById('tel-canvas');
  let pan=false, px=0, py=0, ptx=0, pty=0;
  canvas.addEventListener('mousedown', e => {
    if (e.target.closest('.tool-btn,.diagram-toolbar')) return;
    pan=true; px=e.clientX; py=e.clientY; ptx=state.x; pty=state.y;
    canvas.style.cursor='grabbing';
  });
  document.addEventListener('mousemove', e => {
    if (!pan) return;
    state.x = ptx+(e.clientX-px); state.y = pty+(e.clientY-py);
    applyTransform();
  });
  document.addEventListener('mouseup', () => { pan=false; canvas.style.cursor='grab'; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.1 : 0.91;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX-rect.left, my = e.clientY-rect.top;
    state.x = mx + (state.x-mx)*f; state.y = my + (state.y-my)*f;
    state.scale = Math.min(4, Math.max(0.2, state.scale*f));
    applyTransform();
  }, { passive:false });
}

// ── Node definitions — IDs match TEL_DETAIL keys ──────────────────────────────
const TEL_NODES_DATA = [
  // col 0 – Portal
  { id:'S_PORTAL', label:'Web / Mobile\n/ Kiosk',         col:'#2563eb', group:'Portal & Channels', col_idx:0 },
  // col 1 – Gateway
  { id:'S_APIM',   label:'APIM Premium',                  col:'#ea580c', group:'API Gateway',        col_idx:1 },
  // col 2 – App Services
  { id:'S_FACADE', label:'API Facade',                    col:'#7c3aed', group:'App Services',       col_idx:2 },
  { id:'S_ORCH',   label:'Orchestrator',                  col:'#0891b2', group:'App Services',       col_idx:2 },
  { id:'S_ADAPT',  label:'Adapters ×6',                   col:'#16a34a', group:'App Services',       col_idx:2 },
  { id:'S_SEC',    label:'Consent Gate',                  col:'#db2777', group:'App Services',       col_idx:2 },
  // col 3 – Data
  { id:'S_SB',     label:'Service Bus',                   col:'#d97706', group:'Messaging',          col_idx:3 },
  { id:'S_REDIS',  label:'Redis MDM',                     col:'#0891b2', group:'Data Stores',        col_idx:3 },
  { id:'S_PG',     label:'PostgreSQL ODS',                col:'#16a34a', group:'Data Stores',        col_idx:3 },
  // col 4 – OTel
  { id:'C_OTEL',   label:'OTel Collector',                col:'#ea580c', group:'OTel Collection',    col_idx:4 },
  { id:'C_HEAD',   label:'Head Sampling\n10%',            col:'#ea580c', group:'OTel Collection',    col_idx:4 },
  { id:'C_TAIL',   label:'Tail Sampling\nerrors 100%',    col:'#ea580c', group:'OTel Collection',    col_idx:4 },
  // col 5 – Azure Monitor
  { id:'ST_AI',    label:'App Insights\nTraces/Metrics',  col:'#7c3aed', group:'Azure Monitor',      col_idx:5 },
  { id:'ST_LA',    label:'Log Analytics\nLogs',           col:'#7c3aed', group:'Azure Monitor',      col_idx:5 },
  // col 6 – Outputs
  { id:'O_SENT',   label:'Sentinel SIEM',                 col:'#dc2626', group:'SecOps',             col_idx:6 },
  { id:'O_SOAR',   label:'SOAR Playbook',                 col:'#dc2626', group:'SecOps',             col_idx:6 },
  { id:'O_SLO',    label:'SLO Burn-Rate\nAlerts',         col:'#ea580c', group:'Alerting',           col_idx:6 },
  { id:'O_KQL',    label:'KQL Dashboards',                col:'#7c3aed', group:'BI & Alerting',      col_idx:6 },
  { id:'O_PBI',    label:'Power BI',                      col:'#7c3aed', group:'BI & Alerting',      col_idx:6 },
  { id:'O_SCHEMA', label:'Log Schema\nPII-Minimised',     col:'#16a34a', group:'Compliance',         col_idx:6 },
];

const TEL_EDGES_DATA = [
  { s:'S_PORTAL', t:'S_APIM',   lbl:'corrId+traceparent',  col:'rgba(37,99,235,.4)',   wt:2.0 },
  { s:'S_APIM',   t:'S_FACADE', lbl:'JWT fwd',             col:'rgba(0,0,0,.22)',      wt:1.6 },
  { s:'S_FACADE', t:'S_ORCH',   lbl:'command',             col:'rgba(0,0,0,.18)',      wt:1.4 },
  { s:'S_ORCH',   t:'S_SEC',    lbl:'consent check',       col:'rgba(219,39,119,.45)', wt:1.4 },
  { s:'S_ORCH',   t:'S_ADAPT',  lbl:'adapter call',        col:'rgba(22,163,74,.45)',  wt:1.4 },
  { s:'S_ORCH',   t:'S_SB',     lbl:'publish',             col:'rgba(217,119,6,.45)',  wt:1.3 },
  { s:'S_SB',     t:'S_ORCH',   lbl:'consume',             col:'rgba(217,119,6,.35)',  wt:1.1, dashed:true },
  { s:'S_ORCH',   t:'S_REDIS',  lbl:'cache r/w',           col:'rgba(8,145,178,.4)',   wt:1.2 },
  { s:'S_ORCH',   t:'S_PG',     lbl:'write',               col:'rgba(22,163,74,.35)',  wt:1.1 },
  // OTel spans — orange, prominent
  { s:'S_PORTAL', t:'C_OTEL',   lbl:'OTel spans',          col:'rgba(234,88,12,.7)',   wt:2.0, ec:'#ea580c' },
  { s:'S_APIM',   t:'C_OTEL',   lbl:'diagnostics',         col:'rgba(234,88,12,.65)',  wt:1.8, ec:'#ea580c' },
  { s:'S_FACADE', t:'C_OTEL',   lbl:'spans/metrics',       col:'rgba(234,88,12,.65)',  wt:1.8, ec:'#ea580c' },
  { s:'S_ORCH',   t:'C_OTEL',   lbl:'spans/metrics',       col:'rgba(234,88,12,.7)',   wt:2.0, ec:'#ea580c' },
  { s:'S_ADAPT',  t:'C_OTEL',   lbl:'spans/metrics',       col:'rgba(234,88,12,.6)',   wt:1.6, ec:'#ea580c' },
  // OTel internal
  { s:'C_OTEL',   t:'C_HEAD',   lbl:'10% head sample',     col:'rgba(234,88,12,.45)',  wt:1.3 },
  { s:'C_OTEL',   t:'C_TAIL',   lbl:'error capture',       col:'rgba(234,88,12,.45)',  wt:1.3 },
  // Export to Azure Monitor — purple
  { s:'C_HEAD',   t:'ST_AI',    lbl:'traces + metrics',    col:'rgba(124,58,237,.65)', wt:2.0, ec:'#7c3aed' },
  { s:'C_TAIL',   t:'ST_LA',    lbl:'structured logs',     col:'rgba(124,58,237,.65)', wt:2.0, ec:'#7c3aed' },
  // Downstream
  { s:'ST_LA',    t:'O_SENT',   lbl:'analytic rules',      col:'rgba(220,38,38,.6)',   wt:1.7, ec:'#dc2626' },
  { s:'O_SENT',   t:'O_SOAR',   lbl:'incidents',           col:'rgba(220,38,38,.5)',   wt:1.4, ec:'#dc2626' },
  { s:'ST_AI',    t:'O_SLO',    lbl:'burn-rate',           col:'rgba(234,88,12,.55)',  wt:1.5, ec:'#ea580c' },
  { s:'ST_AI',    t:'O_KQL',    lbl:'metrics',             col:'rgba(124,58,237,.45)', wt:1.3 },
  { s:'ST_LA',    t:'O_KQL',    lbl:'logs',                col:'rgba(124,58,237,.45)', wt:1.3 },
  { s:'O_KQL',    t:'O_PBI',    lbl:'dashboards',          col:'rgba(124,58,237,.45)', wt:1.3 },
  { s:'ST_LA',    t:'O_SCHEMA', lbl:'schema enforce',      col:'rgba(22,163,74,.4)',   wt:1.1 },
];

// ── TEL_DETAIL — rich data for GSP side panel ─────────────────────────────────
// (Declared here so it's co-located with the diagram; TEL_HOPS in ext.js is dead)

function _renderTelSVG(wrap) {
  const W = wrap.clientWidth  || 1100;
  const H = wrap.clientHeight || 640;
  wrap.innerHTML = '';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG_NS,'svg');
  svg.setAttribute('width',W); svg.setAttribute('height',H);
  svg.style.cssText = 'display:block;background:#ffffff;';
  wrap.appendChild(svg);

  // defs — drop shadow + hover glow filters only, NO markers
  const defs = document.createElementNS(SVG_NS,'defs');
  svg.appendChild(defs);
  function mkFilter(id, content) {
    const f=document.createElementNS(SVG_NS,'filter');
    f.setAttribute('id',id); f.setAttribute('x','-30%'); f.setAttribute('y','-30%');
    f.setAttribute('width','160%'); f.setAttribute('height','160%');
    f.innerHTML=content; defs.appendChild(f);
  }
  mkFilter('tds','<feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,.10)"/>');
  mkFilter('thv','<feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>');

  const NCOLS=7, HPAD=14, LANE_HDR=34;
  const colW=(W-HPAD*2)/NCOLS;
  function cx(ci){ return HPAD+ci*colW+colW/2; }

  // y-positions per column
  const byCol={};
  TEL_NODES_DATA.forEach(n=>{ (byCol[n.col_idx]||(byCol[n.col_idx]=[])).push(n); });
  const NW=Math.min(colW*0.74,114), NH=38;
  const nodePos={};
  Object.entries(byCol).forEach(([ci,nodes])=>{
    const usable=H-LANE_HDR-20;
    nodes.forEach((n,i)=>{
      nodePos[n.id]={ x:cx(+ci), y:LANE_HDR+(usable/(nodes.length+1))*(i+1) };
    });
  });

  function svgEl(tag,attrs,text){
    const e=document.createElementNS(SVG_NS,tag);
    if(attrs) Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));
    if(text!==undefined) e.textContent=text;
    return e;
  }

  // ── Lane backgrounds ──
  const LANES=[
    {label:'PORTAL &\nCHANNELS',  col:'#2563eb'},
    {label:'API GATEWAY',          col:'#ea580c'},
    {label:'APP SERVICES',         col:'#0891b2'},
    {label:'DATA /\nMESSAGING',    col:'#16a34a'},
    {label:'OTEL\nCOLLECTION',     col:'#ea580c'},
    {label:'AZURE\nMONITOR',       col:'#7c3aed'},
    {label:'OUTPUTS',              col:'#dc2626'},
  ];
  function hexA(hex,a){
    try{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgba(${r},${g},${b},${a})`;}catch{return hex;}
  }

  const lanesG=svgEl('g'); svg.appendChild(lanesG);
  LANES.forEach((lane,li)=>{
    const x0=HPAD+li*colW;
    lanesG.appendChild(svgEl('rect',{x:x0+1,y:0,width:colW-2,height:H,fill:hexA(lane.col,.05)}));
    if(li>0) lanesG.appendChild(svgEl('line',{x1:x0,y1:0,x2:x0,y2:H,stroke:'rgba(0,0,0,.06)','stroke-width':1}));
    lanesG.appendChild(svgEl('rect',{x:x0,y:0,width:colW,height:LANE_HDR,fill:hexA(lane.col,.12)}));
    lanesG.appendChild(svgEl('line',{x1:HPAD,y1:LANE_HDR,x2:W-HPAD,y2:LANE_HDR,stroke:'rgba(0,0,0,.08)','stroke-width':1}));
    const lblLines=lane.label.split('\n');
    lblLines.forEach((ln,li2)=>{
      const fs=Math.max(6.5,Math.min(9.5,colW/(Math.max(...lane.label.split('\n').map(l=>l.length))+2)*1.5));
      lanesG.appendChild(svgEl('text',{
        x:x0+colW/2, y:LANE_HDR/2+(li2-(lblLines.length-1)/2)*10+1,
        'text-anchor':'middle','dominant-baseline':'central',
        'font-size':fs,'font-family':'JetBrains Mono,monospace',
        'font-weight':'800','letter-spacing':'0.05em',
        fill:lane.col,opacity:0.8,'pointer-events':'none'
      },ln));
    });
  });

  // ── Inner g for pan/zoom ──
  const inner=svgEl('g',{id:'tel-inner'});
  svg.appendChild(inner);

  // Pre-compute parallel edge offsets
  const pc={},pi={};
  TEL_EDGES_DATA.forEach(e=>{ const k=[e.s,e.t].sort().join('|'); pc[k]=(pc[k]||0)+1; });
  TEL_EDGES_DATA.forEach(e=>{ const k=[e.s,e.t].sort().join('|'); pi[k]=pi[k]||0; e._pi=pi[k]++; e._pt=pc[k]; });

  const PULL=NH/2+4;

  // ── Edges ──
  TEL_EDGES_DATA.forEach(e=>{
    const sp=nodePos[e.s], tp=nodePos[e.t]; if(!sp||!tp) return;
    const dx=tp.x-sp.x, dy=tp.y-sp.y, len=Math.sqrt(dx*dx+dy*dy)||1;
    const bx=sp.x+(dx/len)*PULL, by=sp.y+(dy/len)*PULL;
    const ex=tp.x-(dx/len)*PULL, ey=tp.y-(dy/len)*PULL;
    const offset=(e._pi-(e._pt-1)/2)*15;
    const cpx=(bx+ex)/2-(dy/len)*offset, cpy=(by+ey)/2+(dx/len)*offset;
    const tang=Math.atan2(ey-cpy,ex-cpx);
    const pd=`M${bx},${by} Q${cpx},${cpy} ${ex},${ey}`;

    const eg=svgEl('g');
    inner.appendChild(eg);
    // hit zone
    eg.appendChild(svgEl('path',{d:pd,fill:'none',stroke:'transparent','stroke-width':14}));
    // line
    const dashArr=e.dashed?'5,4':null;
    const pathEl=svgEl('path',{d:pd,fill:'none',stroke:e.col,'stroke-width':e.wt||1.3,'stroke-linecap':'round',opacity:1});
    if(dashArr) pathEl.setAttribute('stroke-dasharray',dashArr);
    eg.appendChild(pathEl);
    // arrowhead polygon — inline, no markers
    const cos=Math.cos(tang), sin=Math.sin(tang);
    const AH=6, AW=2.8;
    const pts=[
      [0,0],[-(AH),AW],[-(AH),-AW]
    ].map(([px,py])=>`${ex+px*cos-py*sin},${ey+px*sin+py*cos}`).join(' ');
    eg.appendChild(svgEl('polygon',{
      points:pts, fill:e.ec||e.col, opacity:0.8
    }));
    // label
    if(e.lbl){
      const mx=0.25*bx+0.5*cpx+0.25*ex, my=0.25*by+0.5*cpy+0.25*ey-4;
      const ll=e.lbl.length*3.5+8;
      eg.appendChild(svgEl('rect',{x:mx-ll/2,y:my-6,width:ll,height:11,rx:3,fill:'#ffffff',opacity:.92}));
      eg.appendChild(svgEl('text',{
        x:mx,y:my+1,'text-anchor':'middle','dominant-baseline':'central',
        'font-size':6,'font-family':'JetBrains Mono,monospace',
        fill:e.ec||'rgba(0,0,0,.4)','pointer-events':'none'
      },e.lbl));
    }
  });

  // ── Nodes ──
  let activeNode=null;
  TEL_NODES_DATA.forEach(n=>{
    const pos=nodePos[n.id]; if(!pos) return;
    const hasDet=!!TEL_DETAIL[n.id];
    const g=svgEl('g',{transform:`translate(${pos.x},${pos.y})`,style:'cursor:pointer'});
    inner.appendChild(g);

    // shadow
    g.appendChild(svgEl('rect',{x:-NW/2+1,y:-NH/2+2,width:NW,height:NH,rx:7,fill:hexA(n.col,.15),'pointer-events':'none'}));
    // body
    const rect=svgEl('rect',{x:-NW/2,y:-NH/2,width:NW,height:NH,rx:7,fill:'#ffffff',stroke:n.col,'stroke-width':hasDet?2:1.4,filter:'url(#tds)'});
    g.appendChild(rect);
    // left colour bar
    g.appendChild(svgEl('rect',{x:-NW/2,y:-NH/2,width:4,height:NH,rx:7,fill:n.col,'pointer-events':'none'}));
    g.appendChild(svgEl('rect',{x:-NW/2+2,y:-NH/2,width:4,height:NH,fill:'#ffffff','pointer-events':'none'}));
    // label
    const lines=n.label.split('\n');
    lines.forEach((ln,li)=>{
      const fs=Math.max(7.5,Math.min(10,NW*0.82/Math.max(...lines.map(l=>l.length))*1.1));
      g.appendChild(svgEl('text',{
        x:3,y:(li-(lines.length-1)/2)*11,'text-anchor':'middle','dominant-baseline':'central',
        'font-size':fs,'font-family':'JetBrains Mono,monospace',
        'font-weight':'700',fill:'#1a1a18','pointer-events':'none'
      },ln));
    });
    // detail dot
    if(hasDet) g.appendChild(svgEl('circle',{cx:NW/2-6,cy:-NH/2+6,r:3.5,fill:n.col,'pointer-events':'none'}));

    // hover
    g.addEventListener('mouseenter',()=>{
      if(activeNode!==n.id){
        rect.setAttribute('fill',hexA(n.col,.1));
        rect.setAttribute('filter','url(#thv)');
      }
    });
    g.addEventListener('mouseleave',()=>{
      if(activeNode!==n.id){
        rect.setAttribute('fill','#ffffff');
        rect.setAttribute('filter','url(#tds)');
      }
    });

    // click → GSP
    g.addEventListener('click',e=>{
      e.stopPropagation();
      // reset previous
      if(activeNode){
        const prev=inner.querySelector(`[data-tel-id="${activeNode}"] rect`);
        if(prev){ prev.setAttribute('fill','#ffffff'); prev.setAttribute('stroke-width',hasDet?2:1.4); }
      }
      activeNode=n.id;
      rect.setAttribute('fill',hexA(n.col,.18));
      rect.setAttribute('stroke-width',2.5);
      rect.setAttribute('filter','url(#thv)');
      _telOpenGSP(n);
    });
    g.setAttribute('data-tel-id',n.id);
  });

  // Legend
  const legData=[
    {col:'rgba(37,99,235,.5)',lbl:'Request path'},
    {col:'#ea580c',           lbl:'OTel spans'},
    {col:'#7c3aed',           lbl:'Monitor export'},
    {col:'#dc2626',           lbl:'SIEM / SecOps'},
  ];
  const legG=svgEl('g',{transform:`translate(${W/2},${H-9})`});
  svg.appendChild(legG);
  let lx=-(legData.length*106)/2;
  legData.forEach(item=>{
    legG.appendChild(svgEl('line',{x1:lx,y1:0,x2:lx+16,y2:0,stroke:item.col,'stroke-width':2.2}));
    legG.appendChild(svgEl('text',{x:lx+19,y:1,'dominant-baseline':'central','font-size':7,'font-family':'JetBrains Mono,monospace',fill:'#9a9990'},item.lbl));
    lx+=106;
  });
}

function _telOpenGSP(node) {
  const det = TEL_DETAIL[node.id];
  if (!det) {
    window.GSP && GSP.open({
      color: node.col,
      cat: node.group,
      title: node.label.replace('\n',' '),
      sub: node.group,
      sections: [{ label:'Layer', type:'prose', body: `Component in the <strong>${node.group}</strong> telemetry layer.` }]
    });
    return;
  }
  const sections = [
    { label:'Overview', type:'prose', body: det.plain },
    { label:'Emitted Signals', type:'list', body: det.signals || [] },
    { label:'Key Metrics & SLIs', type:'list', body: det.metrics || [] },
  ];
  window.GSP && GSP.open({
    color: node.col,
    cat: node.group,
    title: det.t,
    sub: node.label.replace('\n',' '),
    sections
  });
}


// ══════════════════════════════════════════════════════════════════════════════
// FAILOVER — SVG diagram, GSP for details
// ══════════════════════════════════════════════════════════════════════════════
const FT_COMP = [
  {id:'FD',     x:180,y:22, w:640,h:44,c:'#f59e0b',lbl:'Azure Front Door Premium',sub:'Health probe every 30s · Anycast · WAF',
   cat:'Global Edge', plain:'Global load balancer. Continuously probes APIM-A. When probes fail 3× in 30s, switches all traffic to APIM-B via anycast routing — no DNS TTL wait.',
   fp:'Front Door detects APIM-A probe failure → switches origin group to APIM-B within 2 minutes. No manual action. First citizen request hits APIM-B within 2–3 min of failure.', rto:'< 2 min', rpo:'N/A (stateless)'},
  {id:'APIM_A', x:20, y:110,w:170,h:44,c:'#f97316',lbl:'APIM Primary (A)',sub:'Live traffic · JWT · RBAC',
   cat:'Region A — Gateway', plain:'The live API gateway for Region A. Receives all traffic until Front Door switches.',
   fp:'On Front Door switch: stops receiving traffic. Can be left running for post-incident log inspection. APIM-B has identical configuration deployed by CI/CD.', rto:'Already provisioned', rpo:'N/A (stateless)'},
  {id:'CA_A',   x:200,y:110,w:170,h:44,c:'#3b82f6',lbl:'Container Apps (A)',sub:'Facade · Orchestrator · Adapters',
   cat:'Region A — Compute', plain:'All microservices in Region A. Region B counterparts are pre-provisioned in warm-idle state.',
   fp:'Container Apps-B scales to operational replicas (min=2 Facade/Orchestrator, min=1 per Adapter). Images pre-pulled in ACR-B via geo-replication. Health probes green within 2 min.', rto:'< 5 min', rpo:'N/A (stateless)'},
  {id:'PG_A',   x:20, y:173,w:170,h:44,c:'#22c55e',lbl:'PostgreSQL Primary (A)',sub:'WAL → streaming to Region B',
   cat:'Region A — Data', plain:'Transactional database. Streams WAL changes to Region B replica every few seconds (RPO ≤ 5 min).',
   fp:'VERIFY Region A unavailable (avoid split-brain). PROMOTE: az postgres flexible-server promote. UPDATE Key Vault-B secret. RESTART Container Apps-B. Duration: 30–45 min.', rto:'30–45 min', rpo:'≤ 5 min (WAL lag monitored)'},
  {id:'SB_A',   x:200,y:173,w:170,h:44,c:'#f59e0b',lbl:'Service Bus Premium (A)',sub:'Geo-DR alias pair',
   cat:'Region A — Messaging', plain:'Message queues. Service Bus geo-DR alias — one DNS name that switches between primary and secondary namespace.',
   fp:'Execute: az servicebus georecovery-alias fail-over. Alias DNS switches to Region B within 5 min. Producers reconnect automatically via alias DNS change.', rto:'< 20 min', rpo:'In-flight messages: manual re-drive required'},
  {id:'KV_A',   x:20, y:236,w:170,h:44,c:'#ef4444',lbl:'Key Vault (A)',sub:'Secrets — pre-synced to B',
   cat:'Region A — Security', plain:'All platform secrets. Region B Key Vault is pre-populated with identical secrets via IaC/CI-CD.',
   fp:'Key Vault-B already has all secrets. Update pg-connection-string in Key Vault-B after PostgreSQL promotion. No other manual action needed.', rto:'Already configured', rpo:'Synced at deploy time'},
  {id:'RED_A',  x:200,y:236,w:170,h:44,c:'#06b6d4',lbl:'Redis Enterprise (A)',sub:'Geo-replication to B',
   cat:'Region A — Cache', plain:'MDM cache with geo-replication to Region B Redis. Cache may be warm or cold on failover.',
   fp:'If geo-link healthy: Redis-B has warm cache — normal hit rate immediately. If geo-link degraded: cold Redis-B → 100% miss → direct adapter calls → cache warms in 30–60 min.', rto:'0 min (warm) or ~30 min warmup (cold)', rpo:'Seconds (warm) / acceptable — direct fetch is fallback'},
  {id:'APIM_B', x:630,y:110,w:170,h:44,c:'#8b5cf6',lbl:'APIM Standby (B)',sub:'Pre-provisioned · CI/CD synced',
   cat:'Region B — Gateway', plain:'Identical APIM in Region B, pre-provisioned with same products, policies, Named Values. Becomes active the moment Front Door switches.',
   fp:'Front Door switches origin priority → APIM-B serves live traffic immediately. All JWT policies and RBAC products are identical (CI/CD deployed simultaneously). Zero config changes at failover.', rto:'< 2 min (Front Door switch)', rpo:'N/A (stateless)'},
  {id:'CA_B',   x:450,y:110,w:170,h:44,c:'#8b5cf6',lbl:'Container Apps (B)',sub:'Warm-idle → scale-up',
   cat:'Region B — Compute', plain:'Platform microservices in Region B, normally at min=0 replicas. Scales up within 2–3 min when traffic arrives.',
   fp:'Images geo-replicated to ACR-B at deploy time. KEDA HTTP trigger scales Facade + Orchestrator to 2 replicas on first requests. Adapter replicas scale to 1 each.', rto:'< 5 min', rpo:'N/A (stateless)'},
  {id:'PG_B',   x:630,y:173,w:170,h:44,c:'#8b5cf6',lbl:'Postgres Replica (B)',sub:'WAL replica → promote',
   cat:'Region B — Data', plain:'Continuously updated from PostgreSQL Primary A via WAL streaming. Promoted to primary during failover.',
   fp:'PROMOTE: az postgres flexible-server promote --mode switchover (30–45 min). VERIFY: test write succeeds on B. UPDATE Key Vault-B. RESTART Container Apps-B. A becomes read-only archive.', rto:'30–45 min', rpo:'≤ 5 min (WAL replication lag)'},
  {id:'COS_B',  x:450,y:173,w:170,h:44,c:'#22c55e',lbl:'Cosmos DB (B)',sub:'Multi-region auto-failover',
   cat:'Region B — Data', plain:'Cosmos DB is multi-region active-active. Automatic failover requires no manual action.',
   fp:'Cosmos auto-failover within seconds of Region A AZ failure. Write region switches to B automatically. Connection strings use the Cosmos account endpoint — no change needed.', rto:'< 1 min (automatic)', rpo:'Seconds (Cosmos SLA)'},
  {id:'RED_B',  x:450,y:236,w:170,h:44,c:'#06b6d4',lbl:'Redis (B)',sub:'Geo-replica / warm or cold',
   cat:'Region B — Cache', plain:'Redis geo-replica in Region B. Warm if geo-link healthy; cold start if degraded.',
   fp:'Healthy geo-link: immediate warm cache. Degraded: cold start → MDM miss rate = 100% → direct adapter calls → cache populates over 30–60 min. Alert fires if hit-rate < 20% for > 10 min.', rto:'Immediate (warm) or ~30 min warmup (cold)', rpo:'Acceptable — direct adapter fetch always available'},
];

function buildFailoverDiagram() {
  const panel = document.getElementById('panel-failover');
  if (!panel) return;
  const existing = panel.querySelector('.panel-padded');
  if (!existing) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:16px 20px';

  // Pure HTML layout: Front Door banner + two region columns side-by-side.
  // Each component is a clickable card row. No SVG — no stretching.
  const diagCard = document.createElement('div');
  diagCard.className = 'card'; diagCard.style.marginBottom = '16px';
  diagCard.innerHTML = '<div class="card-hdr"><div class="card-hdr-accent"></div>'
    + 'Regional Failover — Warm Standby · Click any component for procedure, RTO &amp; RPO'
    + '</div><div class="card-body" style="padding:10px 12px 12px"></div>';
  const body = diagCard.querySelector('.card-body');

  // Front Door banner
  const fd = FT_COMP.find(n=>n.id==='FD');
  const fdBar = document.createElement('div');
  fdBar.style.cssText = `display:flex;align-items:center;gap:10px;padding:7px 12px;border-radius:7px;`
    + `border:1.5px solid ${hexA2(fd.c,0.5)};background:${hexA2(fd.c,0.07)};cursor:pointer;`
    + `margin-bottom:10px;transition:all .14s`;
  fdBar.innerHTML = `<span style="font-size:.75rem">🌐</span>`
    + `<div style="flex:1"><div style="font-size:.75rem;font-weight:700;color:var(--text-1)">${fd.lbl}</div>`
    + `<div style="font-family:var(--font-mono);font-size:.58rem;color:${fd.c}">${fd.sub}</div></div>`
    + `<div style="font-family:var(--font-mono);font-size:.58rem;color:var(--text-3)">Global Edge · WAF · Anycast</div>`;
  fdBar.addEventListener('mouseenter',()=>{ fdBar.style.borderColor=fd.c; fdBar.style.background=hexA2(fd.c,0.13); });
  fdBar.addEventListener('mouseleave',()=>{ fdBar.style.borderColor=hexA2(fd.c,0.5); fdBar.style.background=hexA2(fd.c,0.07); });
  fdBar.addEventListener('click',()=>GSP.open({color:fd.c,cat:fd.cat,title:fd.lbl,sub:fd.sub,
    sections:[{label:'In Plain English',type:'prose',body:fd.plain},
              {label:'Failover Procedure',type:'prose',body:fd.fp},
              {label:'RTO / RPO',type:'badge-list',body:[{label:'RTO',value:fd.rto,color:fd.c},{label:'RPO',value:fd.rpo,color:'#22c55e'}]}]}));
  body.appendChild(fdBar);

  // Two region columns
  const cols = document.createElement('div');
  cols.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px';

  function regionCol(title, color, ids, repLabels) {
    const col = document.createElement('div');
    col.style.cssText = `border:1.5px solid ${hexA2(color,0.3)};border-radius:8px;overflow:hidden`;
    const hdr = document.createElement('div');
    hdr.style.cssText = `padding:5px 10px;background:${hexA2(color,0.08)};border-bottom:1px solid ${hexA2(color,0.2)};`
      + `font-size:.59rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${color}`;
    hdr.textContent = title; col.appendChild(hdr);
    ids.forEach((id, i) => {
      const n = FT_COMP.find(x=>x.id===id); if(!n) return;
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;`
        + `border-bottom:1px solid var(--border);transition:background .12s`;
      const rep = repLabels && repLabels[id];
      row.innerHTML = `<div style="width:8px;height:8px;border-radius:2px;background:${n.c};flex-shrink:0"></div>`
        + `<div style="flex:1;min-width:0">`
        + `<div style="font-size:.71rem;font-weight:700;color:var(--text-1);line-height:1.2">${n.lbl}</div>`
        + `<div style="font-family:var(--font-mono);font-size:.57rem;color:var(--text-3)">${n.sub}</div></div>`
        + (rep ? `<div style="font-family:var(--font-mono);font-size:.55rem;color:${n.c};background:${hexA2(n.c,0.1)};padding:1px 5px;border-radius:3px;white-space:nowrap">${rep}</div>` : '');
      if (i === ids.length-1) row.style.borderBottom = 'none';
      row.addEventListener('mouseenter',()=>{ row.style.background=hexA2(n.c,0.05); });
      row.addEventListener('mouseleave',()=>{ row.style.background=''; });
      row.addEventListener('click',()=>GSP.open({color:n.c,cat:n.cat,title:n.lbl,sub:n.sub,
        sections:[{label:'In Plain English',type:'prose',body:n.plain},
                  {label:'Failover Procedure',type:'prose',body:n.fp},
                  {label:'RTO / RPO',type:'badge-list',body:[{label:'RTO',value:n.rto,color:n.c},{label:'RPO',value:n.rpo,color:'#22c55e'}]}]}));
      col.appendChild(row);
    });
    return col;
  }

  const repA = { PG_A:'WAL → B ≤5min', SB_A:'geo-DR alias', RED_A:'geo-replicated' };
  const repB = { PG_B:'promote on failover', COS_B:'auto-failover <1min', RED_B:'warm replica' };

  cols.appendChild(regionCol('Region A — Primary (East Netherlands)', '#3b82f6',
    ['APIM_A','CA_A','PG_A','SB_A','KV_A','RED_A'], repA));
  cols.appendChild(regionCol('Region B — Warm Standby (West Netherlands)', '#8b5cf6',
    ['APIM_B','CA_B','PG_B','COS_B','RED_B'], repB));

  body.appendChild(cols);

  // RTO/RPO summary bar
  const summary = document.createElement('div');
  summary.style.cssText = 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap';
  [['Front Door switch','< 2 min','#f59e0b'],['Compute scale-up','< 5 min','#3b82f6'],
   ['Service Bus alias','< 20 min','#f59e0b'],['PostgreSQL promote','30–45 min','#22c55e'],
   ['Overall RTO','≤ 60 min','#f97316'],['RPO (data)','≤ 5 min','#22c55e']
  ].forEach(([lbl,val,c])=>{
    const b=document.createElement('div');
    b.style.cssText=`font-family:var(--font-mono);font-size:.61rem;padding:3px 9px;border-radius:4px;`
      +`border:1px solid ${hexA2(c,0.35)};background:${hexA2(c,0.07)};color:${c}`;
    b.innerHTML=`<span style="color:var(--text-3)">${lbl}: </span><strong>${val}</strong>`;
    summary.appendChild(b);
  });
  body.appendChild(summary);

  wrap.appendChild(diagCard);
  wrap.appendChild(existing.cloneNode(true));
  panel.innerHTML = ''; panel.appendChild(wrap);
}

// ══════════════════════════════════════════════════════════════════════════════
// DR & CHAOS — SVG diagram, GSP for details
// ══════════════════════════════════════════════════════════════════════════════
const DR_COMP = [
  {id:'DR1',x:10, y:22,w:128,h:44,c:'#3b82f6',lbl:'Announce Drill',sub:'Notify · Freeze deploys',cat:'DR Phase 1',
   desc:'48h before drill: freeze production deployments in Azure DevOps pipeline gates, set status page to planned-maintenance, assign primary + backup SRE on-call, notify stakeholders via Teams. PagerDuty test mode stays OFF — real pages fire.', nfr:'NFR-07 · Quarterly cadence'},
  {id:'DR2',x:148,y:22,w:128,h:44,c:'#ef4444',lbl:'Inject Failure',sub:'Simulate Region A loss',cat:'DR Phase 2',
   desc:'Disable APIM-A origin in Front Door portal (fastest, fully reversible). Stopwatch starts. App Insights alert fires within 2 min. PagerDuty P1 page generated. SLO burn-rate alert fires (expected).', nfr:'NFR-07 · Simulates full AZ failure'},
  {id:'DR3',x:286,y:22,w:128,h:44,c:'#f59e0b',lbl:'Front Door Switch',sub:'Traffic → APIM-B',cat:'DR Phase 3',
   desc:'VERIFY: Front Door probe failure count ≥ 3 → origin group switched to APIM-B. MEASURE: time from probe failure to first successful request on APIM-B (target < 2 min).', nfr:'NFR-07 · RTO milestone 1'},
  {id:'DR4',x:424,y:22,w:128,h:44,c:'#3b82f6',lbl:'Scale Container Apps B',sub:'Warm-idle → operational',cat:'DR Phase 4',
   desc:'Container Apps-B scale to 2 replicas (Facade, Orchestrator) and 1 each (Adapters). Images already in ACR-B. KEDA HTTP trigger scales automatically. Target: health probes green < 5 min.', nfr:'NFR-07 · RTO milestone 2'},
  {id:'DR5',x:562,y:22,w:128,h:44,c:'#22c55e',lbl:'Promote PostgreSQL B',sub:'Replica → primary',cat:'DR Phase 5',
   desc:'az postgres flexible-server promote --mode switchover. CONFIRM test write on B. UPDATE Key Vault-B: pg-connection-string → B endpoint. RESTART Container Apps-B. VERIFY WAL lag ≤ 5 min at time of failure (RPO evidence).', nfr:'NFR-07 · RPO ≤ 5 min'},
  {id:'DR6',x:700,y:22,w:128,h:44,c:'#22c55e',lbl:'Smoke Tests',sub:'Auth → Prefill → Submit',cat:'DR Phase 6',
   desc:'Playwright DR suite: OIDC auth (200+JWT), GET /prefill (200 partial — cold cache expected), POST /applications dry-run (202+corrId), webhook ingress (200 idempotent), /healthz all services (200). Relaxed SLO during DR: P95 ≤ 3s.', nfr:'NFR-07 · RTO ≤ 60 min total'},
  {id:'DR7',x:838,y:22,w:128,h:44,c:'#3b82f6',lbl:'After-Action Report',sub:'Blameless · PRs · Sign-off',cat:'DR Phase 7',
   desc:'Blameless post-mortem: actual RPO (WAL lag at failure), actual RTO (alert→smoke green), runbook gaps, alert tuning PRs. Signed by SRE Lead and Security Lead. Filed in compliance documentation.', nfr:'NFR-07 · Post-incident improvement'},

  {id:'CE01',x:10, y:152,w:188,h:52,c:'#ef4444',lbl:'CE-01: Adapter Timeout',sub:'Civil API 5s delay · 30% calls',cat:'Chaos Experiment',
   desc:'Inject 5s TCP delays on 30% of Civil adapter calls. EXPECTED: circuit breaker opens after 20% 5xx/60s window. Partial bundle returned (civil fields in problems[]). DLQ = 0. User journey continues with degraded prefill.', nfr:'NFR-06 (CB) · NFR-01 (partial bundle)'},
  {id:'CE02',x:10, y:215,w:188,h:52,c:'#ef4444',lbl:'CE-02: Queue Saturation',sub:'SB TUs reduced · consumers stall',cat:'Chaos Experiment',
   desc:'Reduce Service Bus throughput units to min (1 TU). EXPECTED: queue depth rises → KEDA scales consumers → backpressure 429 returned. Queue drains within 5 min of TU restoration. No DLQ overflow.', nfr:'NFR-24 (queue lag) · NFR-06 (retry)'},
  {id:'CE03',x:10, y:278,w:188,h:52,c:'#ef4444',lbl:'CE-03: Redis Cold Start',sub:'Force evict MDM keys',cat:'Chaos Experiment',
   desc:'FLUSHDB on MDM key prefix to simulate Redis cold start. EXPECTED: 100% cache miss → direct adapter calls → prefill P95 degrades but < 3s. Cache warms within 30 min. No consent bypass. Hit-rate alert fires.', nfr:'NFR-16 (cache hit) · NFR-01 (graceful degrade)'},
  {id:'CE04',x:10, y:341,w:188,h:52,c:'#ef4444',lbl:'CE-04: Webhook Replay',sub:'Replay nonce · expect 409',cat:'Chaos Experiment',
   desc:'Replay a captured eSign webhook payload with the same nonce. EXPECTED: Redis nonce store rejects replay → 409 Conflict returned. Duplicate application NOT created. Idempotency-Key ledger confirms single record.', nfr:'NFR-15 (idempotency) · Security (anti-replay)'},
  {id:'CE05',x:10, y:404,w:188,h:52,c:'#ef4444',lbl:'CE-05: All Adapters Down',sub:'Full registry blackout',cat:'Chaos Experiment',
   desc:'Block all 6 adapter egress routes. EXPECTED: all circuit breakers OPEN within 60s. API returns 503 with Retry-After. MDM snapshot returned if within TTL. DLQ = 0.', nfr:'NFR-06 (CB) · NFR-03 (503 graceful)'},
  {id:'CE06',x:10, y:467,w:188,h:52,c:'#ef4444',lbl:'CE-06: JWT Key Rotation',sub:'JWKS key rollover · no downtime',cat:'Chaos Experiment',
   desc:'Rotate IdP signing key mid-flight. EXPECTED: APIM validates new tokens using updated JWKS cache (< 5 min TTL). Existing valid tokens continue until expiry. Zero 401 errors during rotation window.', nfr:'NFR-09 (auth) · Security (zero-downtime rotation)'},

  {id:'RP01',x:570,y:152,w:188,h:52,c:'#22c55e',lbl:'Circuit Breaker Pattern',sub:'CLOSED → OPEN → HALF_OPEN',cat:'Resilience Pattern',
   desc:'All 6 adapter calls wrapped in circuit breaker. CLOSED: normal. OPEN: after 20% 5xx/60s, calls short-circuit immediately. HALF_OPEN: probes one real call every 30s; on success, returns CLOSED. State gauges exported to telemetry.', nfr:'NFR-06 · prevents cascade failure'},
  {id:'RP02',x:570,y:215,w:188,h:52,c:'#22c55e',lbl:'Graceful Degradation',sub:'Partial bundle on adapter failure',cat:'Resilience Pattern',
   desc:'If one or more adapters unavailable, Orchestrator returns a partial canonical bundle with HTTP 206 Partial Content and problems[] array listing unavailable fields. User journey continues — citizen fills gaps manually.', nfr:'NFR-01 · NFR-03 · UX resilience'},
  {id:'RP03',x:570,y:278,w:188,h:52,c:'#22c55e',lbl:'Retry + DLQ Pattern',sub:'Exponential backoff · DLQ runbook',cat:'Resilience Pattern',
   desc:'Failed delivery: retry with 100ms, 200ms, 400ms, 800ms backoff (maxDeliveryCount=5). After 5 failures: parked in DLQ with full context. Alert fires if DLQ age > 4h. Runbook-guided re-drive procedure.', nfr:'NFR-24 · NFR-06 · NFR-08'},
  {id:'RP04',x:570,y:341,w:188,h:52,c:'#22c55e',lbl:'Idempotency Guarantee',sub:'Idempotency-Key ledger · 24h TTL',cat:'Resilience Pattern',
   desc:'Every POST /applications requires Idempotency-Key header. Facade checks PostgreSQL ledger. Duplicate key → return cached response (202), no new record created. Prevents double-submit regardless of client retry behaviour.', nfr:'NFR-15 · anti-duplication'},
  {id:'RP05',x:570,y:404,w:188,h:52,c:'#22c55e',lbl:'SLO Error Budget',sub:'99.9% = 43.8 min/month',cat:'Resilience Pattern',
   desc:'Platform SLO: 99.9% availability for citizen journeys. Error budget: 43.8 min/month. Burn-rate alerts fire at 14× (page immediately) and 6× (page slowly). Error budget displayed on SRE dashboard. New deploys blocked when budget < 10%.', nfr:'NFR-01 · Google SRE multi-window'},
  {id:'RP06',x:570,y:467,w:188,h:52,c:'#22c55e',lbl:'Chaos Schedule',sub:'Monthly staging · Quarterly prod',cat:'Resilience Pattern',
   desc:'Chaos experiments run monthly in staging (automated via Chaos Studio). Selected experiments run quarterly in production during DR drill window (manual, controlled). Results feed back into NFR matrix validation and runbook improvements.', nfr:'NFR-07 · Continuous validation'},
];

function buildDRDiagram() {
  const panel = document.getElementById('panel-dr');
  if (!panel) return;
  const existing = panel.querySelector('.panel-padded');
  if (!existing) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:16px 20px';

  // Three-column compact card: DR Phases | Chaos | Resilience
  // Each item = one slim row (no sub-text, detail lives in GSP panel)
  const card = document.createElement('div');
  card.className = 'card'; card.style.marginBottom = '16px';
  card.innerHTML = '<div class="card-hdr"><div class="card-hdr-accent"></div>'
    + 'DR Drill · Chaos Experiments · Resilience Posture — Click any item'
    + '</div><div class="card-body" style="padding:0"></div>';
  const body = card.querySelector('.card-body');

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:0';

  function col(title, color) {
    const c = document.createElement('div');
    c.style.cssText = `border-right:1px solid var(--border)`;
    const h = document.createElement('div');
    h.style.cssText = `padding:6px 12px;background:${hexA2(color,0.07)};border-bottom:1px solid ${hexA2(color,0.2)};`
      + `font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${color}`;
    h.textContent = title; c.appendChild(h);
    return c;
  }

  function itemRow(n, badge, c) {
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:7px;padding:5px 10px;`
      + `border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s`;
    row.innerHTML = `<div style="font-family:var(--font-mono);font-size:.58rem;font-weight:700;`
      + `color:${n.c};background:${hexA2(n.c,0.1)};padding:1px 5px;border-radius:3px;white-space:nowrap;flex-shrink:0">${badge}</div>`
      + `<div style="font-size:.69rem;font-weight:600;color:var(--text-1);line-height:1.3;min-width:0">${n.lbl}</div>`;
    row.addEventListener('mouseenter',()=>{ row.style.background=hexA2(n.c,0.05); });
    row.addEventListener('mouseleave',()=>{ row.style.background=''; });
    row.addEventListener('click',()=>GSP.open({color:n.c,cat:n.cat,title:n.lbl,sub:n.sub,
      sections:[{label:'Procedure / Description',type:'prose',body:n.desc},
                {label:'NFR Coverage',type:'tags',body:n.nfr.split(' · ')}]}));
    return row;
  }

  const drCol   = col('Quarterly DR Drill — 7 Phases', '#3b82f6');
  const ceCol   = col('Chaos Experiments', '#ef4444');
  const rpCol   = col('Resilience Posture', '#22c55e');
  rpCol.style.borderRight = 'none';

  DR_COMP.filter(n=>n.id.startsWith('DR')).forEach((n,i)=>drCol.appendChild(itemRow(n,`P${i+1}`,n.c)));
  DR_COMP.filter(n=>n.id.startsWith('CE')).forEach(n=>ceCol.appendChild(itemRow(n,n.id,n.c)));
  DR_COMP.filter(n=>n.id.startsWith('RP')).forEach(n=>rpCol.appendChild(itemRow(n,n.id,n.c)));

  grid.appendChild(drCol); grid.appendChild(ceCol); grid.appendChild(rpCol);
  body.appendChild(grid);
  wrap.appendChild(card);
  wrap.appendChild(existing.cloneNode(true));
  panel.innerHTML = ''; panel.appendChild(wrap);
}

})(); // END IIFE
