/* ═══════════════════════════════════════════════════════════════════════════
   EXECUTIVE SUMMARY + SIMULATION PLAYGROUND  v8  —  sim.js
   - Trace cards: collapsed by default, click-to-expand (no overlap)
   - Right panel top: compact checklist
   - Right panel bottom: Composite Knowledge Graph (SVG)
     · All 8 stories pre-drawn as nodes+edges, dimmed
     · Selected story cluster highlighted with hull outline
     · Edges carry messages; final node = double-circle
     · Nodes clickable → popover (plain + technical detail)
     · Simulation: active node pulses, edge animates with traveling dot
═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ─── micro helpers ─────────────────────────────────────────────────────── */
function ha(hex,a){try{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgba(${r},${g},${b},${a})`;}catch(e){return hex;}}
function el(tag,css,html){const d=document.createElement(tag);if(css)d.style.cssText=css;if(html!==undefined)d.innerHTML=html;return d;}
function svgEl(tag,attrs={}){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e;}

/* ─── ARCH LAYER TAXONOMY ───────────────────────────────────────────────── */
const L={
  CHANNEL:  {label:'Channel',           color:'#3b82f6'},
  IDENTITY: {label:'Identity & Consent',color:'#ec4899'},
  GATEWAY:  {label:'API Gateway',       color:'#f97316'},
  FACADE:   {label:'API Facade',        color:'#8b5cf6'},
  INTEROP:  {label:'Interop Core',      color:'#06b6d4'},
  REGISTRY: {label:'Registry Adapters', color:'#22c55e'},
  SECURITY: {label:'Security & Trust',  color:'#ef4444'},
  DATA:     {label:'Data Stores',       color:'#16a34a'},
  MESSAGING:{label:'Messaging & Events',color:'#f59e0b'},
  OBS:      {label:'Observability',     color:'#8b5cf6'},
};

/* ─── SIMULATION STORIES ────────────────────────────────────────────────── */
const SIM = {
'US-1':{
  title:'Prefill — OIDC+PKCE + Once-Only',color:'#3b82f6',cat:'Core',
  scenario:'Citizen opens the business-permit portal. The platform silently fetches verified government data from three registries and pre-fills the form — the citizen never re-enters known facts.',
  slo:'P95 ≤ 600ms (cache hit) · P95 ≤ 1.2s (miss, 1 SoR)',
  steps:[
    {id:'u1s1', layer:'CHANNEL',  comp:'Browser / Mobile App',        emoji:'🌐',action:'HTTPS GET portal URL',
     plain:'User navigates to the portal. A secure TLS connection is established.',
     detail:'TLS 1.3 handshake with Azure Front Door. HSTS enforced (max-age=31536000). CSP blocks inline scripts. OCSP stapling active. TTFB target 200ms.',latency:'~80ms',nfr:'NFR-19',status:'ok'},
    {id:'u1s2', layer:'CHANNEL',  comp:'Portal SPA (Next.js)',         emoji:'⚛️',action:'Generate PKCE S256 challenge pair',
     plain:'The browser secretly generates a one-time key pair so the auth code cannot be stolen in transit.',
     detail:'crypto.getRandomValues()→32-byte code_verifier. code_challenge=BASE64URL(SHA-256(verifier)). Stored in sessionStorage only — never localStorage.',latency:'<1ms',nfr:'Security',status:'ok'},
    {id:'u1s3', layer:'IDENTITY', comp:'eID Identity Provider',        emoji:'🔑',action:'OIDC auth-code flow with PKCE',
     plain:'Citizen is redirected to the national ID provider to log in.',
     detail:'GET /authorize?response_type=code&code_challenge_method=S256&code_challenge={ch}&acr_values=1. Citizen authenticates via national eID.',latency:'~1.2s',nfr:'NFR-09',status:'ok'},
    {id:'u1s4', layer:'IDENTITY', comp:'eID Token Endpoint',           emoji:'🎫',action:'Exchange code for tokens (PKCE verify)',
     plain:'Server verifies the secret and issues short-lived access tokens.',
     detail:'POST /token: IdP verifies SHA-256(verifier)==challenge ✓. Returns id_token(RS256,5min), access_token(15min), refresh_token(rotating,HttpOnly cookie).',latency:'~180ms',nfr:'NFR-09',status:'ok'},
    {id:'u1s5', layer:'IDENTITY', comp:'Claims Mapper (RBAC)',          emoji:'🗂️',action:'Map IdP claims → platform roles',
     plain:'The platform translates the government ID claims into its own permission model.',
     detail:'sub=sha256(NIN), acr="1". Map→role=CITIZEN, permissions=[read:own_data,submit:own_application]. acr=1 sufficient for prefill.',latency:'<5ms',nfr:'NFR-11',status:'ok'},
    {id:'u1s6', layer:'GATEWAY',  comp:'Azure APIM Premium',           emoji:'🛡️',action:'JWT validation, rate limit, inject corrId',
     plain:'The API gateway checks the token is valid and the user is within their rate limit.',
     detail:'validate-jwt(JWKS cached 5min) ✓ → rate-limit-by-key(sub,100/min) ✓ → set x-correlation-id(uuid-v4). Rejects with 429+Retry-After on breach.',latency:'~12ms',nfr:'NFR-09',status:'ok'},
    {id:'u1s7', layer:'FACADE',   comp:'API Facade',                   emoji:'📋',action:'Parse request, build PrefillCommand',
     plain:'The facade translates the HTTP request into an internal command object.',
     detail:'Validate serviceType=business-permit ✓, lang=nl ✓. Build PrefillCommand{subjectHash,scopes,corrId,traceparent}. Forward to Orchestrator.',latency:'~8ms',nfr:'NFR-08',status:'ok'},
    {id:'u1s8', layer:'INTEROP',  comp:'Consent Gate (SEC)',            emoji:'✅',action:'Verify active consent before any registry call',
     plain:'The platform checks the citizen has given consent to share data before touching any registry.',
     detail:'GET /consents?subject={hash}&purpose=prefill. Check scopesGranted⊇{civil,address,business} ✓, expiresAt>now() ✓, revoked=false ✓.',latency:'~18ms',nfr:'NFR-11',status:'ok'},
    {id:'u1s9', layer:'DATA',     comp:'Redis MDM Cache',               emoji:'⚡',action:'Cache-first lookup: 2 HITs, 1 MISS',
     plain:'The cache returns civil and address data instantly; business data has expired and must be fetched fresh.',
     detail:'GET mdm:{hash}:civil→HIT(ETag:"a3f9",TTL:42h) ✓, :address→HIT(TTL:8h) ✓, :business→MISS(TTL expired 2h ago). Hit rate: 66%.',latency:'~4ms',nfr:'NFR-16',status:'warn'},
    {id:'u1s10',layer:'INTEROP',  comp:'Orchestrator',                  emoji:'🎯',action:'Fan-out to Business Registry (cache miss)',
     plain:'The orchestrator calls the external business registry to fetch fresh data.',
     detail:'Circuit breaker: CLOSED. GET /adapters/business. Timeout 800ms. Retry 3× exponential backoff (100ms,200ms,400ms). OTel span: adapter_call{adapterId:AD_BUS}.',latency:'~220ms',nfr:'NFR-06',status:'ok'},
    {id:'u1s11',layer:'REGISTRY', comp:'Business Registry (AD_BUS)',    emoji:'🏢',action:'Call external Business Registry API',
     plain:'The adapter calls the national business registry and returns the raw response.',
     detail:'GET https://business-registry.gov/v2/entities?nid={hash}. Auth: Bearer via Managed Identity→Key Vault. Response 200: {kvkNumber,legalForm:"BV",directors,status:"active"}.',latency:'~190ms',nfr:'NFR-06',status:'ok'},
    {id:'u1s12',layer:'INTEROP',  comp:'Mapping & Validation (MapVal)', emoji:'🔄',action:'Adapter DTO → Canonical DTO + provenance',
     plain:'Raw registry data is normalised into the platform\'s standard format with source attribution.',
     detail:'BusinessRegistryDTO→CanonicalBusinessDTO. Fields mapped. Provenance: {sourceId:"AD_BUS",fetchedAt,schemaVersion:"v2.1"}.',latency:'~6ms',nfr:'NFR-10',status:'ok'},
    {id:'u1s13',layer:'INTEROP',  comp:'Data Quality Engine (DQ)',      emoji:'📊',action:'Apply hard + soft DQ rules',
     plain:'The DQ engine validates data completeness and format before it leaves the platform.',
     detail:'Hard: registrationNumber format KvK-XXXXXXXX ✓, status enum ✓, directors non-empty ✓. Soft: all pass. DQ score 100%.',latency:'~3ms',nfr:'NFR-10',status:'ok'},
    {id:'u1s14',layer:'DATA',     comp:'Redis MDM Cache',               emoji:'💾',action:'Write-back: store canonical bundle + ETag',
     plain:'The fresh data is stored in cache so future requests are served instantly.',
     detail:'SET mdm:{hash}:business {canonical} EX 14400 (4h TTL). ETag=BASE64URL(SHA-256(canonical)). Subscribed to Event Grid invalidation.',latency:'~3ms',nfr:'NFR-16',status:'ok'},
    {id:'u1s15',layer:'INTEROP',  comp:'Orchestrator',                  emoji:'📦',action:'Assemble + scope-filter canonical bundle',
     plain:'All three data bundles are merged and fields outside the citizen\'s consent scope are stripped.',
     detail:'Merge civil(cache:42h)+address(cache:8h)+business(fresh). Scope-filter removes tax fields. Return HTTP 200 with ETag+warnings[].',latency:'~5ms',nfr:'NFR-01',status:'ok'},
    {id:'u1s16',layer:'OBS',      comp:'App Insights',                  emoji:'📡',action:'Emit distributed trace + structured log',
     plain:'The full request is recorded as a distributed trace for SLO monitoring and debugging.',
     detail:'OTel span tree: prefill[325ms]→consent[18ms]→cache[4ms]→adapter_call[226ms]→mapval[6ms]→dq[3ms]. SLO 325ms<600ms ✓.',latency:'async',nfr:'NFR-26',status:'ok'},
    {id:'u1s17',layer:'CHANNEL',  comp:'Portal SPA',                    emoji:'🎨',action:'Render pre-filled form to citizen',
     plain:'The citizen sees the form already filled with their government-verified data.',
     detail:'Schema-driven renderer maps canonical fields. Pre-filled inputs show 🏛️ "From government registry" badge. 1 field with ⚠ soft-warn indicator.',latency:'~20ms',nfr:'NFR-19',status:'ok'},
  ]
},
'US-2':{
  title:'Full Application Saga: Prefill → Docs → eSign → Pay → Submit',color:'#f97316',cat:'Core',
  scenario:'Citizen completes a full business-permit application — pre-fill, document upload with AV scan, qualified digital signature, PCI-compliant payment, idempotent submission, and WORM audit receipt — all as one durable saga.',
  slo:'Submit success rate ≥ 99.5% · Total journey P95 < 10s',
  steps:[
    {id:'u2s1', layer:'INTEROP',  comp:'Orchestrator (Saga Engine)',    emoji:'🎭',action:'Instantiate ApplicationSubmitSaga',
     plain:'A durable saga is started to coordinate all steps. If the process crashes, it resumes exactly where it left off.',
     detail:'INSERT saga_instances{id,currentStep:"PREFILL",state:{},retriesMap:{}}. Durable + re-entrant. corrId propagated to all steps.',latency:'~15ms',nfr:'NFR-06',status:'ok'},
    {id:'u2s2', layer:'INTEROP',  comp:'Orchestrator → US-1 sub-flow', emoji:'📋',action:'Step PREFILL: execute prefill sub-saga',
     plain:'The prefill flow runs and its result is saved into the saga state.',
     detail:'Invoke US-1 flow. Returns canonical bundle. Persist prefillSnapshot to saga state. Emit saga_step_completed{step:"PREFILL",durationMs:325}.',latency:'~325ms',nfr:'NFR-01',status:'ok'},
    {id:'u2s3', layer:'INTEROP',  comp:'Rules Engine (Drools DMN)',      emoji:'⚖️',action:'Step RULES: eligibility + fee computation',
     plain:'Rules are evaluated against the pre-filled data to determine eligibility and compute applicable fees.',
     detail:'Evaluate: minDirectors(≥1)=1 ✓, businessStatus=active ✓. Fees: applicationFee=€125, processingFee=€35. Return eligible=true, validUntil:+24h.',latency:'~45ms',nfr:'NFR-01',status:'ok'},
    {id:'u2s4', layer:'SECURITY', comp:'Document Intake (DOCI)',         emoji:'📎',action:'Step DOC_PRESIGN: issue SAS upload URL',
     plain:'The platform generates a short-lived secure URL that lets the citizen upload directly to cloud storage.',
     detail:'POST /documents/presign{name,mimeType:"application/pdf",size:2.1MB}. Validate ✓. SAS URL: TTL=15min, policy={allowedMimes,maxBytes:10485760}.',latency:'~35ms',nfr:'NFR-17',status:'ok'},
    {id:'u2s5', layer:'DATA',     comp:'Azure Blob Storage',             emoji:'☁️',action:'Client uploads directly to Blob SAS URL',
     plain:'The document goes directly from the browser to cloud storage — the platform server never handles the raw file bytes.',
     detail:'Browser PUT {blobUrl} with Content-Type and x-ms-meta-sha256. Direct client→Blob bypasses platform. BlobCreated event fires on commit.',latency:'~1.8s',nfr:'NFR-17',status:'ok'},
    {id:'u2s6', layer:'SECURITY', comp:'AV/MIME Scanner (Defender)',     emoji:'🔍',action:'Step DOC_SCAN: async AV + MIME magic scan',
     plain:'Every uploaded file is automatically scanned for viruses and checked to ensure its type matches the claimed format.',
     detail:'Event Grid trigger. EICAR scan: CLEAN ✓. MIME magic bytes %PDF-1.4 vs declared application/pdf: MATCH ✓. SHA-256 verify ✓. status=READY.',latency:'~4.2s async',nfr:'NFR-17',status:'ok'},
    {id:'u2s7', layer:'SECURITY', comp:'eSign Provider (Qualified)',      emoji:'✍️',action:'Step ESIGN_CREATE: create signature package',
     plain:'A qualified electronic signature workflow is created at the external signing provider.',
     detail:'POST /esign/packages{signers,documentIds,packageType:"QUALIFIED"}. Idempotent. Provider returns {packageId,signingUrl(30min TTL)}.',latency:'~620ms',nfr:'NFR-18',status:'ok'},
    {id:'u2s8', layer:'GATEWAY',  comp:'eSign Webhook Handler',          emoji:'📬',action:'ESIGN_SIGNED: provider webhook confirmed',
     plain:'The signing provider calls back to confirm the document was signed. The platform verifies the call is genuine.',
     detail:'APIM IP allowlist ✓, rate-limit ✓. Facade: JWS RS256 ✓, timestamp skew 1.8s<5min ✓, Redis nonce SET NX EX 600→OK ✓. status=SIGNED.',latency:'~38ms',nfr:'NFR-18',status:'ok'},
    {id:'u2s9', layer:'SECURITY', comp:'Payment Gateway (PSP)',           emoji:'💳',action:'Step PAYMENT: create 3-DS payment session',
     plain:'A secure payment session is created. The citizen is redirected to the bank for 3-D Secure authentication.',
     detail:'POST /payments/sessions{amount:160,currency:"EUR"}. Idempotency-Key: pay_{appId}. PSP returns {sessionId,redirectUrl}. Zero card data in platform.',latency:'~420ms',nfr:'NFR-18',status:'ok'},
    {id:'u2s10',layer:'GATEWAY',  comp:'Payment Webhook Handler',        emoji:'💰',action:'PAYMENT_CONFIRMED: PSP webhook confirmed',
     plain:'The bank confirms payment was successful. The amount is verified before the saga proceeds.',
     detail:'HMAC-SHA256 verify ✓. Amount 160.00 EUR matches session ✓. status=CONFIRMED. Emit payment_confirmed. Saga advances → SUBMIT.',latency:'~25ms',nfr:'NFR-18',status:'ok'},
    {id:'u2s11',layer:'FACADE',   comp:'API Facade',                     emoji:'🔒',action:'Step SUBMIT: POST with Idempotency-Key',
     plain:'The final submission request is checked to ensure it has never been processed before.',
     detail:'Idempotency-Key: app_{uuid}. Ledger: NOT SEEN → proceed. Validate prerequisites: docs ✓, eSign ✓, payment ✓. Forward to Orchestrator.',latency:'~8ms',nfr:'NFR-15',status:'ok'},
    {id:'u2s12',layer:'INTEROP',  comp:'Consent Gate (SEC)',              emoji:'✅',action:'Final consent re-check before submission',
     plain:'Consent is re-verified one final time before the irreversible submission.',
     detail:'Re-verify purpose=submit. Consent valid ✓. ABAC: callerSubjectHash==application.ownerSubjectHash ✓.',latency:'~15ms',nfr:'NFR-11',status:'ok'},
    {id:'u2s13',layer:'DATA',     comp:'PostgreSQL ODS',                  emoji:'🗄️',action:'Atomic commit: application + idempotency',
     plain:'The submission is committed to the database in a single atomic transaction.',
     detail:'BEGIN. INSERT applications(status="SUBMITTED"). UPDATE saga_instances(completed). INSERT idempotency_ledger(key,expiresAt:+24h). COMMIT. WAL→Debezium.',latency:'~22ms',nfr:'NFR-08',status:'ok'},
    {id:'u2s14',layer:'SECURITY', comp:'Case Management System',          emoji:'📂',action:'Create back-office case',
     plain:'A case is created in the government back-office system for officer review.',
     detail:'POST /cases{applicationId,serviceType:"business-permit"}. Returns {caseRef:"PERMIT-2026-084521",estimatedDays:5}.',latency:'~180ms',nfr:'NFR-03',status:'ok'},
    {id:'u2s15',layer:'SECURITY', comp:'WORM Audit Store',                emoji:'🏛️',action:'Write immutable JWS-signed audit receipt',
     plain:'An unforgeable, legally admissible receipt is written to permanent storage.',
     detail:'JWS-sign{eventType:"application.submitted",corrId,subjectHash,caseRef,timestamp}. WRITE to audit/2026/03/08/{corrId}.jws. Azure immutability: 7yr.',latency:'~45ms',nfr:'NFR-07',status:'ok'},
    {id:'u2s16',layer:'MESSAGING',comp:'Event Grid + Service Bus',        emoji:'📨',action:'Fan-out: submitted + notify + analytics',
     plain:'Domain events are broadcast to notify the citizen, update analytics, and alert the caseworker.',
     detail:'Event Grid: application.submitted→[notification-svc,analytics-Bronze,case-tracker]. Service Bus: case_assigned→caseworker.',latency:'~12ms',nfr:'NFR-06',status:'ok'},
    {id:'u2s17',layer:'OBS',      comp:'App Insights',                    emoji:'📊',action:'Full saga trace: 16 spans, 1 corrId',
     plain:'The entire saga is recorded as one linked trace in the monitoring system.',
     detail:'OTel: submit_saga[5.6s]→prefill[325ms]→rules[45ms]→doc[35ms]→esign[620ms]→payment[420ms]→submit[270ms]→case[180ms]→audit[45ms]. SLO PASS.',latency:'async',nfr:'NFR-26',status:'ok'},
    {id:'u2s18',layer:'CHANNEL',  comp:'Portal SPA',                      emoji:'🎉',action:'Render confirmation + case reference',
     plain:'The citizen sees their case reference number and confirmation message.',
     detail:'Display: ✅ Application submitted. Case reference: PERMIT-2026-084521. Email+SMS sent. Status tracking available at /cases/{ref}.',latency:'~15ms',nfr:'NFR-03',status:'ok'},
  ]
},
'US-4':{
  title:'Webhook Ingress — Anti-Replay & Idempotency',color:'#ec4899',cat:'Integration',
  scenario:'An eSign provider posts a completion callback. The platform verifies the IP, validates JWS cryptographic signature, rejects any replayed nonce, processes idempotently, and writes an immutable audit receipt — all in under 150ms P95.',
  slo:'Verify + upsert P95 ≤ 150ms',
  steps:[
    {id:'u4s1',layer:'GATEWAY', comp:'Azure APIM (IP Allowlist)',  emoji:'🛡️',action:'IP allowlist — provider CIDR check',
     plain:'The gateway rejects any webhook not from the provider\'s known IP range.',
     detail:'Provider IP 45.12.180.22 ∈ 45.12.180.0/24 ✓. Rate 500/min per IP. x-provider-sig header forwarded intact.',latency:'~10ms',nfr:'Security',status:'ok'},
    {id:'u4s2',layer:'FACADE',  comp:'API Facade (JWS Verifier)', emoji:'🔐',action:'Verify JWS RS256 signature',
     plain:'The cryptographic signature on the webhook is verified using the provider\'s public key.',
     detail:'x-provider-sig=JWS compact. Provider pubkey from Key Vault (cached 5min). RS256 verify ✓. Timestamp skew 1.8s<300s ✓.',latency:'~18ms',nfr:'NFR-18',status:'ok'},
    {id:'u4s3',layer:'DATA',    comp:'Redis Nonce Store',          emoji:'⚡',action:'Anti-replay: SET nonce NX EX 600',
     plain:'The unique ID in the webhook is recorded to prevent it being replayed by an attacker.',
     detail:'SET nonce:wh_a3f9bc72e1 "1" NX EX 600 → OK ✓. If NULL (exists): return 200 duplicate_ignored + log replay_detected to Sentinel.',latency:'~3ms',nfr:'Security',status:'ok'},
    {id:'u4s4',layer:'FACADE',  comp:'Idempotency Ledger',         emoji:'🔑',action:'Idempotency-Key double-lock',
     plain:'A second, database-level check ensures the event is never processed twice even under concurrent delivery.',
     detail:'SELECT FROM idempotency_ledger WHERE key=evt_{packageId}_{nonce} FOR UPDATE → NOT FOUND → proceed. INSERT status="processing".',latency:'~8ms',nfr:'NFR-15',status:'ok'},
    {id:'u4s5',layer:'INTEROP', comp:'Orchestrator',               emoji:'🔄',action:'Upsert signature status, advance saga',
     plain:'The application\'s signature status is updated and the saga moves to the payment step.',
     detail:'UPDATE applications SET eSignStatus="SIGNED". UPDATE saga_instances SET currentStep="PAYMENT". UPDATE idempotency_ledger SET status="completed".',latency:'~20ms',nfr:'NFR-06',status:'ok'},
    {id:'u4s6',layer:'MESSAGING',comp:'Event Grid',                emoji:'📨',action:'Publish esign.completed → fan-out',
     plain:'A domain event is published so all interested services learn about the signature completion.',
     detail:'esign.completed→[saga-handler(→PaymentStep),notification-svc(email),analytics-Bronze]. At-least-once with DLQ.',latency:'~8ms',nfr:'NFR-06',status:'ok'},
    {id:'u4s7',layer:'SECURITY',comp:'WORM Audit Store',           emoji:'🏛️',action:'Write audit receipt: esign.completed',
     plain:'An immutable legal receipt records that the signature was verified and processed.',
     detail:'JWS: {eventType:"esign.completed",packageId,applicationId,corrId,signedAt,documentHash}. WORM 7yr retention.',latency:'~40ms',nfr:'NFR-07',status:'ok'},
    {id:'u4s8',layer:'OBS',     comp:'Log Analytics + Sentinel',   emoji:'🔎',action:'Security event log + KQL threat analytics',
     plain:'The event is logged for compliance and evaluated by the SIEM for threat patterns.',
     detail:'{event:"webhook_processed",ipVerified:true,signatureVerified:true,nonceVerified:true,replayDetected:false}. Sentinel: replay>5/min→alert.',latency:'async',nfr:'NFR-26',status:'ok'},
  ]
},
'US-7':{
  title:'Claims → RBAC Enforcement + ACR Step-Up',color:'#ef4444',cat:'Security',
  scenario:'A citizen with standard acr=1 attempts a sensitive DELETE. The platform detects insufficient assurance, issues a step-up challenge, citizen re-authenticates with hardware eID (acr=2), and the operation proceeds after full ABAC ownership verification.',
  slo:'RBAC denial accuracy > 99.99% · Zero false grants (NFR-11)',
  steps:[
    {id:'u7s1',layer:'IDENTITY',comp:'eID IdP',              emoji:'🎫',action:'Token issued with acr=1 (password)',
     plain:'The citizen logs in with just a password, receiving a low-assurance token.',
     detail:'Citizen authenticated with username+password (LoA 1). JWT: {acr:"1",roles:["CITIZEN"]}.',latency:'~200ms',nfr:'NFR-09',status:'ok'},
    {id:'u7s2',layer:'GATEWAY', comp:'APIM JWT Validation',  emoji:'🛡️',action:'APIM validates JWT, extracts claims',
     plain:'The gateway verifies the token and forwards the extracted claims downstream.',
     detail:'validate-jwt ✓. Extract acr="1",roles=["CITIZEN"] to context. Forward to Facade.',latency:'~11ms',nfr:'NFR-09',status:'ok'},
    {id:'u7s3',layer:'IDENTITY',comp:'Claims Mapper (RBAC)', emoji:'🗂️',action:'ACR threshold check — DELETE requires acr=2',
     plain:'The platform detects this operation needs a higher-assurance login and rejects with a specific hint.',
     detail:'Operation DELETE requires acr≥2. Current acr=1<2. HTTP 403: {type:"/errors/step_up_required",acrRequired:2,hint:"Re-auth with eID Midden"}.',latency:'<5ms',nfr:'NFR-11',status:'error'},
    {id:'u7s4',layer:'CHANNEL', comp:'Portal SPA',           emoji:'🔄',action:'Trigger OIDC ACR step-up re-auth',
     plain:'The portal initiates a fresh login flow requesting a higher assurance level from the ID provider.',
     detail:'New authorize request: acr_values="2 1", prompt=login. Citizen authenticates with hardware token. New tokens: acr="2".',latency:'~2.1s',nfr:'NFR-09',status:'ok'},
    {id:'u7s5',layer:'GATEWAY', comp:'APIM (retry, acr=2)',  emoji:'🛡️',action:'Re-validate token — acr=2 passes',
     plain:'The new high-assurance token passes the gateway check.',
     detail:'New JWT acr="2". threshold check: required=2,actual=2 ✓. RBAC: CITIZEN has DELETE:own_application ✓.',latency:'~11ms',nfr:'NFR-09',status:'ok'},
    {id:'u7s6',layer:'FACADE',  comp:'API Facade (ABAC)',    emoji:'🔒',action:'ABAC ownership check: caller == owner',
     plain:'The platform verifies the citizen can only delete their own application, never someone else\'s.',
     detail:'callerSubjectHash==application.ownerSubjectHash ✓. Mismatch→403 resource_forbidden. Officers bypass via explicit role+scope.',latency:'~20ms',nfr:'NFR-11',status:'ok'},
    {id:'u7s7',layer:'INTEROP', comp:'Orchestrator',         emoji:'🔄',action:'Business-level auth: state allows delete?',
     plain:'The application\'s current state is checked — only drafts can be deleted, not submitted applications.',
     detail:'application.status="DRAFT"→deletion permitted. If SUBMITTED→409 Conflict. Soft-delete: deleted_at=now(). Cascade to linked docs.',latency:'~25ms',nfr:'NFR-11',status:'ok'},
    {id:'u7s8',layer:'OBS',     comp:'Sentinel SIEM',        emoji:'🔎',action:'Step-up event logged + threat analytics',
     plain:'The step-up event is logged for compliance and monitored for brute-force patterns.',
     detail:'{event:"acr_step_up_triggered",resolved:true,corrId}. KQL: step_up_rate>20/min for same IP→alert (credential stuffing probe).',latency:'async',nfr:'NFR-26',status:'ok'},
  ]
},
'US-9':{
  title:'Saga Compensation on Case-Creation Failure',color:'#3b82f6',cat:'Architecture',
  scenario:'A full application saga fails at the final case-creation step after 3 retries. The orchestrator compensates: marks failed, issues full refund, parks to DLQ, and writes an immutable compensation receipt.',
  slo:'Saga completion ≥ 99.5% · Compensation completes < 60s',
  steps:[
    {id:'u9s1',layer:'INTEROP', comp:'Orchestrator (Saga State)',   emoji:'🎭',action:'Steps 1–5 complete, entering CASE_CREATE',
     plain:'All previous saga steps completed successfully. Payment collected. About to create the back-office case.',
     detail:'saga_instances: completedSteps:["PREFILL","RULES","ESIGN","PAYMENT","SUBMIT"]. Payment confirmed €160.',latency:'~5ms',nfr:'NFR-06',status:'ok'},
    {id:'u9s2',layer:'SECURITY',comp:'Case Management System',       emoji:'❌',action:'POST /cases returns 503 (3 retries exhausted)',
     plain:'The back-office case system is unavailable. After 3 retries the orchestrator gives up and begins compensation.',
     detail:'503 on attempts 1,2,3 (100ms,200ms,400ms waits). Circuit breaker→OPEN. Saga→COMPENSATING.',latency:'~700ms',nfr:'NFR-06',status:'error'},
    {id:'u9s3',layer:'INTEROP', comp:'Orchestrator (Compensation)', emoji:'🔙',action:'Build reverse compensation plan',
     plain:'The orchestrator builds a reverse execution plan to undo everything that succeeded.',
     detail:'Compensation plan: [UNDO_SUBMIT(mark failed), UNDO_PAYMENT(refund €160)]. PREFILL/RULES/ESIGN have no side effects.',latency:'~5ms',nfr:'NFR-06',status:'ok'},
    {id:'u9s4',layer:'DATA',    comp:'PostgreSQL ODS',               emoji:'🗄️',action:'Compensation 1: mark application FAILED',
     plain:'The application record is marked as failed with the reason recorded for audit.',
     detail:'UPDATE applications SET status="COMPENSATION_FAILED",failureReason="case_503_max_retries". Preserved for ops.',latency:'~20ms',nfr:'NFR-08',status:'ok'},
    {id:'u9s5',layer:'SECURITY',comp:'PSP Refund',                   emoji:'💳',action:'Compensation 2: refund €160',
     plain:'The payment is automatically refunded to the citizen.',
     detail:'POST /payments/{id}/refund{amount:160,reason:"application_failed_compensation"}. Idempotent. Returns {refundId,status:"processing"}.',latency:'~380ms',nfr:'NFR-18',status:'ok'},
    {id:'u9s6',layer:'MESSAGING',comp:'Service Bus DLQ',             emoji:'📦',action:'Park failed saga to DLQ for operator',
     plain:'The full saga context is parked for an operator to review and potentially re-drive.',
     detail:'Send to saga-dlq: {sagaId,failedStep:"CASE_CREATION",compensationComplete:true,refundId,allStepOutputs}. Age alert >4h.',latency:'~12ms',nfr:'NFR-24',status:'ok'},
    {id:'u9s7',layer:'SECURITY',comp:'WORM Audit Store',             emoji:'🏛️',action:'Write compensation audit receipt',
     plain:'An immutable legal record shows the refund was automatically triggered by the platform.',
     detail:'JWS: {eventType:"saga.compensation_complete",stepsCompensated:["SUBMIT","PAYMENT"],refundAmount:160}. WORM 7yr.',latency:'~42ms',nfr:'NFR-07',status:'ok'},
    {id:'u9s8',layer:'MESSAGING',comp:'Event Grid — Notifications',  emoji:'📨',action:'Notify citizen: failed + refund initiated',
     plain:'The citizen is informed of the failure and told their refund is on the way.',
     detail:'Email: "Application failed. Full refund of €160 initiated (3-5 business days). Reference: {corrId}."',latency:'~8ms',nfr:'NFR-06',status:'ok'},
    {id:'u9s9',layer:'OBS',     comp:'App Insights + SLO Dashboard', emoji:'🚨',action:'SLO burn-rate check after failure',
     plain:'The monitoring system checks whether this failure threatens the monthly availability SLO.',
     detail:'submit_success_rate: 99.9% (above 99.5% SLO). Burn-rate 1.2× (below 6× page threshold). KQL dashboard updated.',latency:'async',nfr:'NFR-26',status:'ok'},
  ]
},
'US-5':{
  title:'MDM Cache Invalidation — Once-Only Freshness',color:'#06b6d4',cat:'Data',
  scenario:'A citizen updates their address at the municipality. Within 60 seconds the platform detects the SoR change event, verifies consent, fetches fresh data, rotates the ETag, and notifies active portal sessions.',
  slo:'Stale field rate < 2% · Cache refresh within 60s (NFR-25)',
  steps:[
    {id:'u5s1',layer:'MESSAGING',comp:'Event Grid (SoR Change)',     emoji:'📡',action:'Municipality emits address.changed event',
     plain:'The municipality signals that a citizen\'s address has been updated.',
     detail:'Event: {eventType:"sor.address_changed",subject:"/registries/address",data:{subjectHash,registryId:"AD_ADDR"}}. At-least-once delivery.',latency:'~5ms',nfr:'NFR-06',status:'ok'},
    {id:'u5s2',layer:'INTEROP', comp:'Orchestrator (Invalidation)',  emoji:'🎯',action:'Receive + validate SoR event, route',
     plain:'The platform receives the change notification and identifies which cache entries are affected.',
     detail:'Validate event schema ✓. Extract subjectHash, registryId="AD_ADDR". Affected keys: mdm:{hash}:address. Active sessions: 1 found.',latency:'~12ms',nfr:'NFR-25',status:'ok'},
    {id:'u5s3',layer:'IDENTITY',comp:'Consent Gate (SEC)',           emoji:'✅',action:'Verify consent to re-fetch address',
     plain:'The platform checks it has the citizen\'s consent before calling the registry.',
     detail:'Consent purpose=once_only_refresh, scope=address: GRANTED ✓. Without consent→mark STALE, do not fetch.',latency:'~15ms',nfr:'NFR-11',status:'ok'},
    {id:'u5s4',layer:'REGISTRY',comp:'Address Registry (AD_ADDR)',   emoji:'📬',action:'Fetch fresh address from registry',
     plain:'The latest address is retrieved from the authoritative government registry.',
     detail:'Circuit breaker CLOSED ✓. GET /adapters/address?subjectHash. Returns {street:"Nieuwe Kade 42",postcode:"2514AB",municipality:"Den Haag"}.',latency:'~185ms',nfr:'NFR-06',status:'ok'},
    {id:'u5s5',layer:'INTEROP', comp:'MapVal + DQ Engine',           emoji:'🔄',action:'Map + validate fresh address',
     plain:'The new address is normalised and validated against the platform\'s quality rules.',
     detail:'DQ hard: postcode ^[0-9]{4}[A-Z]{2}$ ✓, street non-empty ✓, municipality in ref-list ✓. PASS.',latency:'~5ms',nfr:'NFR-10',status:'ok'},
    {id:'u5s6',layer:'DATA',    comp:'Redis MDM Cache',               emoji:'⚡',action:'Atomic cache swap + ETag rotation',
     plain:'The old cached address is atomically replaced with the new one.',
     detail:'MULTI/EXEC: DEL mdm:{hash}:address → SET mdm:{hash}:address {new} EX 86400. New ETag "f9a3...". EXEC: 2/2 ✓.',latency:'~4ms',nfr:'NFR-16',status:'ok'},
    {id:'u5s7',layer:'MESSAGING',comp:'Redis Pub/Sub',                emoji:'📣',action:'Push invalidation to active sessions',
     plain:'Any open portal sessions for this citizen are notified that their pre-filled data has changed.',
     detail:'PUBLISH invalidation:{hash} "address_refreshed". Active portal session receives push, can silently re-fetch.',latency:'~2ms',nfr:'NFR-25',status:'ok'},
    {id:'u5s8',layer:'OBS',     comp:'Log Analytics',                 emoji:'📋',action:'Update stale_field_rate metric',
     plain:'The monitoring dashboard confirms the stale field rate remains below the 2% SLO.',
     detail:'stale_field_rate{registry:"AD_ADDR"}=0.3%<2% ✓. Log: {event:"mdm_invalidation_complete",latencyMs:219}.',latency:'async',nfr:'NFR-25',status:'ok'},
  ]
},
'US-26':{
  title:'Real-Time Threat Detection (Sentinel + SOAR)',color:'#ef4444',cat:'Security',
  scenario:'500 failed login attempts from one IP in 5 minutes, followed by impossible-travel anomaly. Sentinel correlates both patterns, creates a HIGH incident, and SOAR auto-blocks the IP in the WAF within 10 minutes.',
  slo:'P1 threat containment MTTR ≤ 30min (NFR-30)',
  steps:[
    {id:'u26s1',layer:'GATEWAY', comp:'APIM Rate Limiter',             emoji:'🛡️',action:'500 auth failures/5min from one IP',
     plain:'The gateway detects and rejects a flood of failed login attempts from a single IP address.',
     detail:'Rate-limit 100/min per IP. 500 failures in 5min from 198.51.100.42. 429 returned per breach. All logged to Log Analytics.',latency:'<1ms',nfr:'Security',status:'warn'},
    {id:'u26s2',layer:'OBS',     comp:'Log Analytics (Ingestion)',      emoji:'📥',action:'Stream security logs to workspace',
     plain:'All authentication failures are streamed to the central log analytics workspace.',
     detail:'APIM Diagnostic Settings→Log Analytics. Average ingestion latency ~45s. ~2,000 events/min at normal load.',latency:'~45s',nfr:'NFR-26',status:'ok'},
    {id:'u26s3',layer:'OBS',     comp:'Sentinel KQL Analytics',         emoji:'🔎',action:'KQL: detect credential stuffing pattern',
     plain:'A scheduled query detects the spike in failures from a single IP.',
     detail:'KQL: SigninLogs | where ResultType!="0" | summarize FailCount by IPAddress,bin(5m) | where FailCount>100. IP→FailCount=500 ✓. Severity: HIGH.',latency:'~5min',nfr:'NFR-30',status:'warn'},
    {id:'u26s4',layer:'OBS',     comp:'Sentinel (Impossible Travel)',    emoji:'✈️',action:'KQL: detect impossible travel anomaly',
     plain:'A second rule detects the same account logging in from two countries 7,200km apart within 4 minutes.',
     detail:'NL login 08:22 + US-NYC 08:18, distance 7,200km, delta 4min → impossible ✓. Fusion correlates both entities.',latency:'~2min',nfr:'NFR-30',status:'warn'},
    {id:'u26s5',layer:'OBS',     comp:'Sentinel Incident Engine',        emoji:'🚨',action:'Fuse alerts → HIGH severity incident',
     plain:'The two correlated threat signals are merged into a single HIGH priority incident.',
     detail:'Fusion: credential_stuffing + impossible_travel on same IP → Incident{severity:"High",tactics:["InitialAccess"]}. Teams P1 alert.',latency:'~1min',nfr:'NFR-30',status:'error'},
    {id:'u26s6',layer:'SECURITY',comp:'SOAR Playbook',                   emoji:'🤖',action:'Auto-block IP in Front Door WAF',
     plain:'An automated playbook enriches the IP reputation and immediately blocks it in the web firewall.',
     detail:'Logic App: TI enrichment→malicious:true ✓. WAF API: add custom rule block IP 198.51.100.42 (priority:1,action:Block).',latency:'~3min',nfr:'NFR-30',status:'ok'},
    {id:'u26s7',layer:'SECURITY',comp:'SOAR — Account Protection',       emoji:'🔒',action:'Force re-auth for targeted account',
     plain:'All active sessions for the targeted account are invalidated to prevent unauthorized access.',
     detail:'POST /auth/admin/users/{hash}/logout. Revoke all refresh tokens. Next visit forces full re-authentication.',latency:'~1min',nfr:'Security',status:'ok'},
    {id:'u26s8',layer:'OBS',     comp:'Sentinel — MTTR Measurement',     emoji:'📊',action:'MTTR 10min — SLO met (≤30min)',
     plain:'The total time from first alert to full containment is measured and recorded against the SLO.',
     detail:'Detection T+0, incident T+6min, WAF block T+9min, account protection T+10min. MTTR=10min<30min ✓.',latency:'10min total',nfr:'NFR-30',status:'ok'},
  ]
},
'US-28':{
  title:'Cache-First Prefill — MDM Performance Path',color:'#16a34a',cat:'Data',
  scenario:'A returning citizen with a warm MDM cache triggers a prefill. All three registry bundles hit Redis. Total latency: 42ms — demonstrating the performance architecture that makes once-only viable at national scale.',
  slo:'Cache hit P95 ≤ 600ms · Cache hit-rate ≥ 80% (NFR-16)',
  steps:[
    {id:'u28s1',layer:'GATEWAY', comp:'Azure APIM Premium',            emoji:'🛡️',action:'JWT validate + rate-limit (returning citizen)',
     plain:'The returning citizen\'s token is validated quickly from the gateway\'s cached JWKS.',
     detail:'JWT: issued 8min ago (within 15min TTL). JWKS cache hit. rate-limit counter=3/100. APIM adds corrId. Total: 11ms.',latency:'~11ms',nfr:'NFR-09',status:'ok'},
    {id:'u28s2',layer:'INTEROP', comp:'Consent Gate (cached)',          emoji:'✅',action:'Consent check — fast cache path',
     plain:'The consent check is served from Redis, avoiding a database round trip.',
     detail:'GET consent_cache:{hash}:prefill → HIT (TTL:1h remaining). Return GRANTED without hitting PostgreSQL.',latency:'~3ms',nfr:'NFR-11',status:'ok'},
    {id:'u28s3',layer:'DATA',    comp:'Redis MDM (civil)',               emoji:'⚡',action:'GET civil → CACHE HIT (1.2ms)',
     plain:'Civil identity data is returned instantly from Redis.',
     detail:'HIT ✓. {name,dob,nationality}. ETag:"a3f9", TTL:86h. Latency: 1.2ms.',latency:'1.2ms ✓',nfr:'NFR-16',status:'ok'},
    {id:'u28s4',layer:'DATA',    comp:'Redis MDM (address)',             emoji:'⚡',action:'GET address → CACHE HIT (0.9ms)',
     plain:'Address data is returned instantly from Redis (recently refreshed by invalidation).',
     detail:'HIT ✓. {street:"Nieuwe Kade 42",postcode:"2514AB"}. ETag:"f9a3" (updated 2h ago). TTL:22h. Latency: 0.9ms.',latency:'0.9ms ✓',nfr:'NFR-16',status:'ok'},
    {id:'u28s5',layer:'DATA',    comp:'Redis MDM (business)',            emoji:'⚡',action:'GET business → CACHE HIT (1.1ms)',
     plain:'Business registration data is returned instantly from Redis.',
     detail:'HIT ✓. {entityName,kvk:"87654321",status:"active"}. ETag:"c2b8", TTL:3h. Latency: 1.1ms. 3/3 cache hits.',latency:'1.1ms ✓',nfr:'NFR-16',status:'ok'},
    {id:'u28s6',layer:'INTEROP', comp:'Orchestrator',                    emoji:'📦',action:'Assemble bundle from 3 cache hits',
     plain:'The three cached bundles are merged and filtered. No registry calls needed.',
     detail:'Merge civil+address+business from cache. Scope-filter applied. cacheHitRate:1.0. HTTP 200 in 4ms.',latency:'~4ms',nfr:'NFR-01',status:'ok'},
    {id:'u28s7',layer:'OBS',     comp:'App Insights',                    emoji:'📡',action:'Trace: 42ms total, 100% cache hit',
     plain:'The full request completes in 42ms — well within the 600ms SLO — with zero registry calls.',
     detail:'prefill[42ms total]→consent_cache[3ms]→civil[1.2ms]→address[0.9ms]→business[1.1ms]→assemble[4ms]. No adapter calls. SLO: 42ms<<600ms ✓.',latency:'42ms ✓',nfr:'NFR-26',status:'ok'},
  ]
},
};

/* ══════════════════════════════════════════════════════════════════════════
   KNOWLEDGE GRAPH — NODE/EDGE LAYOUT
   Fixed positions in a 900×520 coordinate space.
   Nodes represent unique (layer, comp) pairs across ALL stories.
   Edges built from consecutive steps within each story.
══════════════════════════════════════════════════════════════════════════ */

// Canonical node positions — hand-laid for readability
const KG_NODES = {
  // CHANNEL row (top)
  'CHANNEL::Browser':           {x:60,  y:50,  label:'Browser',          layer:'CHANNEL'},
  'CHANNEL::Portal SPA':        {x:180, y:50,  label:'Portal SPA',       layer:'CHANNEL'},
  // IDENTITY
  'IDENTITY::eID IdP':          {x:320, y:50,  label:'eID IdP',          layer:'IDENTITY'},
  'IDENTITY::Claims Mapper':    {x:460, y:50,  label:'Claims Mapper',    layer:'IDENTITY'},
  // GATEWAY
  'GATEWAY::APIM':              {x:600, y:50,  label:'APIM',             layer:'GATEWAY'},
  // FACADE
  'FACADE::API Facade':         {x:740, y:50,  label:'API Facade',       layer:'FACADE'},
  // INTEROP core (middle row)
  'INTEROP::Consent Gate':      {x:120, y:180, label:'Consent Gate',     layer:'INTEROP'},
  'INTEROP::Orchestrator':      {x:300, y:180, label:'Orchestrator',     layer:'INTEROP'},
  'INTEROP::Rules Engine':      {x:470, y:180, label:'Rules Engine',     layer:'INTEROP'},
  'INTEROP::MapVal':            {x:620, y:180, label:'MapVal',           layer:'INTEROP'},
  'INTEROP::DQ Engine':         {x:760, y:180, label:'DQ Engine',        layer:'INTEROP'},
  // REGISTRY row
  'REGISTRY::AD_BUS':           {x:80,  y:310, label:'AD_BUS',           layer:'REGISTRY'},
  'REGISTRY::AD_ADDR':          {x:200, y:310, label:'AD_ADDR',          layer:'REGISTRY'},
  'REGISTRY::AD_CIV':           {x:320, y:310, label:'AD_CIV',           layer:'REGISTRY'},
  // SECURITY
  'SECURITY::DOCI':             {x:450, y:310, label:'DOCI',             layer:'SECURITY'},
  'SECURITY::eSign Provider':   {x:570, y:310, label:'eSign',            layer:'SECURITY'},
  'SECURITY::PSP':              {x:680, y:310, label:'PSP',              layer:'SECURITY'},
  'SECURITY::CMS':              {x:790, y:310, label:'CMS',              layer:'SECURITY'},
  'SECURITY::WORM Audit':       {x:870, y:180, label:'WORM Audit',       layer:'SECURITY'},
  'SECURITY::SOAR':             {x:870, y:310, label:'SOAR',             layer:'SECURITY'},
  // DATA
  'DATA::Redis MDM':            {x:120, y:430, label:'Redis MDM',        layer:'DATA'},
  'DATA::Blob Storage':         {x:300, y:430, label:'Blob Storage',     layer:'DATA'},
  'DATA::PostgreSQL':           {x:480, y:430, label:'PostgreSQL',       layer:'DATA'},
  // MESSAGING
  'MESSAGING::Event Grid':      {x:640, y:430, label:'Event Grid',       layer:'MESSAGING'},
  'MESSAGING::Service Bus DLQ': {x:780, y:430, label:'DLQ',              layer:'MESSAGING'},
  // OBS
  'OBS::App Insights':          {x:930, y:50,  label:'App Insights',     layer:'OBS'},
  'OBS::Sentinel':              {x:930, y:180, label:'Sentinel',         layer:'OBS'},
};

// Map step comp strings to KG node keys
function stepToNodeKey(layer, comp) {
  const c = comp.toLowerCase();
  if (layer==='CHANNEL')  { if(c.includes('portal')) return 'CHANNEL::Portal SPA'; return 'CHANNEL::Browser'; }
  if (layer==='IDENTITY') { if(c.includes('claim')) return 'IDENTITY::Claims Mapper'; return 'IDENTITY::eID IdP'; }
  if (layer==='GATEWAY')  return 'GATEWAY::APIM';
  if (layer==='FACADE')   return 'FACADE::API Facade';
  if (layer==='INTEROP')  {
    if(c.includes('consent')) return 'INTEROP::Consent Gate';
    if(c.includes('rule'))    return 'INTEROP::Rules Engine';
    if(c.includes('mapval')||c.includes('mapping')) return 'INTEROP::MapVal';
    if(c.includes('dq')||c.includes('quality'))     return 'INTEROP::DQ Engine';
    return 'INTEROP::Orchestrator';
  }
  if (layer==='REGISTRY') {
    if(c.includes('addr')) return 'REGISTRY::AD_ADDR';
    if(c.includes('civ'))  return 'REGISTRY::AD_CIV';
    return 'REGISTRY::AD_BUS';
  }
  if (layer==='SECURITY') {
    if(c.includes('doci')||c.includes('document intake')) return 'SECURITY::DOCI';
    if(c.includes('esign')||c.includes('sign'))  return 'SECURITY::eSign Provider';
    if(c.includes('psp')||c.includes('payment gateway')||c.includes('refund')) return 'SECURITY::PSP';
    if(c.includes('case')) return 'SECURITY::CMS';
    if(c.includes('worm')||c.includes('audit')) return 'SECURITY::WORM Audit';
    if(c.includes('soar')||c.includes('playbook')) return 'SECURITY::SOAR';
    if(c.includes('av')||c.includes('defender')||c.includes('scanner')||c.includes('scan')) return 'SECURITY::DOCI';
    return 'SECURITY::WORM Audit';
  }
  if (layer==='DATA') {
    if(c.includes('redis')||c.includes('mdm')) return 'DATA::Redis MDM';
    if(c.includes('blob')) return 'DATA::Blob Storage';
    if(c.includes('redis nonce')||c.includes('nonce')) return 'DATA::Redis MDM';
    return 'DATA::PostgreSQL';
  }
  if (layer==='MESSAGING') {
    if(c.includes('dlq')||c.includes('service bus')) return 'MESSAGING::Service Bus DLQ';
    if(c.includes('pub/sub')) return 'MESSAGING::Event Grid';
    return 'MESSAGING::Event Grid';
  }
  if (layer==='OBS') {
    if(c.includes('sentinel')) return 'OBS::Sentinel';
    return 'OBS::App Insights';
  }
  return null;
}

// Build per-story edge lists and node sets
const STORY_GRAPH = {};
Object.entries(SIM).forEach(([sid, story]) => {
  const nodes = new Set();
  const edges = [];
  let prevKey = null;
  story.steps.forEach((step, i) => {
    const key = stepToNodeKey(step.layer, step.comp);
    if (!key) return;
    nodes.add(key);
    if (prevKey && prevKey !== key) {
      edges.push({
        from: prevKey, to: key,
        msg: step.action,
        detail: step.detail,
        plain: step.plain,
        latency: step.latency,
        nfr: step.nfr,
        stepId: step.id,
        isFinal: i === story.steps.length - 1,
        status: step.status,
        color: story.color,
      });
    }
    prevKey = key;
  });
  STORY_GRAPH[sid] = { nodes, edges };
});

/* ══════════════════════════════════════════════════════════════════════════
   EXECUTIVE SUMMARY
══════════════════════════════════════════════════════════════════════════ */
const EXEC_STATS=[
  {label:'User Stories',value:'38',sub:'Fully mapped to architecture',color:'#f97316',icon:'📋'},
  {label:'Architecture Layers',value:'10',sub:'Channel → BI pipeline',color:'#3b82f6',icon:'🏗️'},
  {label:'Availability SLO',value:'99.9%',sub:'43.8 min/month budget',color:'#22c55e',icon:'⚡'},
  {label:'P95 Prefill',value:'≤600ms',sub:'Cache-hit path (42ms typical)',color:'#8b5cf6',icon:'⏱️'},
  {label:'Data RPO',value:'≤5min',sub:'WAL replication lag',color:'#ef4444',icon:'💾'},
  {label:'DR RTO',value:'≤60min',sub:'Region A→B warm standby',color:'#f59e0b',icon:'🔄'},
];
const EXEC_PILLARS=[
  {icon:'🔐',title:'Zero-Trust Security',color:'#ef4444',
   points:['PKCE S256 prevents auth-code interception at every channel','5 nested trust boundaries — every request traverses all five','Consent gate before 100% of registry calls — zero bypass','WORM JWS audit receipts: 7yr immutable retention']},
  {icon:'🔁',title:'Once-Only Principle',color:'#3b82f6',
   points:['Redis MDM cache with per-registry ETag/TTL','Event-driven invalidation within 60s of SoR change','Stale field rate SLO < 2% (NFR-25)','6 adapters → one Canonical DTO model']},
  {icon:'⚡',title:'API-First Design',color:'#f97316',
   points:['Versioned contracts with RFC 8594 Deprecation+Sunset','Idempotency-Key ledger: all POST/PUT safe to retry','problem+json canonical errors across all 38 endpoints','APIM sole entry point — no backend has a public IP']},
  {icon:'☁️',title:'Azure Cloud Native',color:'#8b5cf6',
   points:['Container Apps + KEDA — scales to zero in DR','Zone-redundant PostgreSQL Flexible + geo-DR (WAL ≤5min)','Cosmos DB multi-region — automatic failover < 1min','Direct Lake Power BI: zero-ETL from Delta Gold']},
  {icon:'📊',title:'Observability-Driven SRE',color:'#06b6d4',
   points:['W3C traceparent on every request — 30+ hops traced','Multi-window SLO burn-rate alerts (14×/6× model)','OTel tail sampling: 100% of error + slow traces','SOAR auto-blocks brute-force IPs in WAF within 5min']},
  {icon:'🧪',title:'Resilience Engineered',color:'#22c55e',
   points:['Circuit breaker on all 6 registry adapters','Saga compensation — no orphaned payments','6 chaos experiments map 1:1 to NFR claims','Monthly chaos staging + quarterly production drill']},
];

function buildExecSummary(){
  const panel=document.getElementById('panel-exec');
  if(!panel||panel.dataset.built) return; panel.dataset.built='1';
  const w=el('div','padding:20px 28px 48px');
  // hero
  const hero=el('div','background:linear-gradient(135deg,#0f0f0e 0%,#1e1008 55%,#0f0f0e 100%);border-radius:14px;padding:28px 36px;margin-bottom:20px;position:relative;overflow:hidden');
  hero.innerHTML=`<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 75% 50%,rgba(249,115,22,0.13),transparent 65%);pointer-events:none"></div>
    <div style="position:relative">
      <div style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:#f97316;letter-spacing:.14em;text-transform:uppercase;margin-bottom:12px">National E-Services Interoperability Platform — Architecture Review v8</div>
      <div style="font-size:1.6rem;font-weight:800;color:#fff;line-height:1.2;margin-bottom:14px;letter-spacing:-.025em">Zero-trust · API-first · Once-only<br><span style="color:#f97316">national interoperability platform</span></div>
      <div style="font-size:.8rem;color:rgba(255,255,255,.6);line-height:1.75;max-width:640px;margin-bottom:20px">The technical backbone connecting <strong style="color:rgba(255,255,255,.9)">6 government registries</strong> to <strong style="color:rgba(255,255,255,.9)">38 citizen service journeys</strong>. Use the <span style="color:#f97316;font-weight:700">Simulation</span> tab to watch any user story execute component-by-component with a live knowledge graph.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${['Zero-Trust','OIDC+PKCE','Once-Only','API-First','OpenTelemetry','Azure Cloud','Saga Orchestration','WORM Audit'].map(t=>`<span style="font-family:'JetBrains Mono',monospace;font-size:.6rem;padding:3px 10px;border-radius:20px;border:1px solid rgba(249,115,22,.3);color:#f97316;background:rgba(249,115,22,.07)">${t}</span>`).join('')}</div>
    </div>`;
  w.appendChild(hero);
  // stats
  const sg=el('div','display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:22px');
  EXEC_STATS.forEach(s=>{const c=el('div',`background:var(--bg-surface);border:1px solid var(--border);border-radius:11px;padding:14px 16px;position:relative;overflow:hidden;box-shadow:var(--shadow-xs)`);c.innerHTML=`<div style="position:absolute;top:0;left:0;right:0;height:3px;background:${s.color};border-radius:11px 11px 0 0"></div><div style="font-size:1.1rem;margin:2px 0 6px">${s.icon}</div><div style="font-family:'JetBrains Mono',monospace;font-size:1.35rem;font-weight:800;color:${s.color};line-height:1;margin-bottom:5px">${s.value}</div><div style="font-size:.62rem;font-weight:700;color:var(--text-1);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">${s.label}</div><div style="font-size:.63rem;color:var(--text-3)">${s.sub}</div>`;sg.appendChild(c);});
  w.appendChild(sg);
  // pillars
  w.appendChild(el('div','font-size:.67rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin-bottom:12px;padding-bottom:7px;border-bottom:1px solid var(--border)','Six Architectural Pillars'));
  const pg=el('div','display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px');
  EXEC_PILLARS.forEach(p=>{const c=el('div',`background:var(--bg-surface);border:1.5px solid ${ha(p.color,.18)};border-radius:11px;padding:16px 18px`);c.innerHTML=`<div style="display:flex;align-items:center;gap:9px;margin-bottom:11px"><div style="font-size:1.15rem">${p.icon}</div><div style="font-size:.76rem;font-weight:700;color:${p.color}">${p.title}</div></div><ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px">${p.points.map(pt=>`<li style="font-size:.72rem;color:var(--text-2);padding-left:14px;position:relative;line-height:1.6"><span style="position:absolute;left:0;color:${p.color};font-weight:700;font-size:.65rem;top:2px">▸</span>${pt}</li>`).join('')}</ul>`;pg.appendChild(c);});
  w.appendChild(pg);
  // CTA
  const cta=el('div',`background:linear-gradient(135deg,${ha('#f97316',.07)},${ha('#3b82f6',.05)});border:1.5px solid ${ha('#f97316',.3)};border-radius:12px;padding:18px 24px;display:flex;align-items:center;gap:18px`);
  cta.innerHTML=`<div style="font-size:2rem;flex-shrink:0">🧪</div><div style="flex:1"><div style="font-size:.85rem;font-weight:800;color:var(--text-1);margin-bottom:4px">PhD-Level Simulation Playground</div><div style="font-size:.74rem;color:var(--text-2);line-height:1.65">Step-by-step execution across all architecture layers with a live knowledge graph — nodes pulse, edges animate, click any element for plain + technical detail.</div></div><button id="exec-goto-sim" style="background:var(--accent);color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:.76rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0">Open Playground →</button>`;
  cta.querySelector('#exec-goto-sim').addEventListener('click',()=>document.querySelector('[data-tab="sim"]')?.click());
  w.appendChild(cta);
  panel.appendChild(w);
}

/* ══════════════════════════════════════════════════════════════════════════
   SIMULATION STATE
══════════════════════════════════════════════════════════════════════════ */
const SS={storyId:null,stepIdx:-1,running:false,timer:null,speed:700};
/* ══════════════════════════════════════════════════════════════════════════
   BUILD SIMULATION PLAYGROUND
══════════════════════════════════════════════════════════════════════════ */
function buildSim(){
  const panel=document.getElementById('panel-sim');
  if(!panel||panel.dataset.built) return; panel.dataset.built='1';
  panel.style.cssText='height:calc(100vh - 124px);overflow:hidden';

  // 4-column grid: left(story list) | centre-top(feed) | right-top(checklist) | right-bottom(KG)
  // We actually use a 3-col grid: [260px left] [1fr centre] [380px right]
  const shell=el('div','display:grid;grid-template-columns:240px 1fr 340px;height:100%;overflow:hidden');

  /* ── LEFT: story selector ── */
  const left=el('div','border-right:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column;background:var(--bg-surface)');
  left.appendChild(el('div','padding:12px 14px 10px;border-bottom:1px solid var(--border);flex-shrink:0',
    `<div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin-bottom:4px">Choose User Story</div>
     <div style="font-size:.65rem;color:var(--text-2)">8 simulations · live knowledge graph</div>`));
  const storyList=el('div','padding:7px;flex:1;overflow-y:auto');
  const catOrder=['Core','Integration','Security','Architecture','Data'];
  const byCat={};
  Object.entries(SIM).forEach(([id,s])=>{(byCat[s.cat]||(byCat[s.cat]=[])).push([id,s]);});
  catOrder.forEach(cat=>{
    if(!byCat[cat]) return;
    storyList.appendChild(el('div','font-size:.56rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-3);padding:5px 6px 2px;margin-top:3px',cat));
    byCat[cat].forEach(([id,s])=>{
      const item=el('div',`padding:7px 10px;border-radius:7px;cursor:pointer;margin-bottom:3px;border:1.5px solid transparent;transition:all .15s`);
      item.id=`sim-item-${id}`;
      item.innerHTML=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><div style="width:6px;height:6px;border-radius:2px;background:${s.color};flex-shrink:0"></div><span style="font-family:'JetBrains Mono',monospace;font-size:.57rem;font-weight:700;color:${s.color}">${id}</span><span style="font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--text-3)">${s.steps.length} steps</span></div><div style="font-size:.66rem;font-weight:600;color:var(--text-1);line-height:1.3">${s.title}</div>`;
      item.addEventListener('mouseenter',()=>{if(SS.storyId!==id)item.style.background='var(--bg-elevated)';});
      item.addEventListener('mouseleave',()=>{if(SS.storyId!==id){item.style.background='';item.style.borderColor='transparent';}});
      item.addEventListener('click',()=>loadStory(id));
      storyList.appendChild(item);
    });
  });
  left.appendChild(storyList);
  // speed
  const spWrap=el('div','padding:9px;border-top:1px solid var(--border);flex-shrink:0',
    `<div style="font-size:.57rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:5px">Speed</div>
     <div style="display:flex;gap:4px">
       <button class="sp-btn" data-v="1100" style="flex:1;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-2);font-size:.58rem;cursor:pointer">🐢</button>
       <button class="sp-btn active-sp" data-v="700" style="flex:1;padding:3px 5px;border-radius:4px;border:1px solid var(--accent);background:var(--accent);color:#fff;font-size:.58rem;cursor:pointer">▶</button>
       <button class="sp-btn" data-v="280" style="flex:1;padding:3px 5px;border-radius:4px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-2);font-size:.58rem;cursor:pointer">⚡</button>
     </div>`);
  left.appendChild(spWrap);

  /* ── CENTRE: trace feed ── */
  const centre=el('div','display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border);position:relative');
  // ctrl bar
  const ctrl=el('div','display:flex;align-items:center;gap:7px;padding:8px 12px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-surface)');
  ctrl.innerHTML=`<div style="flex:1;min-width:0"><div id="sim-title" style="font-size:.77rem;font-weight:700;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">← Select a user story</div><div id="sim-slo" style="font-family:'JetBrains Mono',monospace;font-size:.57rem;color:var(--text-3);display:none;margin-top:1px"></div></div>
    <div id="sim-pbwrap" style="width:80px;height:4px;background:var(--bg-elevated);border-radius:3px;overflow:hidden;display:none;flex-shrink:0"><div id="sim-pb" style="height:100%;width:0%;background:var(--accent);transition:width .3s;border-radius:3px"></div></div>
    <div id="sim-cnt" style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:var(--text-3);flex-shrink:0"></div>
    <button id="sim-play" disabled style="background:var(--accent);color:#fff;border:none;padding:4px 12px;border-radius:5px;font-size:.7rem;font-weight:700;cursor:pointer;opacity:.35;flex-shrink:0">▶ Play</button>
    <button id="sim-step" disabled style="background:var(--bg-elevated);color:var(--text-2);border:1px solid var(--border);padding:4px 10px;border-radius:5px;font-size:.7rem;font-weight:600;cursor:pointer;opacity:.35;flex-shrink:0">Step →</button>
    <button id="sim-reset" disabled style="background:var(--bg-elevated);color:var(--text-2);border:1px solid var(--border);padding:4px 8px;border-radius:5px;font-size:.7rem;cursor:pointer;opacity:.35;flex-shrink:0">⟲</button>`;
  centre.appendChild(ctrl);
  // scenario
  const scenBar=el('div','padding:7px 12px;background:var(--bg-elevated);border-bottom:1px solid var(--border);font-size:.71rem;color:var(--text-2);line-height:1.6;flex-shrink:0;display:none');
  scenBar.id='sim-scenario'; centre.appendChild(scenBar);
  // TRACE FEED — cards collapsed by default
  const feed=el('div','flex:1;overflow-y:auto;padding:8px 12px;display:flex;flex-direction:column;gap:5px');
  feed.id='sim-feed';
  feed.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--text-3)"><div style="font-size:2rem;opacity:.2">🔬</div><div style="font-size:.77rem;font-weight:600">Select a story · Press Play or Step →</div><div style="font-size:.68rem;opacity:.7;text-align:center;max-width:280px;line-height:1.55">Click any trace card to expand granular technical details</div></div>`;
  centre.appendChild(feed);
  // legend
  const legend=el('div','display:flex;flex-wrap:wrap;gap:4px;padding:6px 12px;border-top:1px solid var(--border);flex-shrink:0;background:var(--bg-surface)');
  Object.values(L).forEach(layer=>{legend.innerHTML+=`<span style="font-family:'JetBrains Mono',monospace;font-size:.54rem;padding:1px 6px;border-radius:3px;background:${ha(layer.color,.08)};border:1px solid ${ha(layer.color,.25)};color:${layer.color};font-weight:600">${layer.label}</span>`;});
  centre.appendChild(legend);

  // ── KG OVERLAY (transparent, floats over the trace feed) ──
  const kgOverlay=el('div',
    'position:absolute;inset:0;display:flex;flex-direction:column;pointer-events:none;z-index:10;opacity:0;transition:opacity .3s');
  kgOverlay.id='kg-overlay';
  // floating toggle button (always pointer-events:auto)
  const kgToggleBtn=el('button',
    'position:absolute;bottom:46px;right:10px;z-index:12;background:rgba(13,13,12,.82);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.8);padding:5px 10px;border-radius:6px;font-size:.6rem;font-weight:700;cursor:pointer;pointer-events:auto;transition:all .2s',
    '⬡ Graph');
  kgToggleBtn.id='kg-toggle-btn';
  kgToggleBtn.addEventListener('click',toggleKGOverlay);
  centre.appendChild(kgToggleBtn);
  // wrap inside overlay with dark semi-transparent bg
  const kgOvHdr=el('div',
    'display:flex;align-items:center;gap:7px;padding:6px 10px;background:rgba(10,10,9,.88);backdrop-filter:blur(8px);border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0');
  kgOvHdr.innerHTML=`<span style="font-size:.57rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.5)">Knowledge Graph</span>
    <span style="font-size:.53rem;color:rgba(255,255,255,.3)">· drag · zoom · click nodes/edges</span>
    <span id="kg-float-lbl" style="font-size:.53rem;color:rgba(255,255,255,.3);margin-left:auto;font-family:'JetBrains Mono',monospace"></span>
    <button onclick="toggleKGFullscreen()" style="background:rgba(249,115,22,.8);color:#fff;border:none;padding:2px 8px;border-radius:4px;font-size:.57rem;font-weight:700;cursor:pointer">⛶</button>`;
  kgOverlay.appendChild(kgOvHdr);
  const kgOvWrap=el('div','flex:1;position:relative;background:rgba(10,10,9,.82);backdrop-filter:blur(4px)');
  kgOvWrap.id='kg-overlay-wrap';
  // popover inside overlay
  const kgOvPop=el('div','position:absolute;z-index:25;background:#18181a;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:10px 12px;max-width:260px;min-width:190px;display:none;box-shadow:0 4px 20px rgba(0,0,0,.7)');
  kgOvPop.id='kg-popover';
  kgOvWrap.appendChild(kgOvPop);
  kgOverlay.appendChild(kgOvWrap);
  centre.appendChild(kgOverlay);

  /* ── RIGHT PANEL: checklist + Arch Layers + NFRs + Latency ── */
  const right=el('div','display:flex;flex-direction:column;overflow:hidden;background:var(--bg-surface)');

  // Checklist (top, scrollable, fixed height)
  const clHdr=el('div','padding:8px 12px 6px;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;gap:8px',
    `<span style="font-size:.59rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3)">Execution Checklist</span>
     <span id="cl-progress" style="font-family:'JetBrains Mono',monospace;font-size:.57rem;color:var(--text-3);margin-left:auto">—</span>`);
  right.appendChild(clHdr);
  const clScroll=el('div','height:180px;overflow-y:auto;flex-shrink:0;border-bottom:1px solid var(--border)');
  const cl=el('div','padding:5px 8px');
  cl.id='sim-cl';
  cl.innerHTML='<div style="font-size:.68rem;color:var(--text-3);padding:10px 4px;text-align:center">No simulation loaded</div>';
  clScroll.appendChild(cl); right.appendChild(clScroll);

  // ── Architecture Layers Hit ──
  right.appendChild(el('div',
    'padding:5px 11px 4px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);font-size:.57rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-3);flex-shrink:0;background:var(--bg-surface)',
    'Architecture Layers Hit'));
  const hm=el('div','padding:5px 9px;flex-shrink:0;display:flex;flex-direction:column;gap:3px');
  hm.id='sim-hm';
  hm.innerHTML='<div style="font-size:.65rem;color:var(--text-3);padding:4px;text-align:center">—</div>';
  right.appendChild(hm);

  // ── NFRs Exercised ──
  right.appendChild(el('div',
    'padding:5px 11px 4px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);font-size:.57rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-3);flex-shrink:0;background:var(--bg-surface)',
    'NFRs Exercised'));
  const nfrBox=el('div','padding:5px 9px;display:flex;flex-wrap:wrap;gap:3px;flex-shrink:0');
  nfrBox.id='sim-nfrs';
  right.appendChild(nfrBox);

  // ── Latency by Layer ──
  right.appendChild(el('div',
    'padding:5px 11px 4px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);font-size:.57rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-3);flex-shrink:0;background:var(--bg-surface)',
    'Latency by Layer'));
  const latBox=el('div','padding:5px 9px;flex-shrink:0');
  latBox.id='sim-lat';
  right.appendChild(latBox);

  // KG header
  const kgHdr=el('div','padding:8px 12px 6px;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;gap:8px');
  kgHdr.innerHTML=`<span style="font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3)">Knowledge Graph</span>
    <span style="font-size:.55rem;color:var(--text-3)">· drag · zoom</span>
    <span id="kg-legend-label" style="font-size:.55rem;color:var(--text-3);margin-left:auto;font-family:'JetBrains Mono',monospace"></span>
    <button id="kg-fs-btn" title="Open fullscreen" onclick="toggleKGFullscreen()"
      style="background:var(--accent);color:#fff;border:none;padding:3px 9px;border-radius:4px;font-size:.6rem;font-weight:700;cursor:pointer;flex-shrink:0">⛶ Full Screen</button>`;
  right.appendChild(kgHdr);

  // KG SVG container — fills remaining space
  const kgWrap=el('div','flex:1;overflow:hidden;position:relative;background:#0d0d0c');
  kgWrap.id='kg-wrap'; right.appendChild(kgWrap);

  // Node/Edge detail popover
  const kgPopover=el('div',
    'position:absolute;z-index:20;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;max-width:260px;min-width:180px;display:none;box-shadow:0 4px 20px rgba(0,0,0,.4);pointer-events:auto');
  kgPopover.id='kg-popover'; kgWrap.appendChild(kgPopover);

  shell.appendChild(left);
  shell.appendChild(centre);
  shell.appendChild(right);
  panel.appendChild(shell);

  // wire controls
  document.getElementById('sim-play').addEventListener('click',togglePlay);
  document.getElementById('sim-step').addEventListener('click',stepOnce);
  document.getElementById('sim-reset').addEventListener('click',resetSim);
  document.querySelectorAll('.sp-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      SS.speed=+btn.dataset.v;
      document.querySelectorAll('.sp-btn').forEach(b=>{
        const on=+b.dataset.v===SS.speed;
        b.style.background=on?'var(--accent)':'var(--bg-elevated)';
        b.style.color=on?'#fff':'var(--text-2)';
        b.style.borderColor=on?'var(--accent)':'var(--border)';
      });
    });
  });

  // Build the composite KG (deferred until layout is painted)
  requestAnimationFrame(()=>requestAnimationFrame(()=>buildKG()));
}


/* ══════════════════════════════════════════════════════════════════════════
   D3 FORCE-DIRECTED KNOWLEDGE GRAPH
   - D3 v7 from cdnjs · physics: charge, link, collision, centering
   - Draggable nodes (double-click to unpin) · pan + zoom
   - Fullscreen overlay with story filter pills
   - Story highlight: halos, edge/node dim/brighten, edge labels
   - Simulation step: pulse ring + edge glow flash
   - Click node or edge → rich popover (plain + technical)
   - Saga complete: double-circle ring on final node
══════════════════════════════════════════════════════════════════════════ */

// D3 global state
let D3_SIM=null, D3_SVG=null, D3_G=null;
let D3_NODES=[], D3_LINKS=[];
let D3_NODE_SEL=null, D3_LINK_SEL=null;
let KG_ACTIVE_STORY=null, KG_FULLSCREEN=false;
const KG_R=18; // node radius

/* ── loadD3 then build ──────────────────────────────────────────────── */
function buildKG(container){
  if(!container){
    if(KG_FULLSCREEN) container=document.getElementById('d3kg-canvas');
    else if(typeof KG_OVERLAY_OPEN!=='undefined' && KG_OVERLAY_OPEN) container=document.getElementById('kg-overlay-wrap');
    else container=document.getElementById('kg-wrap');
  }
  if(!container) return;
  const W=container.clientWidth, H=container.clientHeight;
  if(W<50||H<50) return;

  if(D3_SIM){ D3_SIM.stop(); D3_SIM=null; }
  container.querySelectorAll('svg.d3kg').forEach(e=>e.remove());

  if(window.d3){ _initD3(container,W,H); }
  else {
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js';
    s.onload=()=>_initD3(container,W,H);
    document.head.appendChild(s);
  }
}

function _initD3(container,W,H){
  const d3=window.d3;

  /* nodes */
  D3_NODES=Object.entries(KG_NODES).map(([id,n])=>({
    id, label:n.label, layer:n.layer,
    color:(L[n.layer]||{color:'#888'}).color,
    stories:Object.entries(STORY_GRAPH).filter(([,sg])=>sg.nodes.has(id)).map(([s])=>s),
    x:n.x*(W/1010), y:n.y*(H/520), fx:null, fy:null,
  }));
  const nodeById=Object.fromEntries(D3_NODES.map(n=>[n.id,n]));

  /* links — one per story step transition */
  D3_LINKS=[];
  Object.entries(STORY_GRAPH).forEach(([sid,sg])=>{
    sg.edges.forEach(edge=>{
      const src=nodeById[edge.from], tgt=nodeById[edge.to];
      if(src&&tgt) D3_LINKS.push({
        source:src, target:tgt, sid,
        color:SIM[sid].color, msg:edge.msg,
        plain:edge.plain, detail:edge.detail,
        latency:edge.latency, nfr:edge.nfr,
        isFinal:edge.isFinal, stepId:edge.stepId,
      });
    });
  });

  /* SVG */
  const svg=d3.select(container).append('svg')
    .attr('class','d3kg').attr('width',W).attr('height',H)
    .style('display','block').style('background','#0a0a09');
  D3_SVG=svg;

  /* defs */
  const defs=svg.append('defs');

  // glow filter
  const gf=defs.append('filter').attr('id','d3glow')
    .attr('x','-50%').attr('y','-50%').attr('width','200%').attr('height','200%');
  gf.append('feGaussianBlur').attr('stdDeviation',4).attr('result','blur');
  const fm=gf.append('feMerge');
  fm.append('feMergeNode').attr('in','blur');
  fm.append('feMergeNode').attr('in','SourceGraphic');

  // No SVG marker-end used — arrowheads are inline <polygon> elements
  // positioned by _tick() so they always track node positions correctly.

  /* subtle dot grid */
  const grd=svg.append('g').attr('pointer-events','none');
  for(let x=20;x<W;x+=48) for(let y=20;y<H;y+=48)
    grd.append('circle').attr('cx',x).attr('cy',y).attr('r',0.8)
      .attr('fill','rgba(255,255,255,0.04)');

  /* zoom+pan layer */
  const zoomBeh=d3.zoom().scaleExtent([0.15,5])
    .on('zoom',ev=>D3_G.attr('transform',ev.transform));
  svg.call(zoomBeh).on('dblclick.zoom',null);
  svg.on('click',()=>{ const p=_activePop(); if(p) p.style.display='none'; });

  const g=svg.append('g');
  D3_G=g;

  /* ── cluster halos (behind everything) ── */
  const haloG=g.append('g').attr('class','d3-halos');
  Object.entries(SIM).forEach(([sid,s])=>{
    haloG.append('ellipse').attr('class','d3-halo').attr('data-story',sid)
      .attr('fill',ha(s.color,.06)).attr('stroke',ha(s.color,.28))
      .attr('stroke-width',1.5).attr('stroke-dasharray','6,4')
      .attr('rx',0).attr('ry',0).attr('opacity',0);
    haloG.append('text').attr('class','d3-halo-lbl').attr('data-story',sid)
      .attr('text-anchor','middle').attr('font-size',8.5)
      .attr('font-family','JetBrains Mono,monospace').attr('font-weight','700')
      .attr('fill',s.color).attr('opacity',0).text(sid);
  });

  /* ── edges ── */
  const linkG=g.append('g').attr('class','d3-links');
  D3_LINK_SEL=linkG.selectAll('g.d3-link').data(D3_LINKS).join('g')
    .attr('class','d3-link').style('cursor','pointer');

  // visible path — NO marker-end; arrowhead is a separate polygon
  D3_LINK_SEL.append('path').attr('class','d3lp')
    .attr('fill','none').attr('stroke','rgba(255,255,255,0.07)')
    .attr('stroke-width',1.2);
  // tiny arrowhead polygon — positioned by _tick()
  // points="0,-3.5 7,0 0,3.5" = small 7×7 triangle, tip at x=7
  D3_LINK_SEL.append('polygon').attr('class','d3la')
    .attr('points','0,-3 6,0 0,3')
    .attr('fill','rgba(255,255,255,0.18)').attr('opacity',1);
  // fat invisible hit zone
  D3_LINK_SEL.append('path').attr('class','d3lh')
    .attr('fill','none').attr('stroke','transparent').attr('stroke-width',16);
  // edge label
  D3_LINK_SEL.append('text').attr('class','d3ll')
    .attr('text-anchor','middle').attr('font-size',6).attr('dominant-baseline','middle')
    .attr('font-family','JetBrains Mono,monospace').attr('pointer-events','none')
    .attr('opacity',0)
    .text(d=>(d.msg||'').length>24?(d.msg||'').slice(0,23)+'…':d.msg||'');
  // label pill bg — drawn as rect behind text (positioned in tick)
  D3_LINK_SEL.insert('rect','.d3ll').attr('class','d3llbg')
    .attr('rx',3).attr('ry',3).attr('fill','#0f0f0e').attr('opacity',0);

  D3_LINK_SEL.on('click',(ev,d)=>{ ev.stopPropagation(); _showEdgePop(d,ev,container); });

  /* ── nodes ── */
  const nodeG=g.append('g').attr('class','d3-nodes');
  D3_NODE_SEL=nodeG.selectAll('g.d3-node').data(D3_NODES).join('g')
    .attr('class','d3-node').attr('data-id',d=>d.id).style('cursor','grab');

  // double ring (final node marker, hidden initially)
  D3_NODE_SEL.append('circle').attr('class','d3final')
    .attr('r',KG_R+8).attr('fill','none').attr('stroke','transparent')
    .attr('stroke-width',2.5).attr('stroke-dasharray','none');

  // outer glow ring
  D3_NODE_SEL.append('circle').attr('class','d3outer')
    .attr('r',KG_R+3).attr('fill','none')
    .attr('stroke',d=>ha(d.color,.22)).attr('stroke-width',1);

  // main filled circle
  D3_NODE_SEL.append('circle').attr('class','d3inner')
    .attr('r',KG_R).attr('fill',d=>ha(d.color,.18))
    .attr('stroke',d=>ha(d.color,.55)).attr('stroke-width',1.5);

  // layer emoji
  const EM={CHANNEL:'🌐',IDENTITY:'🔑',GATEWAY:'🛡️',FACADE:'📋',
            INTEROP:'🎯',REGISTRY:'🏢',SECURITY:'🔒',DATA:'⚡',MESSAGING:'📨',OBS:'📊'};
  D3_NODE_SEL.append('text').attr('class','d3em')
    .attr('text-anchor','middle').attr('dominant-baseline','central')
    .attr('font-size',11).attr('pointer-events','none').text(d=>EM[d.layer]||'○');

  // name label
  D3_NODE_SEL.append('text').attr('class','d3lbl')
    .attr('text-anchor','middle').attr('y',KG_R+11).attr('font-size',7)
    .attr('font-family','JetBrains Mono,monospace')
    .attr('fill','rgba(255,255,255,0.45)').attr('pointer-events','none')
    .text(d=>d.label.length>13?d.label.slice(0,12)+'…':d.label);

  // hover effect
  D3_NODE_SEL
    .on('mouseenter',function(){ d3.select(this).select('.d3inner').attr('stroke-width',3); })
    .on('mouseleave',function(){ d3.select(this).select('.d3inner').attr('stroke-width',1.5); });

  // click → popover
  D3_NODE_SEL.on('click',(ev,d)=>{ ev.stopPropagation(); _showNodePop(d,ev,container); });

  // drag behaviour
  const drag=d3.drag()
    .on('start',(ev,d)=>{ if(!ev.active) D3_SIM.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; d3.select(ev.sourceEvent.target.closest('.d3-node')).style('cursor','grabbing'); })
    .on('drag',(ev,d)=>{ d.fx=ev.x; d.fy=ev.y; })
    .on('end',(ev,d)=>{ if(!ev.active) D3_SIM.alphaTarget(0); d.fx=d.x; d.fy=d.y; d3.select(ev.sourceEvent.target.closest('.d3-node')).style('cursor','grab'); });
  D3_NODE_SEL.call(drag);
  // double-click to unpin
  D3_NODE_SEL.on('dblclick.unpin',(ev,d)=>{ ev.stopPropagation(); d.fx=null; d.fy=null; D3_SIM.alphaTarget(0.2).restart(); });

  /* pulse ring (sim step animation) */
  g.append('circle').attr('id','d3pulse').attr('r',0)
    .attr('fill','none').attr('stroke','#fff').attr('stroke-width',2.5).attr('opacity',0);

  /* ── force simulation ── */
  D3_SIM=d3.forceSimulation(D3_NODES)
    .force('link', d3.forceLink(D3_LINKS).id(d=>d.id).distance(95).strength(0.35))
    .force('charge', d3.forceManyBody().strength(-320).distanceMax(380))
    .force('collide', d3.forceCollide(KG_R+16).strength(0.8))
    .force('center', d3.forceCenter(W/2,H/2).strength(0.04))
    .force('fx', d3.forceX(W/2).strength(0.025))
    .force('fy', d3.forceY(H/2).strength(0.025))
    .alphaDecay(0.022).velocityDecay(0.38)
    .on('tick', _tick);

  // restore highlight state
  if(KG_ACTIVE_STORY) setTimeout(()=>kgHighlightStory(KG_ACTIVE_STORY),60);
}

/* ── TICK ─────────────────────────────────────────────────────────────── */
function _tick(){
  const d3=window.d3; if(!d3||!D3_LINK_SEL||!D3_NODE_SEL) return;

  // edge paths — pull back endpoints to node edge, curve parallel pairs
  // Pre-compute per-pair offsets ONCE on D3_LINKS array (stable order)
  if(!D3_LINKS._pairDone){
    const pairCount={}, pairIdx2={};
    D3_LINKS.forEach(d=>{
      const k=[d.source.id,d.target.id].sort().join('|');
      pairCount[k]=(pairCount[k]||0)+1;
    });
    D3_LINKS.forEach(d=>{
      const k=[d.source.id,d.target.id].sort().join('|');
      pairIdx2[k]=pairIdx2[k]||0;
      d._pairIdx=pairIdx2[k]++;
      d._pairTotal=pairCount[k]||1;
    });
    D3_LINKS._pairDone=true;
  }

  D3_LINK_SEL.each(function(d){
    const sx=d.source.x, sy=d.source.y, tcx=d.target.x, tcy=d.target.y;
    const dx=tcx-sx, dy=tcy-sy, len=Math.sqrt(dx*dx+dy*dy)||1;

    // shorten endpoints so arrow tip lands at node circle edge (not center)
    const PULL = KG_R + 3;
    const ex = tcx - (dx/len)*PULL;  // endpoint x (near target node edge)
    const ey = tcy - (dy/len)*PULL;  // endpoint y
    const bx = sx  + (dx/len)*PULL;  // begin x (near source node edge)
    const by = sy  + (dy/len)*PULL;  // begin y

    // lateral offset for parallel edges
    const offset=(d._pairIdx - (d._pairTotal-1)/2) * 22;
    const mx=(bx+ex)/2 - (dy/len)*offset;
    const my=(by+ey)/2 + (dx/len)*offset;
    d._mx=mx; d._my=my; d._ex=ex; d._ey=ey;
    d._bx=bx; d._by=by;
    // tangent angle at endpoint of quadratic bezier: direction from CP to endpoint
    const tang=Math.atan2(ey-my, ex-mx);
    d._tang=tang;
    const pathD=`M${bx},${by} Q${mx},${my} ${ex},${ey}`;
    d3.select(this).select('.d3lp').attr('d',pathD);
    d3.select(this).select('.d3lh').attr('d',pathD);
    // position arrowhead polygon at endpoint, rotated to tangent
    d3.select(this).select('.d3la')
      .attr('transform',`translate(${ex},${ey}) rotate(${tang*180/Math.PI})`);
  });

  // edge labels
  D3_LINK_SEL.select('.d3ll').attr('x',d=>d._mx||0).attr('y',d=>(d._my||0)-7);
  D3_LINK_SEL.select('.d3llbg')
    .attr('x',d=>(d._mx||0)-38).attr('y',d=>(d._my||0)-15)
    .attr('width',76).attr('height',10);

  // nodes
  D3_NODE_SEL.attr('transform',d=>`translate(${d.x},${d.y})`);

  // halos — bounding ellipse per story
  if(D3_G){
    D3_G.selectAll('.d3-halo').each(function(){
      const sid=d3.select(this).attr('data-story');
      const sg=STORY_GRAPH[sid]; if(!sg) return;
      const pts=[...sg.nodes].map(k=>D3_NODES.find(n=>n.id===k)).filter(Boolean);
      if(!pts.length) return;
      const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
      const cx=(Math.min(...xs)+Math.max(...xs))/2;
      const cy=(Math.min(...ys)+Math.max(...ys))/2;
      const rx=Math.max(48,(Math.max(...xs)-Math.min(...xs))/2+KG_R+22);
      const ry=Math.max(36,(Math.max(...ys)-Math.min(...ys))/2+KG_R+18);
      d3.select(this).attr('cx',cx).attr('cy',cy).attr('rx',rx).attr('ry',ry);
      D3_G.select(`.d3-halo-lbl[data-story="${sid}"]`)
        .attr('x',cx).attr('y',cy-ry-7);
    });
  }
}

/* ── FULLSCREEN ──────────────────────────────────────────────────────── */
function toggleKGFullscreen(){
  KG_FULLSCREEN=!KG_FULLSCREEN;
  const btn=document.getElementById('kg-fs-btn');

  if(KG_FULLSCREEN){
    // create overlay once
    let ov=document.getElementById('d3kg-overlay');
    if(!ov){
      ov=document.createElement('div');
      ov.id='d3kg-overlay';
      ov.style.cssText='position:fixed;inset:0;z-index:1000;background:#0a0a09;display:flex;flex-direction:column;font-family:inherit';

      // ── top bar ──
      const bar=document.createElement('div');
      bar.style.cssText='display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0;background:#111110';
      bar.innerHTML=`
        <span style="font-size:.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#f97316">⬡</span>
        <span style="font-size:.65rem;font-weight:700;color:rgba(255,255,255,.7)">Composite Knowledge Graph</span>
        <span style="font-size:.58rem;color:rgba(255,255,255,.3)">· drag nodes · scroll to zoom · double-click to unpin · click for details</span>
        <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
          <span style="font-size:.56rem;color:rgba(255,255,255,.3);font-family:'JetBrains Mono',monospace">Filter:</span>
          <div id="d3kg-pills" style="display:flex;gap:4px;flex-wrap:wrap;max-width:480px"></div>
          <button id="d3kg-clear" style="font-size:.58rem;padding:3px 8px;border-radius:4px;border:1px solid rgba(255,255,255,.15);background:transparent;color:rgba(255,255,255,.5);cursor:pointer;margin-left:4px">Clear</button>
          <button id="d3kg-close" style="font-size:.65rem;padding:4px 14px;border-radius:5px;border:none;background:rgba(249,115,22,.9);color:#fff;cursor:pointer;font-weight:700;margin-left:6px">✕ Close</button>
        </div>`;
      ov.appendChild(bar);

      // ── canvas ──
      const canv=document.createElement('div');
      canv.id='d3kg-canvas';
      canv.style.cssText='flex:1;position:relative;overflow:hidden';

      // popover inside canvas
      const pop=document.createElement('div');
      pop.id='d3kg-pop';
      pop.style.cssText='position:absolute;z-index:30;background:#18181a;border:1px solid rgba(255,255,255,.14);border-radius:9px;padding:12px 14px;max-width:300px;min-width:210px;display:none;box-shadow:0 6px 30px rgba(0,0,0,.8);pointer-events:auto';
      canv.appendChild(pop);
      ov.appendChild(canv);
      document.body.appendChild(ov);

      // build story filter pills
      const pillsDiv=document.getElementById('d3kg-pills');
      Object.entries(SIM).forEach(([sid,s])=>{
        const p=document.createElement('button');
        p.style.cssText=`font-family:'JetBrains Mono',monospace;font-size:.54rem;padding:2px 8px;border-radius:12px;border:1px solid ${ha(s.color,.35)};background:${ha(s.color,.07)};color:${s.color};cursor:pointer;transition:all .15s;white-space:nowrap`;
        p.textContent=sid; p.dataset.sid=sid;
        p.addEventListener('click',()=>{
          const already=KG_ACTIVE_STORY===sid;
          KG_ACTIVE_STORY=already?null:sid;
          kgHighlightStory(KG_ACTIVE_STORY);
          pillsDiv.querySelectorAll('button').forEach(b=>{
            const on=b.dataset.sid===KG_ACTIVE_STORY;
            b.style.background=on?ha(SIM[b.dataset.sid].color,.28):ha(SIM[b.dataset.sid].color,.07);
            b.style.fontWeight=on?'700':'400';
          });
        });
        pillsDiv.appendChild(p);
      });

      document.getElementById('d3kg-clear').onclick=()=>{
        KG_ACTIVE_STORY=null; kgHighlightStory(null);
        document.getElementById('d3kg-pills').querySelectorAll('button').forEach(b=>{
          b.style.background=ha(SIM[b.dataset.sid].color,.07); b.style.fontWeight='400';
        });
      };
      document.getElementById('d3kg-close').onclick=()=>toggleKGFullscreen();
    } else {
      ov.style.display='flex';
    }

    if(btn){ btn.textContent='⤡ Exit'; btn.style.background='rgba(249,115,22,.5)'; }

    // build KG in fullscreen canvas
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const c=document.getElementById('d3kg-canvas'); if(!c) return;
      buildKG(c);
    }));

  } else {
    const ov=document.getElementById('d3kg-overlay');
    if(ov) ov.style.display='none';
    if(btn){ btn.textContent='⛶ Full Screen'; btn.style.background='var(--accent)'; }
    // rebuild in panel
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      buildKG(document.getElementById('kg-wrap'));
      if(KG_ACTIVE_STORY) setTimeout(()=>kgHighlightStory(KG_ACTIVE_STORY),80);
    }));
  }
}

/* ── helper: which popover is active ────────────────────────────────── */
let KG_OVERLAY_OPEN=false;
function toggleKGOverlay(){
  KG_OVERLAY_OPEN=!KG_OVERLAY_OPEN;
  const ov=document.getElementById('kg-overlay'); if(!ov) return;
  ov.style.opacity=KG_OVERLAY_OPEN?'1':'0';
  ov.style.pointerEvents=KG_OVERLAY_OPEN?'auto':'none';
  const btn=document.getElementById('kg-toggle-btn');
  if(btn){
    btn.textContent=KG_OVERLAY_OPEN?'⬡ Hide Graph':'⬡ Graph';
    btn.style.background=KG_OVERLAY_OPEN?'rgba(249,115,22,.85)':'rgba(13,13,12,.82)';
  }
  if(KG_OVERLAY_OPEN){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      buildKG(document.getElementById('kg-overlay-wrap'));
      if(KG_ACTIVE_STORY) kgHighlightStory(KG_ACTIVE_STORY);
    }));
  }
}

function _activePop(){
  if(KG_FULLSCREEN) return document.getElementById('d3kg-pop');
  if(KG_OVERLAY_OPEN) return document.getElementById('kg-popover');
  return document.getElementById('kg-popover');
}

/* ── POPOVERS ─────────────────────────────────────────────────────────── */
function _showNodePop(d, ev, container){
  const pop=_activePop(); if(!pop) return;
  const lc=L[d.layer]||{color:'#888'};
  const badges=d.stories.map(sid=>
    `<span style="font-family:'JetBrains Mono',monospace;font-size:.54rem;padding:1px 6px;border-radius:3px;background:${ha(SIM[sid].color,.15)};color:${SIM[sid].color};border:1px solid ${ha(SIM[sid].color,.3)}">${sid}</span>`
  ).join(' ');
  pop.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">
      <div style="width:12px;height:12px;border-radius:50%;background:${lc.color};border:2px solid ${ha(lc.color,.5)};flex-shrink:0"></div>
      <div style="font-size:.78rem;font-weight:700;color:#f0f0ee">${d.label}</div>
      <button onclick="_activePop().style.display='none'" style="margin-left:auto;background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:.85rem;line-height:1;padding:0">✕</button>
    </div>
    <div style="font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:${lc.color};margin-bottom:7px;display:flex;align-items:center;gap:5px">
      <span>${lc.label}</span><span style="color:rgba(255,255,255,.2)">Layer</span>
    </div>
    <div style="font-size:.7rem;color:rgba(255,255,255,.65);line-height:1.6;margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid rgba(255,255,255,.08)">
      Participates in <strong style="color:#f0f0ee">${d.stories.length}</strong> story flow(s).
      <br><span style="font-size:.61rem;color:rgba(255,255,255,.3)">Drag to reposition · double-click to unpin</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">${badges}</div>`;
  _placePop(pop,ev,container);
}

function _showEdgePop(d, ev, container){
  const pop=_activePop(); if(!pop) return;
  pop.innerHTML=`
    <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:9px">
      <div style="width:20px;height:3px;border-radius:2px;background:${d.color};margin-top:7px;flex-shrink:0"></div>
      <div style="font-size:.73rem;font-weight:700;color:#f0f0ee;flex:1;line-height:1.4">${d.msg||''}</div>
      <button onclick="_activePop().style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:.85rem;padding:0;flex-shrink:0">✕</button>
    </div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:.57rem;color:${d.color};margin-bottom:8px;font-weight:600">${d.sid}</div>
    <div style="margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid rgba(255,255,255,.08)">
      <div style="font-size:.55rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.3);margin-bottom:3px">Plain English</div>
      <div style="font-size:.7rem;color:rgba(255,255,255,.75);line-height:1.58">${d.plain||''}</div>
    </div>
    <div style="margin-bottom:9px">
      <div style="font-size:.55rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.3);margin-bottom:3px">Technical Detail</div>
      <div style="font-size:.63rem;font-family:'JetBrains Mono',monospace;color:rgba(255,255,255,.45);line-height:1.55">${(d.detail||'').slice(0,260)}${(d.detail||'').length>260?'…':''}</div>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap">
      <span style="font-family:'JetBrains Mono',monospace;font-size:.56rem;padding:2px 7px;border-radius:3px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);color:#22c55e">⏱ ${d.latency||''}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:.56rem;padding:2px 7px;border-radius:3px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.3);color:#8b5cf6">${d.nfr||''}</span>
      ${d.isFinal?`<span style="font-family:'JetBrains Mono',monospace;font-size:.56rem;padding:2px 7px;border-radius:3px;background:rgba(249,115,22,.12);border:1px solid rgba(249,115,22,.4);color:#f97316">⊙ TERMINAL NODE</span>`:''}
    </div>`;
  _placePop(pop,ev,container);
}

function _placePop(pop,ev,container){
  pop.style.display='block';
  const rect=container.getBoundingClientRect();
  let l=ev.clientX-rect.left+16, t=ev.clientY-rect.top+16;
  if(l+310>rect.width)  l=ev.clientX-rect.left-318;
  if(t+290>rect.height) t=ev.clientY-rect.top-298;
  pop.style.left=Math.max(4,l)+'px';
  pop.style.top =Math.max(4,t)+'px';
}

/* ── HIGHLIGHT STORY ─────────────────────────────────────────────────── */
function kgHighlightStory(sid){
  KG_ACTIVE_STORY=sid;
  const d3=window.d3; if(!d3||!D3_NODE_SEL||!D3_LINK_SEL) return;
  const sg=sid?STORY_GRAPH[sid]:null;
  const sColor=sid?SIM[sid].color:null;
  const allColors=[...new Set(Object.values(SIM).map(s=>s.color))];
  const ci=sid?allColors.indexOf(sColor):0;

  // edges
  const allColorsHL=[...new Set(Object.values(SIM).map(s=>s.color))];
  D3_LINK_SEL.each(function(d){
    const b=d.sid===sid;
    const p=d3.select(this).select('.d3lp');
    const l=d3.select(this).select('.d3ll');
    const lb=d3.select(this).select('.d3llbg');
    if(!sid){
      p.attr('stroke','rgba(255,255,255,0.07)').attr('stroke-width',1.2)
        .attr('opacity',1).attr('filter',null);
      d3.select(this).select('.d3la').attr('fill','rgba(255,255,255,0.18)').attr('opacity',1);
      l.attr('opacity',0); lb.attr('opacity',0);
    } else if(b){
      p.attr('stroke',d.color).attr('stroke-width',2)
        .attr('opacity',0.9).attr('filter',null);
      d3.select(this).select('.d3la').attr('fill',d.color).attr('opacity',0.95);
      l.attr('fill',d.color).attr('opacity',1); lb.attr('opacity',0.85);
    } else {
      p.attr('stroke','rgba(255,255,255,0.03)').attr('stroke-width',1)
        .attr('opacity',0.15).attr('filter',null);
      d3.select(this).select('.d3la').attr('fill','rgba(255,255,255,0.05)').attr('opacity',0.3);
      l.attr('opacity',0); lb.attr('opacity',0);
    }
  });

  // nodes
  D3_NODE_SEL.each(function(d){
    const b=sg&&sg.nodes.has(d.id);
    const lc=L[d.layer]||{color:'#888'};
    const inner=d3.select(this).select('.d3inner');
    const outer=d3.select(this).select('.d3outer');
    const lbl=d3.select(this).select('.d3lbl');
    if(!sid){
      inner.attr('fill',ha(lc.color,.18)).attr('stroke',ha(lc.color,.55)).attr('stroke-width',1.5);
      outer.attr('stroke',ha(lc.color,.22));
      lbl.attr('fill','rgba(255,255,255,0.45)').attr('font-weight',null);
    } else if(b){
      inner.attr('fill',ha(sColor,.38)).attr('stroke',sColor).attr('stroke-width',2.5);
      outer.attr('stroke',ha(sColor,.7));
      lbl.attr('fill','#f5f5f3').attr('font-weight','700');
    } else {
      inner.attr('fill','rgba(255,255,255,0.02)').attr('stroke','rgba(255,255,255,0.08)').attr('stroke-width',1);
      outer.attr('stroke','rgba(255,255,255,0.05)');
      lbl.attr('fill','rgba(255,255,255,0.18)').attr('font-weight',null);
    }
  });

  // halos
  if(D3_G){
    D3_G.selectAll('.d3-halo').each(function(){
      d3.select(this).attr('opacity',d3.select(this).attr('data-story')===sid?1:0);
    });
    D3_G.selectAll('.d3-halo-lbl').each(function(){
      d3.select(this).attr('opacity',d3.select(this).attr('data-story')===sid?1:0);
    });
  }

  // legend label in panel header
  const ll=document.getElementById('kg-legend-label');
  if(ll) ll.textContent=sid?`${sid}`:' ';
}

/* ── ANIMATE STEP (simulation → pulse ring + edge flash) ─────────────── */
function kgAnimateStep(step, storyColor){
  const d3=window.d3; if(!d3||!D3_G||!D3_NODE_SEL||!D3_LINK_SEL) return;
  const key=stepToNodeKey(step.layer,step.comp); if(!key) return;
  const nd=D3_NODES.find(n=>n.id===key); if(!nd) return;
  const allColorsAnim=[...new Set(Object.values(SIM).map(s=>s.color))];

  // ── 1. Pulse ring on active node ──
  const ring=D3_G.select('#d3pulse');
  if(!ring.empty()){
    ring.interrupt();
    ring.attr('cx',nd.x).attr('cy',nd.y).attr('r',KG_R+2)
      .attr('stroke',storyColor).attr('stroke-width',2.5).attr('opacity',1);
    ring.transition().duration(800).ease(d3.easeCubicOut)
      .attr('r',KG_R+18).attr('opacity',0);
  }

  // ── 2. Flash node fill ──
  D3_NODE_SEL.filter(d=>d.id===key).select('.d3inner')
    .interrupt()
    .attr('fill',ha(storyColor,.78)).attr('stroke',storyColor).attr('stroke-width',3)
    .transition().duration(650).ease(d3.easeCubicOut)
    .attr('fill',ha(storyColor,.38)).attr('stroke',storyColor).attr('stroke-width',2.5);

  // ── 3. Flash the active edge PATH and its arrowhead polygon ──
  //    We flash the existing .d3lp path directly via a CSS-class trick.
  //    _tick runs every frame but only updates geometry attrs, not stroke/opacity,
  //    so we can safely do a short transition on stroke without it being clobbered.
  D3_LINK_SEL.filter(d=>d.sid===SS.storyId && d.stepId===step.id)
    .each(function(){
      const sel=d3.select(this);
      const p=sel.select('.d3lp');
      const a=sel.select('.d3la');
      // interrupt any running transition on these elements
      p.interrupt(); a.interrupt();
      // flash bright
      p.attr('stroke','#ffffff').attr('stroke-width',3).attr('opacity',1)
        .attr('filter','url(#d3glow)');
      a.attr('fill','#ffffff').attr('opacity',1);
      // fade back to story-colour state
      p.transition().duration(700).ease(d3.easeCubicOut)
        .attr('stroke',storyColor).attr('stroke-width',2).attr('opacity',0.9)
        .attr('filter',null);
      a.transition().duration(700).ease(d3.easeCubicOut)
        .attr('fill',storyColor).attr('opacity',0.95);
    });
}

/* ── MARK FINAL NODE (double-circle) ─────────────────────────────────── */
function kgMarkFinal(storyId){
  const d3=window.d3; if(!d3||!D3_LINK_SEL) return;
  const sg=STORY_GRAPH[storyId]; if(!sg||!sg.edges.length) return;
  const lastKey=sg.edges[sg.edges.length-1].to;
  const col=SIM[storyId].color;
  D3_NODE_SEL.filter(d=>d.id===lastKey)
    .select('.d3final').attr('stroke',col).attr('stroke-width',2.5);
  D3_NODE_SEL.filter(d=>d.id===lastKey)
    .select('.d3inner').attr('fill',ha(col,.52)).attr('stroke',col).attr('stroke-width',3);
}

/* ── CLEAR DYNAMIC (on reset) ──────────────────────────────────────────*/
function kgClearDynamic(){
  const d3=window.d3; if(!d3||!D3_NODE_SEL) return;
  D3_NODE_SEL.select('.d3final').attr('stroke','transparent');
  if(KG_ACTIVE_STORY) kgHighlightStory(KG_ACTIVE_STORY);
}


/* ══════════════════════════════════════════════════════════════════════════
   LOAD STORY
══════════════════════════════════════════════════════════════════════════ */
function loadStory(id){
  const s=SIM[id]; if(!s) return;
  clearInterval(SS.timer); SS.running=false; SS.storyId=id; SS.stepIdx=-1;
  kgClearDynamic();

  // Highlight selector
  document.querySelectorAll('[id^=sim-item-]').forEach(e2=>{e2.style.background='';e2.style.borderColor='transparent';});
  const item=document.getElementById(`sim-item-${id}`);
  if(item){item.style.background=ha(s.color,.1);item.style.borderColor=s.color;}

  // Ctrl bar
  document.getElementById('sim-title').textContent=`${id}: ${s.title}`;
  document.getElementById('sim-title').style.color=s.color;
  const sloEl=document.getElementById('sim-slo'); sloEl.textContent=`SLO: ${s.slo}`; sloEl.style.display='block';
  document.getElementById('sim-pbwrap').style.display='block';
  document.getElementById('sim-pb').style.width='0%';
  document.getElementById('sim-cnt').textContent=`0 / ${s.steps.length}`;

  // Scenario
  const sc=document.getElementById('sim-scenario');
  sc.innerHTML=`<strong style="color:var(--text-1)">Scenario:</strong> ${s.scenario}`;
  sc.style.display='block';

  // Enable controls
  ['sim-play','sim-step','sim-reset'].forEach(bid=>{
    const b=document.getElementById(bid); b.disabled=false; b.style.opacity='1';
  });
  document.getElementById('sim-play').textContent='▶ Play';
  document.getElementById('sim-play').style.background='var(--accent)';

  // Reset feed
  document.getElementById('sim-feed').innerHTML=`<div style="font-size:.7rem;color:var(--text-3);text-align:center;padding:10px 0">Ready — <strong>Play</strong> or <strong>Step →</strong> · click any card header to expand detail</div>`;

  // Build checklist
  const cl=document.getElementById('sim-cl'); cl.innerHTML='';
  s.steps.forEach((step)=>{
    const lc=L[step.layer]||{color:'#888'};
    const row=el('div',`display:flex;align-items:flex-start;gap:5px;padding:3px 5px;border-radius:4px;margin-bottom:2px;opacity:.3;transition:all .2s`);
    row.id=`cl-${step.id}`;
    row.innerHTML=`<div class="cl-chk" style="width:13px;height:13px;border-radius:3px;border:1.5px solid var(--border);flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;transition:all .18s"></div>
      <div style="min-width:0"><div style="font-family:'JetBrains Mono',monospace;font-size:.54rem;font-weight:700;color:${lc.color}">${step.layer}</div>
      <div style="font-size:.63rem;font-weight:600;color:var(--text-1);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${step.comp}</div></div>`;
    cl.appendChild(row);
  });
  document.getElementById('cl-progress').textContent=`0/${s.steps.length}`;

  // ── Architecture Layers Hit ──
  const hmEl=document.getElementById('sim-hm');
  if(hmEl){
    const byLayer={};
    s.steps.forEach(st=>{
      if(!byLayer[st.layer]) byLayer[st.layer]={comps:new Set(),lc:L[st.layer]||{color:'#888',label:st.layer}};
      byLayer[st.layer].comps.add(st.comp);
    });
    hmEl.innerHTML='';
    Object.entries(byLayer).forEach(([layer,{comps,lc}])=>{
      const rowDiv=el('div','margin-bottom:5px;padding:3px 5px;border-radius:4px;background:'+ha(lc.color,.05));
      rowDiv.innerHTML=`<div style="font-family:'JetBrains Mono',monospace;font-size:.52rem;font-weight:700;color:${lc.color};margin-bottom:2px;text-transform:uppercase;letter-spacing:.06em">${lc.label}</div>`
        +[...comps].map(comp=>`<div style="font-size:.61rem;color:var(--text-2);padding-left:8px;line-height:1.5">• ${comp}</div>`).join('');
      hmEl.appendChild(rowDiv);
    });
  }

  // ── NFRs Exercised ──
  const nfrEl=document.getElementById('sim-nfrs');
  if(nfrEl){
    const nfrSet=new Set();
    s.steps.forEach(st=>{ if(st.nfr) st.nfr.split(/[\s,·]+/).filter(n=>n.startsWith('NFR-')).forEach(n=>nfrSet.add(n)); });
    const nfrPalette=['#f97316','#8b5cf6','#22c55e','#06b6d4','#ec4899','#ef4444','#f59e0b','#3b82f6'];
    nfrEl.innerHTML='';
    [...nfrSet].forEach((nfr,i)=>{
      const col=nfrPalette[i%nfrPalette.length];
      nfrEl.innerHTML+=`<span style="font-family:'JetBrains Mono',monospace;font-size:.54rem;padding:1px 6px;border-radius:3px;background:${ha(col,.12)};border:1px solid ${ha(col,.3)};color:${col};font-weight:600">${nfr}</span>`;
    });
    if(nfrSet.size===0) nfrEl.innerHTML='<div style="font-size:.62rem;color:var(--text-3);padding:2px 4px">—</div>';
  }

  // ── Latency by Layer (bar chart) ──
  const latEl=document.getElementById('sim-lat');
  if(latEl){
    const latByLayer={};
    s.steps.forEach(st=>{
      const lc=L[st.layer]||{color:'#888',label:st.layer};
      if(!latByLayer[st.layer]) latByLayer[st.layer]={color:lc.color,label:lc.label,total:0};
      latByLayer[st.layer].total+=parseInt((st.latency||'0').replace(/[^\d]/g,''))||0;
    });
    const maxMs=Math.max(1,...Object.values(latByLayer).map(v=>v.total));
    latEl.innerHTML='';
    Object.entries(latByLayer).forEach(([layer,v])=>{
      const barRow=el('div','display:flex;align-items:center;gap:5px;margin-bottom:3px');
      barRow.dataset.layer=layer;
      barRow.innerHTML=`<div style="font-family:'JetBrains Mono',monospace;font-size:.51rem;color:${v.color};width:60px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.label}</div>
        <div style="flex:1;background:rgba(255,255,255,.06);border-radius:3px;height:6px;overflow:hidden"><div class="lat-bar" style="height:100%;border-radius:3px;background:${v.color};width:${Math.round((v.total/maxMs)*100)}%;transition:width .4s"></div></div>
        <div class="lat-ms" style="font-family:'JetBrains Mono',monospace;font-size:.5rem;color:var(--text-3);width:36px;text-align:right;flex-shrink:0">${v.total}ms</div>`;
      latEl.appendChild(barRow);
    });
  }

  // KG: highlight this story
  kgHighlightStory(id);
  const fl=document.getElementById('kg-legend-label'); if(fl) fl.textContent=id;
  const fl2=document.getElementById('kg-float-lbl'); if(fl2) fl2.textContent=id;
}

/* ══════════════════════════════════════════════════════════════════════════
   STEP EXECUTION
══════════════════════════════════════════════════════════════════════════ */
function stepOnce(){
  const s=SIM[SS.storyId]; if(!s) return;
  if(SS.stepIdx>=s.steps.length-1){finishSim();return;}
  SS.stepIdx++;
  renderStep(SS.stepIdx);
}

function renderStep(idx){
  const s=SIM[SS.storyId]; if(!s) return;
  const step=s.steps[idx];
  const lc=L[step.layer]||{color:'#888',label:step.layer};
  const total=s.steps.length;

  // Progress
  document.getElementById('sim-pb').style.width=`${((idx+1)/total)*100}%`;
  document.getElementById('sim-cnt').textContent=`${idx+1} / ${total}`;
  document.getElementById('cl-progress').textContent=`${idx+1}/${total}`;

  // Clear placeholder on first step
  const feed=document.getElementById('sim-feed');
  if(idx===0) feed.innerHTML='';

  const scMap={ok:'#22c55e',warn:'#f59e0b',error:'#ef4444',async:'#8b5cf6'};
  const scLabel={ok:'✓ OK',warn:'⚠ WARN',error:'✗ ERR',async:'⟳ ASYNC'};
  const sc=step.status||'ok', scColor=scMap[sc];

  // ── COLLAPSED CARD (default) ──
  const card=el('div',
    `border:1px solid ${ha(lc.color,.25)};border-radius:8px;overflow:hidden;background:${ha(lc.color,.03)};animation:simIn .18s ease;flex-shrink:0`);

  // header (always visible, click to expand)
  const hdr=el('div',
    `display:flex;align-items:center;gap:7px;padding:6px 10px;cursor:pointer;user-select:none;background:${ha(lc.color,.08)}`);
  hdr.innerHTML=`
    <span style="font-size:.75rem;flex-shrink:0">${step.emoji}</span>
    <span style="font-family:'JetBrains Mono',monospace;font-size:.54rem;font-weight:700;color:${lc.color};background:${ha(lc.color,.15)};padding:1px 4px;border-radius:2px;flex-shrink:0">${step.layer}</span>
    <span style="font-size:.68rem;font-weight:600;color:var(--text-1);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${step.comp}</span>
    <span style="font-family:'JetBrains Mono',monospace;font-size:.54rem;color:${scColor};background:${ha(scColor,.1)};padding:1px 5px;border-radius:3px;border:1px solid ${ha(scColor,.25)};flex-shrink:0">${scLabel[sc]}</span>
    <span style="font-family:'JetBrains Mono',monospace;font-size:.53rem;color:#22c55e;flex-shrink:0">⏱${step.latency}</span>
    <span class="card-chevron" style="font-size:.6rem;color:var(--text-3);flex-shrink:0;transition:transform .2s">▶</span>`;

  // collapsed summary line (always visible)
  const summary=el('div',`padding:2px 10px 4px;font-size:.66rem;color:var(--text-2);border-top:1px solid ${ha(lc.color,.1)}`);
  summary.textContent=step.action;

  // expanded body — CSS grid row trick: 0fr→1fr, no scrollHeight measurement needed
  const bodyWrap=el('div','display:grid;grid-template-rows:0fr;transition:grid-template-rows .25s ease');
  const bodyInner=el('div','overflow:hidden');
  const body=el('div',`padding:8px 10px;font-size:.69rem;color:var(--text-2);line-height:1.68;border-top:1px solid ${ha(lc.color,.12)}`);
  // Plain text section
  const plainDiv=el('div',`font-size:.7rem;color:var(--text-1);line-height:1.6;margin-bottom:6px;padding-bottom:6px;border-bottom:1px dashed ${ha(lc.color,.2)}`);
  plainDiv.innerHTML=`<span style="font-size:.55rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${lc.color};display:block;margin-bottom:2px">Plain</span>${step.plain||step.action}`;
  body.appendChild(plainDiv);
  // Technical detail section
  const techDiv=el('div');
  techDiv.innerHTML='<span style="font-size:.55rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);display:block;margin-bottom:3px">Technical</span>'
    +step.detail
    .replace(/\b(HTTP \d{3})\b/g,`<code style="font-family:'JetBrains Mono',monospace;font-size:.62rem;background:${ha('#f97316',.1)};color:#f97316;padding:0 3px;border-radius:2px">$1</code>`)
    .replace(/\b(NFR-\d+)\b/g,`<code style="font-family:'JetBrains Mono',monospace;font-size:.6rem;background:${ha('#8b5cf6',.1)};color:#8b5cf6;padding:0 3px;border-radius:2px">$1</code>`)
    .replace(/✓/g,`<span style="color:#22c55e;font-weight:700">✓</span>`)
    .replace(/✗/g,`<span style="color:#ef4444;font-weight:700">✗</span>`)
    .replace(/\b(P95|P99|P50)\b/g,`<strong style="color:var(--text-1)">$1</strong>`);
  body.appendChild(techDiv);
  bodyInner.appendChild(body);
  bodyWrap.appendChild(bodyInner);

  let expanded=false;
  hdr.addEventListener('click',()=>{
    expanded=!expanded;
    bodyWrap.style.gridTemplateRows=expanded?'1fr':'0fr';
    const ch=hdr.querySelector('.card-chevron');
    if(ch) ch.style.transform=expanded?'rotate(90deg)':'rotate(0deg)';
  });

  card.appendChild(hdr);
  card.appendChild(summary);
  card.appendChild(bodyWrap);
  feed.appendChild(card);
  requestAnimationFrame(()=>card.scrollIntoView({behavior:'smooth',block:'end'}));

  // Checklist tick
  const clRow=document.getElementById(`cl-${step.id}`);
  if(clRow){
    clRow.style.opacity='1';
    clRow.style.background=ha(lc.color,.07);
    const chk=clRow.querySelector('.cl-chk');
    if(chk){chk.style.background=ha(lc.color,.2);chk.style.borderColor=lc.color;chk.innerHTML=`<span style="color:${lc.color};font-size:.55rem;font-weight:700">✓</span>`;}
    requestAnimationFrame(()=>clRow.scrollIntoView({behavior:'smooth',block:'nearest'}));
  }

  // ── Live latency bar update (re-render totals from steps seen so far) ──
  const latEl2=document.getElementById('sim-lat');
  if(latEl2 && SS.storyId){
    const s3=SIM[SS.storyId];
    const seenSteps=s3.steps.slice(0,idx+1);
    const latAcc={};
    seenSteps.forEach(st=>{
      if(!latAcc[st.layer]) latAcc[st.layer]=0;
      latAcc[st.layer]+=parseInt((st.latency||'0').replace(/[^\d]/g,''))||0;
    });
    const maxAcc=Math.max(1,...Object.values(latAcc));
    latEl2.querySelectorAll('[data-layer]').forEach(row=>{
      const v=latAcc[row.dataset.layer];
      if(v!==undefined){
        const bar=row.querySelector('.lat-bar'); if(bar) bar.style.width=Math.round((v/maxAcc)*100)+'%';
        const ms=row.querySelector('.lat-ms'); if(ms) ms.textContent=v+'ms';
      }
    });
  }

  // KG animate
  kgAnimateStep(step, SIM[SS.storyId].color);
}

function togglePlay(){
  const btn=document.getElementById('sim-play');
  if(SS.running){
    clearInterval(SS.timer); SS.running=false;
    btn.textContent='▶ Play'; btn.style.background='var(--accent)';
  } else {
    const s=SIM[SS.storyId]; if(!s) return;
    SS.running=true; btn.textContent='⏸ Pause'; btn.style.background='#ef4444';
    SS.timer=setInterval(()=>{
      const s2=SIM[SS.storyId];
      if(!s2||SS.stepIdx>=s2.steps.length-1){
        clearInterval(SS.timer); SS.running=false;
        btn.textContent='▶ Play'; btn.style.background='var(--accent)';
        finishSim(); return;
      }
      stepOnce();
    },SS.speed);
  }
}

function resetSim(){
  clearInterval(SS.timer); SS.running=false; SS.stepIdx=-1;
  kgClearDynamic();
  if(SS.storyId) kgHighlightStory(SS.storyId);
  const pb=document.getElementById('sim-play');
  if(pb){pb.textContent='▶ Play';pb.style.background='var(--accent)';}
  const feed=document.getElementById('sim-feed');
  if(feed) feed.innerHTML=`<div style="font-size:.7rem;color:var(--text-3);text-align:center;padding:10px 0">Simulation reset — <strong>Play</strong> to replay</div>`;
  const pb2=document.getElementById('sim-pb'); if(pb2) pb2.style.width='0%';
  const cnt=document.getElementById('sim-cnt');
  if(cnt&&SS.storyId) cnt.textContent=`0 / ${SIM[SS.storyId]?.steps.length||0}`;
  document.getElementById('cl-progress').textContent=SS.storyId?`0/${SIM[SS.storyId]?.steps.length}`:'—';
  document.querySelectorAll('[id^=cl-]').forEach(r=>{r.style.opacity='.3';r.style.background='';const c=r.querySelector('.cl-chk');if(c){c.innerHTML='';c.style.background='';c.style.borderColor='var(--border)';}});
  const hmR=document.getElementById('sim-hm'); if(hmR) hmR.innerHTML='<div style="font-size:.63rem;color:var(--text-3);padding:4px;text-align:center">—</div>';
  const nfrR=document.getElementById('sim-nfrs'); if(nfrR) nfrR.innerHTML='';
  const latR=document.getElementById('sim-lat'); if(latR) latR.innerHTML='';
}

function finishSim(){
  const s=SIM[SS.storyId]; if(!s) return;
  kgMarkFinal(SS.storyId);
  const feed=document.getElementById('sim-feed');
  const fin=el('div','border:2px solid #22c55e;border-radius:8px;padding:12px 16px;background:rgba(34,197,94,.07);text-align:center;flex-shrink:0');
  fin.innerHTML=`<div style="font-size:1.3rem;margin-bottom:6px">✅</div>
    <div style="font-size:.79rem;font-weight:800;color:#22c55e;margin-bottom:4px">Simulation Complete — ${s.steps.length} steps</div>
    <div style="font-size:.68rem;color:var(--text-2)">${s.title}</div>
    <div style="font-size:.62rem;color:var(--text-3);margin-top:3px">Final node marked ⊙ in knowledge graph · click any card header to read detail</div>`;
  feed.appendChild(fin);
  requestAnimationFrame(()=>fin.scrollIntoView({behavior:'smooth',block:'end'}));
}

/* ══════════════════════════════════════════════════════════════════════════
   INJECT TABS
══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  const nav=document.querySelector('.tab-nav');
  const pb=document.querySelector('.page-body');
  if(!nav||!pb) return;

  const style=document.createElement('style');
  style.textContent=`
    @keyframes simIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
    #panel-exec{overflow-y:auto;height:calc(100vh - 124px)}
    #panel-sim{display:none}
    #panel-sim.sim-active{display:block}
  `;
  document.head.appendChild(style);

  const execBtn=document.createElement('button');
  execBtn.className='tab-btn'; execBtn.dataset.tab='exec';
  execBtn.innerHTML='⬡ Executive Summary';
  nav.insertBefore(execBtn,nav.firstChild);

  const simBtn=document.createElement('button');
  simBtn.className='tab-btn'; simBtn.dataset.tab='sim';
  simBtn.innerHTML='🧪 Simulation';
  nav.insertBefore(simBtn,nav.children[1]);

  const execPanel=document.createElement('div');
  execPanel.className='tab-panel'; execPanel.id='panel-exec';
  pb.insertBefore(execPanel,pb.firstChild);

  const simPanel=document.createElement('div');
  simPanel.className='tab-panel'; simPanel.id='panel-sim';
  pb.insertBefore(simPanel,pb.children[1]);

  buildExecSummary();
  buildSim();

  nav.addEventListener('click',e=>{
    const btn=e.target.closest('.tab-btn'); if(!btn) return;
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>{p.classList.remove('active');if(p.id==='panel-sim')p.style.display='none';});
    btn.classList.add('active');
    const pid='panel-'+btn.dataset.tab;
    const panel=document.getElementById(pid); if(!panel) return;
    if(btn.dataset.tab==='sim'){
      panel.style.display='block';
      buildSim();
      // Always rebuild KG so it gets the real rendered dimensions
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        buildKG();
        if(SS.storyId) kgHighlightStory(SS.storyId);
      }));
    } else { panel.classList.add('active'); }
  },true);
});

// ── Expose functions used by inline onclick="" attributes to global scope ──
window.toggleKGFullscreen = toggleKGFullscreen;
window.toggleKGOverlay    = toggleKGOverlay;
window._activePop         = _activePop;

})();
