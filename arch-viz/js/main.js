// ─── Interop Platform Architecture Viewer — v3 ──────────────────────────────
(function () {
'use strict';

const ST = {
  sw:    { x:0, y:0, scale:1 },
  cloud: { x:0, y:0, scale:1 }
};

let activeTT   = null; // currently shown tooltip node id
let activeNode = { sw: null, cloud: null };
let activeTTAnchorEl = null; // SVG node element the tooltip is anchored to
let labelsVisible = { sw: false, cloud: false }; // edge label visibility state

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  buildLegends();
  buildSoftwareDiagram();
  buildCloudDiagram();
  initModalClose();
  animateCounters();
  initGlobalClickDismiss();
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });
  initFAQ();
  initGlossary();
}

// ── Click tooltip: show/hide ──────────────────────────────────────────────────
function positionTT(tt, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const tw = 320, th = 460;
  let lx = rect.right + 12, ly = rect.top + rect.height/2 - 60;
  if (lx + tw > vw - 10) lx = rect.left - tw - 12;
  if (lx < 10) lx = 10;
  if (ly + th > vh - 10) ly = Math.max(10, vh - th - 10);
  if (ly < 10) ly = 10;
  tt.style.left = lx + 'px';
  tt.style.top  = ly + 'px';
}

function showClickTT(id, ds, anchorEl) {
  const n = ds[id];
  if (!n) return;

  const tt = document.getElementById('click-tt');
  activeTTAnchorEl = anchorEl;

  // accent color
  const color = n.color || '#f97316';

  let html = `
    <div class="ctt-accent" style="background:linear-gradient(90deg,${color},${shadeColor(color,20)})"></div>
    <div class="ctt-head">
      <div class="ctt-cat">${n.cat}</div>
      <div class="ctt-name">${n.name}</div>
    </div>
    <div class="ctt-body">
      <div class="ctt-desc">${n.desc}</div>
  `;

  if (n.resp?.length) {
    html += `<div class="ctt-section">Responsibilities</div><ul class="ctt-list">
      ${n.resp.map(r=>`<li>${r}</li>`).join('')}</ul>`;
  }
  if (n.tech?.length) {
    html += `<div class="ctt-section">Technologies & Services</div>
      <div class="ctt-tags">${n.tech.map(t=>`<span class="ctt-tag">${t}</span>`).join('')}</div>`;
  }
  if (n.rfp?.length) {
    html += `<div class="ctt-section">RFP References</div>
      <div class="ctt-tags">${n.rfp.map(r=>`<span class="ctt-tag ctt-tag-rfp">${r}</span>`).join('')}</div>`;
  }
  if (n.tags?.length) {
    html += `<div class="ctt-section">Tags</div>
      <div class="ctt-tags">${n.tags.map(t=>`<span class="ctt-tag">${t}</span>`).join('')}</div>`;
  }

  html += `</div><div class="ctt-footer">Click elsewhere or Escape to dismiss</div>`;

  tt.innerHTML = html;
  positionTT(tt, anchorEl);
  tt.classList.add('show');
  activeTT = id;
}

function hideClickTT() {
  document.getElementById('click-tt').classList.remove('show');
  activeTT = null;
  activeTTAnchorEl = null;
}

function initGlobalClickDismiss() {
  document.addEventListener('click', e => {
    if (!e.target.closest('.n-group') && !e.target.closest('#click-tt')) {
      hideClickTT();
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideClickTT(); });
  // Reposition tooltip on scroll so it follows the node
  window.addEventListener('scroll', () => {
    if (activeTT && activeTTAnchorEl) {
      const tt = document.getElementById('click-tt');
      positionTT(tt, activeTTAnchorEl);
    }
  }, { passive: true });
  document.querySelectorAll('.diagram-canvas-wrap').forEach(wrap => {
    wrap.addEventListener('scroll', () => {
      if (activeTT && activeTTAnchorEl) {
        const tt = document.getElementById('click-tt');
        positionTT(tt, activeTTAnchorEl);
      }
    }, { passive: true });
  });
}

function shadeColor(hex, pct) {
  // lighten hex by pct%
  try {
    const n = parseInt(hex.slice(1),16);
    const f = pct/100;
    const R = Math.min(255, Math.round((n>>16)*(1+f)));
    const G = Math.min(255, Math.round(((n>>8)&0xff)*(1+f)));
    const B = Math.min(255, Math.round((n&0xff)*(1+f)));
    return `#${((1<<24)|(R<<16)|(G<<8)|B).toString(16).slice(1)}`;
  } catch { return hex; }
}

// ── Legends ───────────────────────────────────────────────────────────────────
function buildLegends() {
  renderLegend('sw-legend-list',    SW_LEGEND);
  renderLegend('cloud-legend-list', CLOUD_LEGEND);
}

function renderLegend(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.map(i =>
    `<div class="legend-row">
       <div class="legend-dot" style="background:${i.color}"></div>
       <span class="legend-label">${i.label}</span>
     </div>`
  ).join('');
}

// ── Modal close ───────────────────────────────────────────────────────────────
function initModalClose() {
  // no modal needed — tooltip is the detail
}

// ── Counter animation ─────────────────────────────────────────────────────────
function animateCounters() {
  [['ctr-nodes','48'],['ctr-edges','67'],['ctr-adapters','6'],['ctr-rfp','12']].forEach(([id,end]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const n = parseInt(end);
    let v = 0;
    const step = Math.max(1, Math.round(n/28));
    const t = setInterval(() => { v = Math.min(v+step,n); el.textContent=v; if(v>=n) clearInterval(t); }, 38);
  });
}

// ══ SVG helpers ═══════════════════════════════════════════════════════════════
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  if (attrs) Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v));
  return e;
}
function hexA(hex, a) {
  try {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  } catch { return hex; }
}
function wrapText(text, maxCh) {
  if (text.length <= maxCh) return [text];
  const words = text.split(' '), lines = [];
  let cur = '';
  words.forEach(w => { const nx=cur?cur+' '+w:w; if(nx.length>maxCh&&cur){lines.push(cur);cur=w;}else cur=nx; });
  if (cur) lines.push(cur);
  return lines.slice(0,3);
}

function drawNode(parent, id, x, y, w, h, color, label, sublabel, ds, diag) {
  const g = el('g', { class:'n-group', id:`n-${diag}-${id}`, transform:`translate(${x},${y})`, style:'cursor:pointer' });

  // background
  g.appendChild(el('rect', { width:w, height:h, rx:5, fill:hexA(color,0.08), stroke:color, 'stroke-width':'1.2', 'stroke-opacity':'0.55', class:'n-rect' }));
  // top bar
  g.appendChild(el('rect', { x:8, y:0, width:w-16, height:3, rx:1.5, fill:color, opacity:'0.7' }));

  // text
  const lines = wrapText(label, Math.floor(w/6.5));
  const lh = 13, totalH = lines.length*lh + (sublabel?12:0);
  const sy = Math.round((h-totalH)/2) + lh;
  lines.forEach((ln,i) => {
    const t = el('text', { x:w/2, y:sy+i*lh, 'text-anchor':'middle', 'font-family':'Inter,system-ui,sans-serif', 'font-size':'9.5', 'font-weight':'600', fill:'#1a1a18', 'pointer-events':'none' });
    t.textContent = ln;
    g.appendChild(t);
  });
  if (sublabel) {
    const sub = el('text', { x:w/2, y:sy+lines.length*lh+2, 'text-anchor':'middle', 'font-family':'JetBrains Mono,monospace', 'font-size':'7', fill:color, opacity:'0.8', 'pointer-events':'none' });
    sub.textContent = sublabel;
    g.appendChild(sub);
  }

  // hover effect via JS (clean, no CSS class flicker)
  g.addEventListener('mouseenter', () => {
    g.querySelector('.n-rect')?.setAttribute('fill', hexA(color,0.16));
    g.querySelector('.n-rect')?.setAttribute('stroke-opacity','0.85');
  });
  g.addEventListener('mouseleave', () => {
    if (activeTT !== id) {
      g.querySelector('.n-rect')?.setAttribute('fill', hexA(color,0.08));
      g.querySelector('.n-rect')?.setAttribute('stroke-opacity','0.55');
    }
  });

  // Click: show detailed tooltip
  g.addEventListener('click', e => {
    e.stopPropagation();
    if (activeTT === id) { hideClickTT(); resetEdgeHighlight(diag); return; }
    showClickTT(id, ds, g);
    // highlight selected node
    resetHighlight(diag);
    resetEdgeHighlight(diag);
    g.querySelector('.n-rect')?.setAttribute('fill', hexA(color,0.2));
    g.querySelector('.n-rect')?.setAttribute('stroke-width','2');
    g.querySelector('.n-rect')?.setAttribute('stroke-opacity','1');
    activeNode[diag] = { id, g, color };
    // highlight connected edges
    highlightEdges(diag, id);
    // update sidebar
    updateSidebar(id, ds, diag);
  });

  parent.appendChild(g);
  return g;
}

function resetHighlight(diag) {
  const prev = activeNode[diag];
  if (prev) {
    prev.g.querySelector('.n-rect')?.setAttribute('fill', hexA(prev.color,0.08));
    prev.g.querySelector('.n-rect')?.setAttribute('stroke-width','1.2');
    prev.g.querySelector('.n-rect')?.setAttribute('stroke-opacity','0.55');
  }
}

function highlightEdges(diag, nodeId) {
  const _pid2 = diag === 'sw' ? 'panel-software' : `panel-${diag}`;
  const svg = document.querySelector(`#${_pid2} svg`);
  if (!svg) return;
  svg.querySelectorAll('.edge-g').forEach(eg => {
    const from = eg.getAttribute('data-from');
    const to   = eg.getAttribute('data-to');
    const hit  = from === nodeId || to === nodeId;
    const path = eg.querySelector('path');
    const poly = eg.querySelector('polygon');
    const lbl  = eg.querySelector('.edge-label');
    if (hit) {
      if (path) { path.setAttribute('stroke-opacity','0.95'); path.setAttribute('stroke-width','2.2'); }
      if (poly) poly.setAttribute('opacity','1');
      eg.classList.add('edge-active');
      // always show label on connected edge when node is selected
      if (lbl) lbl.style.display = '';
    } else {
      if (path) {
        path.setAttribute('stroke-opacity', path.classList.contains('edge-flow') ? '0.15' : '0.1');
        path.setAttribute('stroke-width','0.8');
      }
      if (poly) poly.setAttribute('opacity','0.15');
      eg.classList.remove('edge-active');
      // only hide label if global labels are off
      if (lbl && !labelsVisible[diag]) lbl.style.display = 'none';
    }
  });
}

function resetEdgeHighlight(diag) {
  const _pid3 = diag === 'sw' ? 'panel-software' : `panel-${diag}`;
  const svg = document.querySelector(`#${_pid3} svg`);
  if (!svg) return;
  svg.querySelectorAll('.edge-g').forEach(eg => {
    const path = eg.querySelector('path');
    const poly = eg.querySelector('polygon');
    const lbl  = eg.querySelector('.edge-label');
    if (path) {
      path.setAttribute('stroke-opacity', path.classList.contains('edge-flow') ? '0.5' : '0.3');
      path.setAttribute('stroke-width', path.classList.contains('edge-flow') ? '1.5' : '1');
    }
    if (poly) { const pth=eg.querySelector('path'); poly.setAttribute('opacity', pth?.classList.contains('edge-flow') ? '0.6' : '0.35'); }
    eg.classList.remove('edge-active');
    if (lbl) lbl.style.display = labelsVisible[diag] ? '' : 'none';
  });
}

function toggleLabels(diag) {
  labelsVisible[diag] = !labelsVisible[diag];
  // Map toolbar prefix to actual panel id (sw-toolbar → panel-software)
  const panelId = diag === 'sw' ? 'panel-software' : `panel-${diag}`;
  const svg = document.querySelector(`#${panelId} svg`);
  if (!svg) { console.warn('toggleLabels: no SVG in', panelId); return; }
  svg.querySelectorAll('.edge-label').forEach(lbl => {
    lbl.style.display = labelsVisible[diag] ? '' : 'none';
  });
  // update button text
  const btn = document.querySelector(`#${diag}-toolbar [data-action="labels"]`);
  if (btn) btn.textContent = labelsVisible[diag] ? 'Hide Labels' : 'Show Labels';
  btn?.classList.toggle('active', labelsVisible[diag]);
}

function drawEdge(parent, x1, y1, x2, y2, color, animated, label, fromId, toId) {
  const g = el('g', { class:'edge-g', 'data-from': fromId||'', 'data-to': toId||'' });
  const dx=x2-x1, dy=y2-y1;
  const cp1x=x1+dx*0.4, cp1y=y1, cp2x=x2-dx*0.4, cp2y=y2;
  const path = el('path', {
    d:`M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`,
    stroke:color, 'stroke-width':animated?'1.5':'1', 'stroke-opacity':animated?'0.5':'0.3',
    fill:'none', 'stroke-dasharray':animated?'6 4':'none', class:animated?'edge-flow':''
  });
  g.appendChild(path);

  // arrowhead
  const ang = Math.atan2(y2-cp2y, x2-cp2x), as=5;
  const ax1=x2-as*Math.cos(ang-0.4), ay1=y2-as*Math.sin(ang-0.4);
  const ax2=x2-as*Math.cos(ang+0.4), ay2=y2-as*Math.sin(ang+0.4);
  g.appendChild(el('polygon', { points:`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`, fill:color, opacity:animated?'0.6':'0.35' }));

  if (label) {
    const mx=(x1+x2)/2, my=(y1+y2)/2-8;
    const lg = el('g', { class:'edge-label', style:'display:none' });
    lg.appendChild(el('rect', { x:mx-label.length*2.7, y:my-7, width:label.length*5.4+2, height:10, rx:2, fill:'rgba(255,255,255,0.96)', stroke:hexA(color,0.35), 'stroke-width':'0.6' }));
    const lt = el('text', { x:mx, y:my+1, 'text-anchor':'middle', 'font-family':'JetBrains Mono,monospace', 'font-size':'7', fill:hexA(color,0.9), 'pointer-events':'none' });
    lt.textContent = label;
    lg.appendChild(lt);
    g.appendChild(lg);
  }
  parent.insertBefore(g, parent.firstChild);
  return g;
}

function drawGroup(parent, x, y, w, h, color, label) {
  const g = el('g');
  g.appendChild(el('rect', { x, y, width:w, height:h, rx:8, fill:hexA(color,0.03), stroke:color, 'stroke-width':'1', 'stroke-dasharray':'6 3', 'stroke-opacity':'0.35' }));
  const lw = label.length*5.8+16;
  g.appendChild(el('rect', { x:x+10, y:y-8, width:lw, height:16, rx:4, fill:'#fafaf9', stroke:color, 'stroke-width':'0.8', 'stroke-opacity':'0.5' }));
  const lt = el('text', { x:x+19, y:y+4, 'font-family':'Inter,system-ui,sans-serif', 'font-size':'7.5', 'font-weight':'700', fill:color, opacity:'0.8', 'letter-spacing':'0.8', 'pointer-events':'none' });
  lt.textContent = label;
  g.appendChild(lt);
  parent.insertBefore(g, parent.firstChild);
}

// ── Update sidebar ────────────────────────────────────────────────────────────
function updateSidebar(id, ds, diag) {
  const n = ds[id];
  if (!n) return;
  const empty  = document.querySelector(`#panel-${diag} .nd-empty`);
  const detail = document.querySelector(`#panel-${diag} .nd-detail`);
  if (empty)  empty.style.display  = 'none';
  if (!detail) return;

  let html = `
    <div class="nd-cat">${n.cat}</div>
    <div class="nd-name" style="color:${n.color}">${n.name}</div>
    <span class="nd-badge">${id}</span>
    <div class="nd-desc">${n.desc}</div>
  `;
  if (n.resp?.length) {
    html += `<div class="nd-section">Responsibilities</div>
      <ul class="nd-list">${n.resp.map(r=>`<li>${r}</li>`).join('')}</ul>`;
  }
  if (n.tech?.length) {
    html += `<div class="nd-section">Technologies</div>
      <div class="nd-tags">${n.tech.map(t=>`<span class="nd-tag">${t}</span>`).join('')}</div>`;
  }
  if (n.rfp?.length) {
    html += `<div class="nd-section">RFP Coverage</div>
      <div class="nd-tags">${n.rfp.map(r=>`<span class="nd-tag nd-tag-rfp">${r}</span>`).join('')}</div>`;
  }
  detail.innerHTML = html;
  detail.style.display = 'block';
}

// ── Pan & Zoom ────────────────────────────────────────────────────────────────
function initPanZoom(container, innerG, st, toolbar) {
  let pan=false, px=0, py=0, ptx=0, pty=0, lastPinch=0;
  function apply() { innerG.setAttribute('transform',`translate(${st.x},${st.y}) scale(${st.scale})`); }

  container.addEventListener('mousedown', e => {
    if (e.button!==0) return;
    pan=true; px=e.clientX; py=e.clientY; ptx=st.x; pty=st.y;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!pan) return;
    st.x=ptx+(e.clientX-px); st.y=pty+(e.clientY-py); apply();
  });
  document.addEventListener('mouseup', () => { pan=false; });

  container.addEventListener('wheel', e => {
    e.preventDefault();
    const rect=container.getBoundingClientRect();
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    const f=e.deltaY<0?1.12:0.9, ns=Math.min(4,Math.max(0.15,st.scale*f));
    const r=ns/st.scale;
    st.x=mx-r*(mx-st.x); st.y=my-r*(my-st.y); st.scale=ns; apply();
  },{passive:false});

  container.addEventListener('touchstart', e => {
    if (e.touches.length===1){pan=true;px=e.touches[0].clientX;py=e.touches[0].clientY;ptx=st.x;pty=st.y;}
    else if(e.touches.length===2){pan=false;lastPinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}
  },{passive:true});
  container.addEventListener('touchmove', e=>{
    e.preventDefault();
    if(e.touches.length===1&&pan){st.x=ptx+(e.touches[0].clientX-px);st.y=pty+(e.touches[0].clientY-py);apply();}
    else if(e.touches.length===2&&lastPinch){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);st.scale=Math.min(4,Math.max(0.15,st.scale*(d/lastPinch)));lastPinch=d;apply();}
  },{passive:false});
  container.addEventListener('touchend',()=>{pan=false;lastPinch=0;});

  if (toolbar) {
    toolbar.querySelector('[data-action="zi"]')?.addEventListener('click',()=>{st.scale=Math.min(4,st.scale*1.2);apply();});
    toolbar.querySelector('[data-action="zo"]')?.addEventListener('click',()=>{st.scale=Math.max(0.15,st.scale*0.83);apply();});
    toolbar.querySelector('[data-action="rs"]')?.addEventListener('click',()=>{st.x=0;st.y=0;st.scale=1;apply();});
    toolbar.querySelector('[data-action="ft"]')?.addEventListener('click',()=>{st.x=0;st.y=0;st.scale=0.68;apply();});
    toolbar.querySelector('[data-action="labels"]')?.addEventListener('click',()=>{
      const diag = toolbar.id.replace('-toolbar','');
      toggleLabels(diag);
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SOFTWARE ARCHITECTURE DIAGRAM
// ══════════════════════════════════════════════════════════════════════════════
function buildSoftwareDiagram() {
  const container = document.getElementById('sw-canvas');
  const toolbar   = document.getElementById('sw-toolbar');
  if (!container) return;

  const VW=1160, VH=1760;
  const svg = el('svg',{viewBox:`0 0 ${VW} ${VH}`, xmlns:NS});
  svg.style.cssText='width:100%;display:block;';
  const g=el('g',{id:'sw-g'});
  svg.appendChild(g);

  const D=ND.sw;
  const N=(id,x,y,w,h,c,lbl,sub)=>drawNode(g,id,x,y,w,h,c,lbl,sub,D,'sw');
  const E=(x1,y1,x2,y2,c,anim,lbl,f,t)=>drawEdge(g,x1,y1,x2,y2,c,anim,lbl,f,t);
  const G=(x,y,w,h,c,lbl)=>drawGroup(g,x,y,w,h,c,lbl);

  G(10,14,1140,120,'#3b82f6','CHANNEL & PORTAL');
  G(10,164,1140,105,'#ec4899','IDENTITY & CONSENT');
  G(10,300,1140,74,'#f97316','API GATEWAY');
  G(10,404,1140,74,'#8b5cf6','API FACADE');
  G(10,508,1140,500,'#3b82f6','INTEROPERABILITY PLATFORM');
  G(10,1040,1140,148,'#22c55e','REGISTRY ADAPTERS (6×)');
  G(10,1220,560,92,'#ef4444','TRUST SERVICES');
  G(590,1220,560,92,'#3b82f6','BACK OFFICE & CASE');
  G(10,1344,1140,90,'#3b82f6','OBSERVABILITY & SECOPS');
  G(10,1464,1140,76,'#22c55e','OPERATIONAL DATA STORES');
  G(10,1570,740,160,'#8b5cf6','LAKEHOUSE  —  DELTA MEDALLION');
  G(770,1570,380,160,'#8b5cf6','ANALYTICS & BI');

  N('CLIENT',30,36,148,54,'#3b82f6','Citizen / Business User','End User');
  N('PORTAL',220,32,200,58,'#3b82f6','Portal (Web / Mobile / Kiosk)','Multi-Channel');
  N('SCHEMA',460,36,160,48,'#06b6d4','Form / UI Schema Service','Config-Driven');

  N('EID',30,182,150,46,'#ec4899','eID IdP (OIDC+PKCE)','National eID');
  N('CONS',220,182,160,46,'#ec4899','Consent Service','Purpose-Bound · Expiry');
  N('CLAIMS',420,182,160,46,'#ec4899','Claims Mapper (RBAC)','ACR · Scopes');

  N('APIM',250,320,640,48,'#f97316','Azure API Management Premium','JWT · RBAC · Rate Limits · Webhooks · VNet');

  N('FACADE',150,422,860,48,'#8b5cf6','API Facade  —  Versioned Stable Contracts','Idempotency · application/problem+json · Webhook Normalisation');

  N('ORCH',200,530,280,54,'#3b82f6','Controller / Orchestrator','Sagas · Workflows · Fan-out');
  N('SEC',30,530,140,54,'#06b6d4','Security & Consent Enforcement','Consent Gate · ABAC');
  N('MAPVAL',520,530,160,54,'#3b82f6','Mapping & Validation','Canonical DTO');
  N('DQ',720,530,130,54,'#3b82f6','Data Quality','DQ Rules');
  N('MDM',520,624,160,48,'#06b6d4','MDM Cache (Once-Only)','Redis · ETag · TTL');
  N('RULES',720,624,130,48,'#3b82f6','Rules Engine','Eligibility');
  N('EVENT',110,720,210,48,'#3b82f6','Event Backbone','Service Bus · Event Grid');
  N('DLQ',30,840,140,42,'#ef4444','Dead Letter Queue','DLQ · Recovery');
  N('AUDIT',210,840,170,42,'#ef4444','Audit Evidence (WORM)','Signed · Immutable');

  const adCfg=[
    ['AD_CIV','Adapter: Civil','#22c55e'],
    ['AD_ADDR','Adapter: Address','#22c55e'],
    ['AD_BUS','Adapter: Business','#22c55e'],
    ['AD_LIC','Adapter: License','#22c55e'],
    ['AD_TAX','Adapter: Tax','#22c55e'],
    ['AD_LAND','Adapter: Land/Kadaster','#22c55e']
  ];
  adCfg.forEach(([id,name,c],i) => N(id,18+i*190,1060,170,42,c,name,'SoR Adapter'));

  N('DOCI',30,1240,160,44,'#ef4444','Document Intake','Pre-sign · AV Scan');
  N('ESIGN',220,1240,150,44,'#ef4444','eSign Provider','Digital Signature');
  N('PAY',400,1240,150,44,'#ef4444','Payment Gateway','PSP Session');

  N('CASESYS',610,1240,280,44,'#3b82f6','Case Management System','Back Office · Workflow');

  N('APPLOGS',80,1362,320,44,'#3b82f6','App Insights / Log Analytics','SLOs · Traces · KQL · Burn-rate');
  N('SENT',450,1362,240,44,'#3b82f6','Microsoft Sentinel (SIEM)','Threat Detection · SecOps');

  N('ODS_PG',20,1482,180,44,'#22c55e','Azure PostgreSQL (ZRS)','Primary ODS · PITR');
  N('COSMOS',230,1482,190,44,'#22c55e','Azure Cosmos DB','Read Models · Multi-Region');
  N('REDIS',450,1482,160,44,'#06b6d4','Redis Enterprise','MDM Cache · Session');
  N('BLOB_A',640,1482,180,44,'#ef4444','Blob Storage (WORM)','Audit · Docs · Immutable');

  N('BRONZE',22,1594,210,44,'#8b5cf6','Bronze  —  Raw Landing','CDC · Append-only');
  N('SILVER',262,1594,210,44,'#8b5cf6','Silver  —  Cleansed','De-dup · PII Redact');
  N('GOLD',502,1594,210,44,'#8b5cf6','Gold  —  Curated','Dims · Facts · KPIs');

  N('FABWH',782,1590,160,44,'#8b5cf6','Fabric Warehouse','SQL · Direct Lake · RLS');
  N('PBI',782,1656,160,44,'#8b5cf6','Power BI (Fabric)','Dashboards · RLS');
  N('PURVIEW',970,1590,150,110,'#8b5cf6','Microsoft Purview','Catalog · Lineage');

  // Edges — (x1,y1,x2,y2,color,animated,label,fromId,toId)
  E(178,63,220,61,'#3b82f6',false,'browse','CLIENT','PORTAL');
  E(420,61,460,60,'#06b6d4',false,'fetch schema','PORTAL','SCHEMA');
  E(310,90,100,182,'#ec4899',true,'PKCE /authorize','PORTAL','EID');
  E(350,90,295,182,'#ec4899',false,'record consent','PORTAL','CONS');
  E(370,90,490,320,'#f97316',true,'Bearer JWT','PORTAL','APIM');
  E(570,368,580,422,'#8b5cf6',false,'route','APIM','FACADE');
  E(500,470,340,530,'#3b82f6',true,'command','FACADE','ORCH');
  E(200,557,170,557,'#06b6d4',false,'consent gate','ORCH','SEC');
  E(480,557,520,557,'#3b82f6',false,'map','ORCH','MAPVAL');
  E(680,557,720,557,'#3b82f6',false,'quality','MAPVAL','DQ');
  E(340,584,520,648,'#06b6d4',true,'ETag','ORCH','MDM');
  E(480,574,720,648,'#3b82f6',false,'eligibility','ORCH','RULES');
  E(260,584,215,720,'#3b82f6',true,'publish event','ORCH','EVENT');
  E(215,768,100,840,'#ef4444',false,'max retry → DLQ','EVENT','DLQ');
  E(215,768,295,840,'#ef4444',false,'evidence','ORCH','AUDIT');
  const adX=[103,293,483,673,863,1053];
  const adIds=['AD_CIV','AD_ADDR','AD_BUS','AD_LIC','AD_TAX','AD_LAND'];
  adCfg.forEach((_,i)=>E(340,584,adX[i],1060,'#22c55e',true,'fetch','ORCH',adIds[i]));
  E(260,584,110,1240,'#ef4444',false,'doc intake','ORCH','DOCI');
  E(260,584,290,1240,'#ef4444',false,'eSign','ORCH','ESIGN');
  E(260,584,480,1240,'#ef4444',false,'payment','ORCH','PAY');
  E(480,570,750,1240,'#3b82f6',false,'submit case','ORCH','CASESYS');
  E(570,344,240,1362,'#3b82f6',false,'telemetry','APIM','APPLOGS');
  E(570,470,240,1362,'#3b82f6',false,'traces','FACADE','APPLOGS');
  E(340,600,240,1362,'#3b82f6',false,'metrics','ORCH','APPLOGS');
  E(670,1362,560,1384,'#3b82f6',false,'detections','APPLOGS','SENT');
  E(260,584,110,1482,'#22c55e',false,'write','ORCH','ODS_PG');
  E(340,584,325,1482,'#22c55e',false,'read model','ORCH','COSMOS');
  E(340,584,530,1482,'#06b6d4',false,'MDM cache','ORCH','REDIS');
  E(380,882,730,1482,'#ef4444',false,'WORM receipt','AUDIT','BLOB_A');
  E(110,1504,127,1594,'#8b5cf6',true,'WAL CDC','ODS_PG','BRONZE');
  E(325,1504,280,1594,'#8b5cf6',true,'change feed','COSMOS','BRONZE');
  E(232,1616,262,1616,'#8b5cf6',true,'cleanse','BRONZE','SILVER');
  E(472,1616,502,1616,'#8b5cf6',true,'curate','SILVER','GOLD');
  E(712,1616,782,1612,'#8b5cf6',false,'SQL models','GOLD','FABWH');
  E(862,1634,862,1656,'#8b5cf6',false,'Direct Lake','FABWH','PBI');
  E(712,1616,970,1630,'#8b5cf6',false,'lineage','GOLD','PURVIEW');
  E(730,1504,1045,1610,'#8b5cf6',false,'audit lineage','BLOB_A','PURVIEW');

  container.appendChild(svg);
  initPanZoom(container, g, ST.sw, toolbar);
}

// ══════════════════════════════════════════════════════════════════════════════
// CLOUD DEPLOYMENT DIAGRAM
// ══════════════════════════════════════════════════════════════════════════════
function buildCloudDiagram() {
  const container = document.getElementById('cloud-canvas');
  const toolbar   = document.getElementById('cloud-toolbar');
  if (!container) return;

  const VW=1160, VH=1540;
  const svg=el('svg',{viewBox:`0 0 ${VW} ${VH}`,xmlns:NS});
  svg.style.cssText='width:100%;display:block;';
  const g=el('g',{id:'cloud-g'});
  svg.appendChild(g);

  const D=ND.cloud;
  const N=(id,x,y,w,h,c,lbl,sub)=>drawNode(g,id,x,y,w,h,c,lbl,sub,D,'cloud');
  const E=(x1,y1,x2,y2,c,anim,lbl,f,t)=>drawEdge(g,x1,y1,x2,y2,c,anim,lbl,f,t);
  const GG=(x,y,w,h,c,lbl)=>drawGroup(g,x,y,w,h,c,lbl);

  GG(10,14,1140,74,'#f59e0b','EDGE  —  AZURE FRONT DOOR (GLOBAL)');
  GG(10,116,1140,430,'#3b82f6','REGION A  —  PRIMARY (ZONE-REDUNDANT)');
  GG(22,175,540,72,'#f97316','API GATEWAY SUBNET');
  GG(22,275,540,74,'#3b82f6','APPLICATION SUBNET  —  CONTAINER APPS');
  GG(22,378,280,140,'#f59e0b','MESSAGING');
  GG(590,175,540,240,'#22c55e','DATA STORES  —  PRIVATE ENDPOINTS');
  GG(590,435,540,96,'#ef4444','SECURITY & STORAGE');
  GG(10,578,1140,84,'#3b82f6','OBSERVABILITY');
  GG(10,690,1140,200,'#f97316','INGESTION LAYER  —  CDC / ELT / SPARK');
  GG(10,924,1140,148,'#8b5cf6','LAKEHOUSE  —  FABRIC ONELAKE  —  DELTA');
  GG(10,1104,560,120,'#8b5cf6','REGION B  —  DR WARM STANDBY');
  GG(590,1104,560,120,'#8b5cf6','ANALYTICS & BI');

  N('FDOOR',380,32,400,46,'#f59e0b','Azure Front Door Premium','WAF · CDN · Global · TLS');
  N('APIM_A',32,192,260,44,'#f97316','APIM Premium (Region A)','JWT · RBAC · VNet');
  N('VNET_A',320,192,220,44,'#06b6d4','VNet A','Edge + App + PE Subnets');
  N('FAC_A',32,292,260,46,'#3b82f6','API Facade (Container Apps)','KEDA · Internal Ingress');
  N('ORCH_A',320,292,230,46,'#3b82f6','Orchestrator (Container Apps)','Sagas · Durable Functions');
  N('SBUS_A',32,398,126,48,'#f59e0b','Service Bus Premium','Queues · Topics · DLQ');
  N('EVGR_A',184,398,110,48,'#f59e0b','Event Grid','Domain Events');
  N('PG_A',600,192,240,44,'#22c55e','PostgreSQL Flexible (ZRS)','Primary ODS · PITR · CDC');
  N('COS_A',870,192,250,44,'#22c55e','Cosmos DB (Multi-Region)','Read Models · Change Feed');
  N('RED_A',600,268,240,44,'#06b6d4','Redis Enterprise (Clustered)','MDM Cache · TLS');
  N('BLOB_A',870,268,250,44,'#ef4444','Blob Storage (ZRS/GRS)','Docs + WORM Audit');
  N('KV_A',600,454,240,44,'#ef4444','Azure Key Vault','Secrets · Certs · Managed Identity');
  N('LA_A',300,598,400,44,'#3b82f6','Log Analytics Workspace','Traces · SLO KQL · Burn-rate Alerts');
  N('DEBEZ',20,714,210,44,'#f97316','Debezium CDC (Container Apps)','Postgres WAL → Event Hubs');
  N('CFEED',254,714,200,44,'#f97316','Cosmos Change Feed (Functions)','Change Feed → Bronze');
  N('EVH',478,714,180,44,'#f97316','Azure Event Hubs','Kafka-compat · Capture');
  N('ADF',682,714,180,44,'#f97316','Data Factory Pipeline','ELT Orchestration');
  N('DATABRICKS',886,714,254,44,'#f97316','Databricks / Fabric Spark','Medallion Transforms');
  N('ONELAKE',20,944,190,44,'#8b5cf6','Fabric OneLake (ADLS Gen2)','Unified Delta Storage');
  N('BRONZE',240,944,190,44,'#8b5cf6','Bronze  —  Raw','Append-only Landing');
  N('SILVER',460,944,190,44,'#8b5cf6','Silver  —  Cleansed','PII Redact · De-dup');
  N('GOLD',680,944,190,44,'#8b5cf6','Gold  —  Curated','Dims · Facts · KPIs');
  N('APIM_B',24,1126,170,40,'#8b5cf6','APIM (Region B)','Failover Standby');
  N('PG_REPL',214,1126,170,40,'#8b5cf6','Postgres Geo-Replica (B)','DR · Cross-Region');
  N('COS_B',404,1126,156,40,'#8b5cf6','Cosmos DB Secondary (B)','Auto-failover');
  N('FABWH',600,1118,200,46,'#8b5cf6','Fabric Warehouse','SQL · Direct Lake · RLS');
  N('PBI',824,1118,180,46,'#8b5cf6','Power BI (Fabric)','Dashboards · Semantic');
  N('PURVIEW',1030,1118,110,90,'#8b5cf6','Microsoft Purview','Catalog · Lineage');

  E(580,78,162,192,'#f59e0b',true,'HTTPS/WAF','FDOOR','APIM_A');
  E(580,78,109,1126,'#8b5cf6',false,'DR failover','FDOOR','APIM_B');
  E(162,236,162,292,'#3b82f6',false,'route','APIM_A','FAC_A');
  E(292,315,320,315,'#3b82f6',false,'orchestrate','FAC_A','ORCH_A');
  E(435,338,90,398,'#f59e0b',true,'events','ORCH_A','SBUS_A');
  E(435,338,239,398,'#f59e0b',false,'domain events','ORCH_A','EVGR_A');
  E(550,315,720,192,'#22c55e',false,'OLTP write','ORCH_A','PG_A');
  E(550,315,995,192,'#22c55e',false,'read model','ORCH_A','COS_A');
  E(550,315,720,268,'#06b6d4',true,'MDM cache','ORCH_A','RED_A');
  E(550,315,995,268,'#ef4444',false,'audit / docs','ORCH_A','BLOB_A');
  E(550,315,720,454,'#ef4444',false,'secrets','ORCH_A','KV_A');
  E(162,236,720,454,'#ef4444',false,'APIM secrets','APIM_A','KV_A');
  E(435,338,500,598,'#3b82f6',false,'telemetry','ORCH_A','LA_A');
  E(995,312,700,598,'#3b82f6',false,'Cosmos metrics','COS_A','LA_A');
  E(720,476,700,598,'#3b82f6',false,'KV audit','KV_A','LA_A');
  E(720,214,125,714,'#f97316',true,'WAL CDC','PG_A','DEBEZ');
  E(995,214,354,714,'#f97316',true,'Change Feed','COS_A','CFEED');
  E(230,736,478,736,'#f97316',false,'stream','DEBEZ','EVH');
  E(568,758,335,944,'#8b5cf6',true,'stream land','EVH','BRONZE');
  E(354,758,335,944,'#8b5cf6',false,'land','CFEED','BRONZE');
  E(772,758,430,944,'#f97316',false,'orchestrate','ADF','SILVER');
  E(1013,758,555,944,'#8b5cf6',false,'transform','DATABRICKS','SILVER');
  E(430,966,460,966,'#8b5cf6',true,'cleanse','BRONZE','SILVER');
  E(650,966,680,966,'#8b5cf6',true,'curate','SILVER','GOLD');
  E(870,966,700,1118,'#8b5cf6',false,'SQL models','GOLD','FABWH');
  E(800,1141,824,1141,'#8b5cf6',false,'Direct Lake','FABWH','PBI');
  E(870,966,1085,1118,'#8b5cf6',false,'lineage','GOLD','PURVIEW');
  E(720,236,1085,1130,'#8b5cf6',false,'PG lineage','PG_A','PURVIEW');
  E(720,214,299,1126,'#8b5cf6',false,'geo-replica','PG_A','PG_REPL');
  E(995,214,477,1126,'#8b5cf6',false,'multi-region','COS_A','COS_B');

  container.appendChild(svg);
  initPanZoom(container, g, ST.cloud, toolbar);
}

// ══════════════════════════════════════════════════════════════════════════════
// FAQ
// ══════════════════════════════════════════════════════════════════════════════
const FAQS = [
  // ── ARCHITECTURE
  { cat:'Architecture & Design', q:'What is the overall architecture pattern?', a:`
    <p>The platform follows a <strong>layered, API-first, zero-trust architecture</strong> composed of seven distinct tiers. Traffic enters through <strong>Azure Front Door Premium</strong> (global WAF), passes through <strong>Azure APIM Premium</strong> (JWT validation, RBAC, rate limits), hits the <strong>API Facade</strong> (versioned stable contracts), which delegates to the <strong>Interop Platform Core</strong> (Orchestrator, Consent Engine, Mapping, DQ, Rules, MDM Cache, Event Backbone). The platform calls <strong>six Registry Adapters</strong> to fetch canonical data from authoritative sources, then writes outcomes to OLTP stores and emits domain events to the event-driven lakehouse pipeline.</p>
    <p>The design deliberately avoids point-to-point coupling — no service calls a registry directly. All access flows through the Orchestrator → Adapter path, with the Consent Gate checked before every external call.</p>
    <p><span class="faq-ref">RFP-REQ-01</span><span class="faq-ref">RFP-REQ-02</span><span class="faq-ref">RFP-REQ-04</span></p>
  `},
  { cat:'Architecture & Design', q:'Why was an Orchestrator/Facade split chosen instead of a monolith?', a:`
    <p>A <strong>monolith</strong> would couple the API contract to the orchestration logic — any internal refactor risks breaking consumers. The split provides three guarantees:</p>
    <ul>
      <li><strong>Facade</strong> owns the contract surface (/v1…/v2 URIs, error model, idempotency). It changes only when the API contract changes (planned, versioned).</li>
      <li><strong>Orchestrator</strong> owns workflow logic (saga steps, consent sequencing, adapter fan-out). It can be refactored freely without touching the Facade.</li>
      <li><strong>Independent scaling</strong>: the Facade autoscales on HTTP concurrency (KEDA HTTP trigger); the Orchestrator scales on queue depth (KEDA Service Bus trigger).</li>
    </ul>
    <p>This mirrors the <strong>Strangler Fig</strong> pattern — the Facade allows a future swap of Orchestrator internals (e.g. moving from sagas to BPMN) with zero API-surface impact.</p>
    <p><span class="faq-ref">RFP-REQ-04</span></p>
  `},
  { cat:'Architecture & Design', q:'What is the "Once-Only Principle" and how is it implemented?', a:`
    <p>The <strong>Once-Only Principle</strong> (OOP) means a citizen should never have to supply data the government already holds. When a citizen starts a service journey, the platform automatically prefills forms with verified registry data.</p>
    <p><strong>Implementation:</strong></p>
    <ul>
      <li>The Orchestrator issues a <code>GET /mdm/snapshot/{nid}</code> with an <code>If-None-Match</code> ETag header to Redis Enterprise.</li>
      <li>On <strong>HIT (304)</strong>: cached canonical snapshot is returned (&lt;5ms) — no registry call needed.</li>
      <li>On <strong>MISS (200)</strong>: Orchestrator fans out to relevant adapters, assembles a canonical snapshot, stores it in Redis with an ETag and TTL, then returns it.</li>
      <li><strong>Invalidation</strong>: when a registry SoR changes, it emits an event to Azure Event Grid → the MDM cache handler rotates the ETag and marks the snapshot stale.</li>
    </ul>
    <p><strong>SLO targets</strong>: cache hit-rate ≥80%, stale field rate &lt;2%, P95 time-to-first-action ≤600ms, consent-gate violations = 0.</p>
    <p><span class="faq-ref">RFP-REQ-05</span><span class="faq-ref">NFR-16</span><span class="faq-ref">NFR-25</span></p>
  `},
  { cat:'Architecture & Design', q:'How does the event-driven backbone work?', a:`
    <p>The platform uses <strong>Azure Service Bus Premium</strong> for reliable command/event delivery and <strong>Azure Event Grid</strong> for fan-out domain notifications:</p>
    <ul>
      <li><strong>Service Bus topics</strong>: Orchestrator publishes saga steps (e.g. <code>application.submitted</code>, <code>consent.recorded</code>) as messages. Downstream consumers (Case System, Audit, Notification) subscribe independently.</li>
      <li><strong>Service Bus queues</strong>: per-service queues with <code>maxDeliveryCount = 5</code>. Failed messages go to DLQ with full context for manual triage.</li>
      <li><strong>Event Grid</strong>: registry SoR change events fan out to MDM invalidation, analytics pipeline triggers, and webhook subscribers.</li>
      <li><strong>DLQ runbooks</strong>: on DLQ alert (Azure Monitor), an on-call engineer follows a runbook to inspect, correct, and re-drive messages. DLQ age SLO = alert if message &gt;4 hours old.</li>
    </ul>
    <p><span class="faq-ref">RFP-REQ-08</span><span class="faq-ref">RFP-REQ-09</span><span class="faq-ref">RFP-REQ-11</span></p>
  `},
  // ── SECURITY
  { cat:'Security & Identity', q:'How does OIDC + PKCE authentication work?', a:`
    <p><strong>OpenID Connect (OIDC)</strong> is the identity layer on top of OAuth 2.0. <strong>PKCE (Proof Key for Code Exchange)</strong> protects the authorisation code flow from interception attacks, especially in public clients (browser, mobile).</p>
    <p><strong>Flow:</strong></p>
    <ul>
      <li>Portal generates a random <code>code_verifier</code>, computes <code>code_challenge = SHA-256(code_verifier)</code>.</li>
      <li>Redirects to <code>/authorize?response_type=code&amp;code_challenge=...&amp;code_challenge_method=S256</code>.</li>
      <li>After authentication, IdP issues an <strong>Authorization Code</strong> (single-use, short-lived).</li>
      <li>Portal POSTs <code>/token</code> with <code>code + code_verifier</code>. IdP verifies SHA-256(verifier) = challenge.</li>
      <li>Returns: <strong>ID Token</strong> (citizen identity, ≤5 min TTL), <strong>Access Token</strong> (API authorisation, ≤15 min TTL), <strong>Refresh Token</strong> (rotating).</li>
    </ul>
    <p>Tokens are stored in <strong>HttpOnly, Secure, SameSite=Lax</strong> cookies. APIM validates the Access Token signature (RS256/ES256) against JWKS endpoint before any request reaches the Facade.</p>
    <p><span class="faq-ref">RFP-REQ-03</span></p>
  `},
  { cat:'Security & Identity', q:'What is Zero-Trust and how is it enforced here?', a:`
    <p><strong>Zero-Trust</strong> is a security model that assumes <em>no implicit trust</em> — every request must be authenticated and authorised regardless of network origin.</p>
    <p><strong>Enforcement layers in this platform:</strong></p>
    <ul>
      <li><strong>Layer 1 — Edge</strong>: Front Door WAF blocks OWASP Top 10 threats, DDoS, and malformed requests before they reach APIM.</li>
      <li><strong>Layer 2 — Gateway</strong>: APIM validates JWT signature, checks expiry, verifies audience/issuer, enforces RBAC per API product, rate-limits per subscription.</li>
      <li><strong>Layer 3 — Facade</strong>: re-validates claims, checks resource ownership (ABAC), enforces idempotency keys.</li>
      <li><strong>Layer 4 — Platform</strong>: Consent Gate checks consent records before every registry call. SEC component applies ABAC ownership rules. No registry is ever called without a valid consent scope.</li>
      <li><strong>Layer 5 — Data</strong>: all data stores accessible only via Private Endpoints within the VNet. No public endpoints. Managed Identity used for all service-to-service authentication — no stored credentials.</li>
    </ul>
    <p><span class="faq-ref">RFP-REQ-03</span><span class="faq-ref">RFP-REQ-07</span></p>
  `},
  { cat:'Security & Identity', q:'What is ACR (Authentication Context Class Reference)?', a:`
    <p><strong>ACR</strong> is an OIDC claim that conveys the assurance level of the authentication event. In this platform:</p>
    <ul>
      <li><code>acr=1</code>: username/password or low-assurance eID.</li>
      <li><code>acr=2</code>: strong eID (e.g. DigiD Midden) — required for financial or sensitive operations.</li>
      <li><code>acr=3</code>: strong hardware token (e.g. DigiD Hoog) — required for high-value or legal operations.</li>
    </ul>
    <p>The Claims Mapper component reads the ACR from the incoming JWT and rejects or triggers a <strong>step-up re-authentication</strong> if the ACR is below the threshold required by the specific API operation. This is declared in APIM policy and enforced at the Facade layer.</p>
    <p><span class="faq-ref">RFP-REQ-03</span></p>
  `},
  { cat:'Security & Identity', q:'How are webhook callbacks secured?', a:`
    <p>Webhooks (eSign completion, payment confirmation, registry change events) are secured by three mechanisms:</p>
    <ul>
      <li><strong>JWS/HMAC signature</strong>: provider signs the payload with a shared secret stored in Azure Key Vault. Platform verifies signature before processing.</li>
      <li><strong>IP allowlist</strong>: APIM policy restricts webhook ingress to provider-declared IP ranges. Unknown origins receive 403.</li>
      <li><strong>Timestamp + nonce</strong>: payload includes a timestamp (±5 min tolerance) and nonce. Platform rejects replayed payloads using a Redis nonce store.</li>
    </ul>
    <p>All webhook secrets are stored in <strong>Azure Key Vault</strong> and accessed by microservices via <strong>Managed Identity</strong> — no secrets in environment variables or config files.</p>
    <p><span class="faq-ref">RFP-REQ-03</span><span class="faq-ref">RFP-REQ-04</span></p>
  `},
  // ── DATA
  { cat:'Data & Privacy', q:'How does the Consent Service enforce GDPR?', a:`
    <p>The <strong>Consent Service</strong> implements four GDPR principles:</p>
    <ul>
      <li><strong>Purpose limitation</strong>: each consent is bound to a specific purpose (e.g. <code>address.prefill.for.permit</code>). The Orchestrator cannot request data for a different purpose without a new consent.</li>
      <li><strong>Data minimisation</strong>: scopes determine exactly which fields are returned. A consent for address prefill cannot return financial data.</li>
      <li><strong>Expiry</strong>: consents have a TTL (configurable per service type). The service prompts renewal before expiry.</li>
      <li><strong>Immutable receipts</strong>: every consent grant, denial, and withdrawal creates a <strong>JWS-signed receipt</strong> written to WORM blob storage. Tamper-evident; legally admissible audit trail.</li>
    </ul>
    <p>The Consent Gate in the SEC component checks <strong>before every adapter call</strong>. If consent has expired or is missing for the requested scope, the call returns a structured <code>403 consent_required</code> error rather than silently failing or proceeding.</p>
    <p><span class="faq-ref">RFP-REQ-03</span><span class="faq-ref">RFP-REQ-07</span></p>
  `},
  { cat:'Data & Privacy', q:'What is the Medallion Architecture (Bronze / Silver / Gold)?', a:`
    <p>The <strong>Medallion Architecture</strong> is a data engineering pattern that organises data into progressive quality layers:</p>
    <ul>
      <li><strong>Bronze (Raw)</strong>: append-only landing of all raw events from CDC (Debezium), Cosmos Change Feed, and Event Hubs. Zero transformation — full provenance and lineage. Schema-on-read.</li>
      <li><strong>Silver (Cleansed)</strong>: de-duplicated, type-normalised, PII-redacted records. Business keys resolved. Spark jobs run incremental <code>MERGE</code> operations on Delta Lake tables. Schema-on-write.</li>
      <li><strong>Gold (Curated)</strong>: dimensional models (star/snowflake schema), KPI aggregations, SLO metrics, MDM quality dashboards. Optimised for BI queries via Fabric Warehouse Direct Lake.</li>
    </ul>
    <p>All layers live in <strong>Fabric OneLake</strong> (ADLS Gen2 under the hood) as Delta Lake tables. <strong>Microsoft Purview</strong> scans all layers for lineage, PII classification, and access governance.</p>
    <p><span class="faq-ref">RFP-REQ-05</span><span class="faq-ref">RFP-REQ-06</span></p>
  `},
  { cat:'Data & Privacy', q:'How is PII (personally identifiable information) handled in the lakehouse?', a:`
    <p>PII handling follows a <strong>tiered redaction strategy</strong>:</p>
    <ul>
      <li><strong>Bronze</strong>: contains raw PII — access restricted to platform data engineers via Entra ID POSIX ACLs on OneLake. No BI tools can access Bronze directly.</li>
      <li><strong>Silver</strong>: Spark jobs apply <strong>PII detection</strong> (Presidio or custom rules) and <strong>redact/tokenise</strong> fields such as NIN, full name, date of birth. The tokenised reference is preserved for join operations.</li>
      <li><strong>Gold</strong>: fully aggregated or pseudonymised. Individual records accessible only to authorised roles via <strong>Row-Level Security</strong> in Fabric Warehouse.</li>
    </ul>
    <p><strong>Purview</strong> auto-classifies columns containing PII patterns and triggers a data governance alert if unredacted PII is detected in Gold or Fabric Warehouse.</p>
    <p><span class="faq-ref">RFP-REQ-07</span></p>
  `},
  { cat:'Data & Privacy', q:'What is CDC (Change Data Capture) and why is it used?', a:`
    <p><strong>CDC</strong> captures every INSERT, UPDATE, DELETE from a database in real-time without requiring application-level instrumentation. It enables the lakehouse to stay in sync with the OLTP layer without expensive full-table scans.</p>
    <ul>
      <li><strong>PostgreSQL</strong>: Debezium reads the Write-Ahead Log (WAL). Each change is streamed to Azure Event Hubs, then landed in Bronze as a Delta Lake record.</li>
      <li><strong>Cosmos DB</strong>: the Change Feed is an append-only log of all Cosmos DB mutations. Azure Functions (triggered by the Change Feed) route records to Bronze.</li>
    </ul>
    <p>Benefits: near-real-time data freshness in the lakehouse (&lt;5 min lag), no additional load on OLTP (WAL is already produced by PostgreSQL), full historical replay by replaying the Bronze log.</p>
    <p><span class="faq-ref">RFP-REQ-05</span></p>
  `},
  // ── CLOUD / INFRA
  { cat:'Cloud & Infrastructure', q:'What is Azure APIM Premium and why is it needed?', a:`
    <p><strong>Azure API Management Premium</strong> is a fully managed API gateway offering enterprise features:</p>
    <ul>
      <li><strong>VNet integration</strong>: APIM deployed in external gateway mode on the Edge subnet, with backend calls going to Container Apps via internal VNet ingress.</li>
      <li><strong>JWT validation policy</strong>: validates RS256/ES256 signatures against the eID IdP's JWKS endpoint on every inbound request.</li>
      <li><strong>Products & subscriptions</strong>: API products group operations (Citizen Portal, Partner, Admin) with per-subscription rate limits and quotas.</li>
      <li><strong>Webhook allowlists</strong>: IP filtering policies restrict provider callback endpoints to declared IP ranges.</li>
      <li><strong>Multi-region</strong>: Premium supports deployment units in multiple Azure regions — Region A (primary) and Region B (DR standby).</li>
    </ul>
    <p>Without APIM Premium, the VNet integration capability is not available, which is required for private backend connectivity.</p>
    <p><span class="faq-ref">RFP-REQ-03</span><span class="faq-ref">RFP-REQ-04</span><span class="faq-ref">RFP-REQ-11</span></p>
  `},
  { cat:'Cloud & Infrastructure', q:'Why Azure Container Apps instead of AKS?', a:`
    <p><strong>Azure Container Apps (ACA)</strong> provides a fully managed serverless container runtime built on Kubernetes and KEDA, without requiring cluster management:</p>
    <ul>
      <li><strong>No node management</strong>: ACA abstracts Kubernetes node pools. The team focuses on application code, not cluster upgrades.</li>
      <li><strong>KEDA autoscaling</strong>: scales to zero on idle, scales out on Service Bus queue depth, HTTP concurrency, or CPU — all configurable per service.</li>
      <li><strong>Zonal redundancy</strong>: ACA Environment can be deployed zone-redundant (3 availability zones) in a single region.</li>
      <li><strong>Internal ingress</strong>: microservices expose internal-only ingress — no public endpoints. Only the Facade has external-facing access via APIM.</li>
    </ul>
    <p>AKS would be appropriate if the team needed direct Kubernetes API access, custom node configurations, or GPU workloads. For this platform's workload profile, ACA is operationally simpler and more cost-efficient.</p>
    <p><span class="faq-ref">RFP-REQ-09</span><span class="faq-ref">RFP-REQ-11</span></p>
  `},
  { cat:'Cloud & Infrastructure', q:'What is RPO and RTO and how does the platform achieve them?', a:`
    <p><strong>RPO (Recovery Point Objective)</strong> is the maximum acceptable data loss in time. The platform targets <strong>RPO ≤ 5 minutes</strong>.</p>
    <p><strong>RTO (Recovery Time Objective)</strong> is the maximum acceptable downtime. The platform targets <strong>RTO ≤ 60 minutes</strong>.</p>
    <p><strong>How RPO ≤ 5 min is achieved:</strong></p>
    <ul>
      <li>PostgreSQL Flexible Server: streaming replication to a cross-region read replica (Region B). Replication lag monitored; alert if &gt;3 min.</li>
      <li>Cosmos DB: multi-region writes with automatic failover — any committed write is synchronously replicated to Region B.</li>
      <li>Service Bus Premium: geo-paired namespace with metadata synchronisation.</li>
      <li>Blob Storage: GRS (Geo-Redundant Storage) replicates to Region B pair within 15 min; RA-GRS allows read access during failover.</li>
    </ul>
    <p><strong>How RTO ≤ 60 min is achieved:</strong></p>
    <ul>
      <li>Front Door health probes detect Region A failure within 2 min and route traffic to Region B (APIM standby).</li>
      <li>DR runbooks define step-by-step procedures to promote PostgreSQL replica, reconnect Service Bus, verify data store health.</li>
      <li>Pre-warmed Region B Container Apps environments (zero replicas, scale to min=1 on DR trigger).</li>
    </ul>
    <p><span class="faq-ref">RFP-REQ-11</span></p>
  `},
  { cat:'Cloud & Infrastructure', q:'What is Zone-Redundancy (ZRS) and why does it matter?', a:`
    <p><strong>Zone-Redundancy (ZRS)</strong> means data and compute are replicated across three separate <strong>Availability Zones</strong> within a single Azure region. Each zone is a physically isolated datacenter with independent power, cooling, and networking.</p>
    <p>If one zone fails (power outage, fire, hardware failure), the service continues on the remaining two zones with <strong>zero downtime and zero data loss</strong> — RPO=0 for zonal failures.</p>
    <p><strong>ZRS-enabled services in this platform:</strong></p>
    <ul>
      <li>Azure PostgreSQL Flexible Server (ZRS): three synchronous replicas across zones.</li>
      <li>Azure Blob Storage (ZRS): three copies of every blob object across zones.</li>
      <li>Azure Container Apps Environment: zone-redundant placement of replicas.</li>
      <li>Azure Service Bus Premium: partition replicas spread across zones.</li>
    </ul>
    <p>ZRS is distinct from <strong>geo-redundancy (GRS/geo-replication)</strong>, which protects against full region failures but has a different cost/latency profile.</p>
    <p><span class="faq-ref">RFP-REQ-11</span></p>
  `},
  { cat:'Cloud & Infrastructure', q:'What is WORM storage and why is it required for audit?', a:`
    <p><strong>WORM (Write Once, Read Many)</strong> is an immutability policy on Azure Blob Storage that prevents modification or deletion of stored objects for a specified retention period.</p>
    <p><strong>Why it's required:</strong></p>
    <ul>
      <li>Legal and regulatory compliance demands that consent records, audit events, and signed receipts cannot be altered or deleted — even by administrators.</li>
      <li>In the event of a security incident or legal dispute, WORM blobs provide a <strong>tamper-evident chain of custody</strong>.</li>
      <li>WORM policies can be set to <strong>time-based retention</strong> (e.g. 7 years) or <strong>legal hold</strong> (indefinite, until explicitly removed by authorised personnel).</li>
    </ul>
    <p><strong>Implementation:</strong> every consent event, key management operation, and data access creates a <strong>JWS-signed JSON receipt</strong> written to an immutability-enabled blob container. The platform key used for signing is managed by Azure Key Vault with HSM-backed key storage.</p>
    <p><span class="faq-ref">RFP-REQ-07</span></p>
  `},
  // ── OBSERVABILITY
  { cat:'Observability & SLOs', q:'What are SLOs and how are they monitored?', a:`
    <p><strong>SLO (Service Level Objective)</strong> is a target reliability metric agreed with stakeholders. If SLOs are consistently met, the service is considered reliable. SLOs are derived from SLIs (Service Level Indicators).</p>
    <p><strong>Platform SLOs:</strong></p>
    <ul>
      <li>API P95 latency ≤ 600ms (end-to-end, cache hit)</li>
      <li>MDM cache hit-rate ≥ 80%</li>
      <li>Consent-gate violations = 0</li>
      <li>Service availability ≥ 99.9% (monthly)</li>
      <li>DLQ message age ≤ 4 hours before alert</li>
    </ul>
    <p><strong>Monitoring stack:</strong></p>
    <ul>
      <li><strong>Azure Application Insights</strong>: distributed tracing, request/dependency telemetry, custom SLI metrics.</li>
      <li><strong>Log Analytics Workspace</strong>: centralised structured logs from all services. All logs are PII-stripped before ingestion.</li>
      <li><strong>KQL (Kusto Query Language)</strong>: SLO dashboard queries. Example: <code>requests | where duration &gt; 600 | summarize count()</code>.</li>
      <li><strong>Burn-rate alerts</strong>: Azure Monitor alerts fire when the error budget is being consumed too fast (multi-window, multi-burn-rate alerting per Google SRE Book).</li>
    </ul>
    <p><span class="faq-ref">RFP-REQ-09</span></p>
  `},
  { cat:'Observability & SLOs', q:'What does Microsoft Sentinel do in this platform?', a:`
    <p><strong>Microsoft Sentinel</strong> is a cloud-native SIEM (Security Information and Event Management) and SOAR (Security Orchestration, Automation, and Response) platform built on Log Analytics.</p>
    <p><strong>Role in this platform:</strong></p>
    <ul>
      <li><strong>Analytics rules</strong>: KQL-based detection rules for anomalous authentication patterns (e.g. impossible travel, brute force, unusual API call volumes).</li>
      <li><strong>Security incidents</strong>: automatically groups related alerts into incidents with severity scores.</li>
      <li><strong>Threat hunting</strong>: security engineers can run ad-hoc KQL queries across all ingested logs (APIM access logs, Container Apps logs, Key Vault audit).</li>
      <li><strong>SOAR playbooks</strong>: Logic Apps-based automated responses — e.g. automatically blocking an IP in Front Door WAF when a brute-force incident is raised.</li>
    </ul>
    <p><span class="faq-ref">RFP-REQ-10</span></p>
  `},
  // ── RFP
  { cat:'RFP & Compliance', q:'What are the 11 RFP requirements and how are all met?', a:`
    <p>The platform addresses all 11 RFP requirements:</p>
    <ul>
      <li><strong>REQ-01 Multi-channel portal</strong>: Portal serves web, mobile, kiosk. Schema-driven forms, EN/NL, WCAG 2.1 AA.</li>
      <li><strong>REQ-02 Six registry interoperability</strong>: Facade + Orchestrator + 6 Adapters (Civil, Address, Business, License, Tax, Land). All via Canonical DTO — no point-to-point.</li>
      <li><strong>REQ-03 Security (OIDC, RBAC, TLS)</strong>: OIDC+PKCE, JWT RS256/ES256, RBAC at APIM/Facade/Platform, ACR step-up, TLS 1.2+ everywhere, zero-trust boundaries.</li>
      <li><strong>REQ-04 API-first, versioned</strong>: OpenAPI 3.1, /v1…/v2 Facade contracts, Deprecation/Sunset headers, APIM products.</li>
      <li><strong>REQ-05 Data management, Once-Only</strong>: MDM Redis ETag/TTL, CDC to Delta Lake, Purview governance, WORM audit lineage.</li>
      <li><strong>REQ-06 Documents, eSign, Payments, BI</strong>: Blob pre-sign + AV scan, eSign API webhooks, PSP payment sessions, Fabric Warehouse + Power BI RLS dashboards.</li>
      <li><strong>REQ-07 Privacy, consent, audit</strong>: Consent Service (purpose/scope/expiry), WORM + JWS receipts, Purview classification, consent-gate enforced on every adapter call.</li>
      <li><strong>REQ-08 Event-driven</strong>: Service Bus Premium (topics, queues, DLQ), Event Grid (domain fan-out), saga choreography, retry + DLQ runbooks.</li>
      <li><strong>REQ-09 Observability, SLOs</strong>: App Insights + Log Analytics + KQL dashboards + burn-rate alerts, PII-free logs.</li>
      <li><strong>REQ-10 SecOps, threat detection</strong>: Microsoft Sentinel SIEM, analytic rules, SOAR Logic Apps playbooks, Key Vault audit.</li>
      <li><strong>REQ-11 HA & DR</strong>: ZRS + multi-region + Front Door failover + PITR + Cosmos multi-region writes + geo-pairs + RPO ≤5 min / RTO ≤60 min.</li>
    </ul>
  `},
  { cat:'RFP & Compliance', q:'What does NFR-16 and NFR-25 require?', a:`
    <p><strong>NFR-16 (Performance — Cache Hit Rate)</strong>: the MDM once-only cache must achieve a hit-rate of <strong>≥80%</strong> for prefill operations in the steady state. This is measured per 24-hour window on the Power BI SLO dashboard. If hit-rate drops below 80%, a P2 alert fires to the on-call team.</p>
    <p><strong>NFR-25 (Staleness)</strong>: cached MDM snapshots must not contain stale fields for more than <strong>2% of prefill operations</strong>. Staleness is detected by comparing the cached snapshot ETag against the latest SoR event timestamp. Event-driven invalidation (via Event Grid) ensures near-real-time freshness for high-churn fields (address, status).</p>
    <p>Both NFRs are tracked in the Gold layer of the lakehouse and surfaced on the operational Power BI dashboard visible to the technical committee and SLA owners.</p>
    <p><span class="faq-ref">NFR-16</span><span class="faq-ref">NFR-25</span><span class="faq-ref">RFP-REQ-05</span></p>
  `},
  { cat:'RFP & Compliance', q:'How is WCAG 2.1 AA compliance ensured for the portal?', a:`
    <p><strong>WCAG 2.1 AA (Web Content Accessibility Guidelines)</strong> is the international standard for web accessibility. Level AA is the legally mandated baseline in most EU jurisdictions.</p>
    <p><strong>Implementation in the Portal:</strong></p>
    <ul>
      <li><strong>Perceivable</strong>: all images have alt text; colour contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text; captions for video content.</li>
      <li><strong>Operable</strong>: all interactions keyboard-navigable; no keyboard traps; focus indicators visible; skip-to-main-content link.</li>
      <li><strong>Understandable</strong>: forms have explicit labels and inline error messages (not just colour); language declared (<code>lang="en"</code> / <code>lang="nl"</code>).</li>
      <li><strong>Robust</strong>: semantic HTML5 elements; ARIA roles where native semantics insufficient; compatible with major screen readers (NVDA, JAWS, VoiceOver).</li>
    </ul>
    <p>Automated testing via <strong>axe-core</strong> in CI/CD pipeline. Manual testing with screen reader before each major release. Accessibility statement published on the portal.</p>
    <p><span class="faq-ref">RFP-REQ-01</span></p>
  `}
];

function initFAQ() {
  const container = document.getElementById('faq-list');
  if (!container) return;

  const cats = [...new Set(FAQS.map(f=>f.cat))];
  let html = '';
  cats.forEach(cat => {
    html += `<div class="faq-category-title">${cat}</div>`;
    FAQS.filter(f=>f.cat===cat).forEach((f,fi) => {
      const idx = FAQS.indexOf(f);
      html += `
        <div class="faq-item" data-idx="${idx}">
          <div class="faq-q">
            <span>${f.q}</span>
            <span class="faq-chevron">▼</span>
          </div>
          <div class="faq-a">${f.a}</div>
        </div>`;
    });
  });
  container.innerHTML = html;

  container.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      item.classList.toggle('open');
    });
  });

  // Search
  const search = document.getElementById('faq-search');
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      container.querySelectorAll('.faq-item').forEach(item => {
        const idx = parseInt(item.dataset.idx);
        const f = FAQS[idx];
        const match = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q);
        item.style.display = match ? '' : 'none';
      });
      container.querySelectorAll('.faq-category-title').forEach(title => {
        // show/hide category headers
        let next = title.nextElementSibling;
        let anyVisible = false;
        while (next && !next.classList.contains('faq-category-title')) {
          if (next.style.display !== 'none') anyVisible = true;
          next = next.nextElementSibling;
        }
        title.style.display = anyVisible ? '' : 'none';
      });
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GLOSSARY
// ══════════════════════════════════════════════════════════════════════════════
const GLOSSARY = [
  // A
  { term:'ABAC', abbr:'ABAC', cat:'Security', def:'Attribute-Based Access Control. An access control model where decisions are based on attributes of the user, resource, environment, and action — not just roles. Used in this platform for resource ownership checks (e.g. a citizen can only access their own data).', where:'SEC component, Facade, Claims Mapper' },
  { term:'ACR', abbr:'ACR', cat:'Identity', def:'Authentication Context Class Reference. An OIDC claim indicating the assurance level of the authentication event (e.g. acr=1 basic, acr=2 strong eID, acr=3 hardware token). Operations requiring high assurance trigger a step-up authentication flow.', where:'eID IdP, Claims Mapper, APIM policy' },
  { term:'ADLS Gen2', abbr:'ADLS Gen2', cat:'Storage', def:'Azure Data Lake Storage Gen2. Built on Azure Blob Storage with a hierarchical namespace (POSIX-style ACLs), optimised for analytics workloads. Underpins Fabric OneLake in this platform.', where:'Fabric OneLake, Bronze/Silver/Gold layers' },
  { term:'APIM', abbr:'APIM', cat:'Gateway', def:'Azure API Management. A fully managed API gateway service providing JWT validation, RBAC, rate limiting, products/subscriptions, VNet integration, developer portal, and webhook IP allowlisting. Deployed as Premium SKU for VNet and multi-region support.', where:'API Gateway layer, Region A & B' },
  { term:'API Facade', cat:'Architecture', def:'A design pattern (also called API Gateway or BFF) that presents a stable, versioned interface to consumers while hiding backend complexity. The Facade in this platform provides /v1…/v2 URIs, idempotency-key enforcement, and canonical error responses regardless of internal orchestration changes.', where:'API Facade layer' },
  { term:'Authorization Code Flow', cat:'Identity', def:'The OAuth 2.0 flow for server-side and public clients. Client obtains an authorisation code, exchanges it for tokens at the token endpoint. Always used with PKCE in this platform to prevent code interception.', where:'Portal, eID IdP' },
  { term:'Availability Zone', abbr:'AZ', cat:'Infrastructure', def:'A physically separate datacenter within an Azure region, with independent power, cooling, and networking. Services deployed across multiple AZs (Zone-Redundant) survive single-zone failures with zero downtime.', where:'All Region A services' },
  // B
  { term:'Bearer Token', cat:'Identity', def:'An access token transmitted in the HTTP Authorization header (<code>Authorization: Bearer &lt;token&gt;</code>). The token is self-contained (JWT) — the holder can present it to any service that trusts the issuer. Short-lived (≤15 min) in this platform.', where:'Portal → APIM, all API calls' },
  { term:'Bronze Layer', cat:'Data', def:'The first layer of the Medallion data architecture. Contains raw, unprocessed change events from CDC sources. Append-only, full provenance preserved. Serves as the source of truth for replay and historical reprocessing.', where:'Delta Lake, Fabric OneLake' },
  // C
  { term:'Canonical DTO', cat:'Architecture', def:'A Data Transfer Object (DTO) that uses a standardised, normalised schema agreed across all adapters. Each registry adapter maps its own proprietary response to the Canonical DTO, so the Orchestrator always receives a uniform data model regardless of which registry was called.', where:'All 6 Registry Adapters, Mapping & Validation, MDM Cache' },
  { term:'CDC', abbr:'CDC', cat:'Data', def:'Change Data Capture. A technique for detecting and capturing changes (INSERT, UPDATE, DELETE) in a source database and streaming them to downstream systems in near-real-time, without polling. Enables the lakehouse to stay in sync with OLTP. PostgreSQL CDC uses Debezium reading the WAL; Cosmos DB uses the Change Feed.', where:'Debezium, Cosmos Change Feed, Event Hubs, Bronze' },
  { term:'Circuit Breaker', cat:'Resilience', def:'A resilience pattern that stops sending requests to a failing downstream service after a threshold of consecutive failures, allowing the service to recover. In this platform, all registry adapters implement circuit breakers with exponential back-off retry before opening the circuit.', where:'All 6 Registry Adapters, Orchestrator' },
  { term:'Consent Gate', cat:'Privacy', def:'A mandatory enforcement point in the Orchestrator / SEC component that checks whether valid, in-scope consent exists before any external registry call. If consent is absent, expired, or out of scope, the call is blocked and a structured 403 error is returned. Zero consent violations is a platform SLO.', where:'SEC component, Consent Service' },
  { term:'Cosmos DB Change Feed', cat:'Data', def:'An ordered, append-only log of all inserts and updates in an Azure Cosmos DB container. Consumers can read the Change Feed in real-time or replay from any point. In this platform, Azure Functions trigger on the Change Feed to route mutations to Bronze Delta Lake.', where:'Cosmos DB, Change Feed Functions, Bronze' },
  // D
  { term:'Dead Letter Queue', abbr:'DLQ', cat:'Messaging', def:'A special queue in Service Bus that receives messages which could not be processed after the maximum delivery count (e.g. 5 retries). Engineers inspect DLQ messages, correct the root cause, and re-drive them. DLQ message age is monitored as a platform SLO.', where:'Azure Service Bus Premium, DLQ component' },
  { term:'Debezium', cat:'Data', def:'An open-source CDC connector that reads the PostgreSQL Write-Ahead Log (WAL) and streams change events to Kafka-compatible sinks (Azure Event Hubs in this platform). Deployed as a Container App with a managed replication slot.', where:'Ingestion layer, PostgreSQL CDC path' },
  { term:'Delta Lake', cat:'Data', def:'An open-source storage format built on Parquet that adds ACID transactions, time travel (historical versions), schema enforcement, and scalable metadata to data lakes. Used for all three Medallion layers (Bronze/Silver/Gold) in Fabric OneLake.', where:'Bronze, Silver, Gold, Fabric OneLake' },
  { term:'Direct Lake', cat:'Analytics', def:'A Power BI / Fabric feature that reads Delta Lake files directly from OneLake without copying data into a columnar import model. Provides fast query performance with real-time data freshness, replacing the Import and DirectQuery modes.', where:'Fabric Warehouse, Power BI' },
  { term:'DLQ', abbr:'DLQ', cat:'Messaging', def:'See Dead Letter Queue.', where:'Azure Service Bus' },
  { term:'DTO', abbr:'DTO', cat:'Architecture', def:'Data Transfer Object. A simple data container passed between service layers or across service boundaries. In this platform, the Canonical DTO is the normalised schema used between the Adapters and the Interop Platform core.', where:'All Adapters, Mapping & Validation' },
  // E
  { term:'ETag', cat:'HTTP / Caching', def:'Entity Tag. An HTTP cache-validation mechanism. A server assigns an opaque identifier (ETag) to a resource version. The client re-sends the ETag in <code>If-None-Match</code>. If the resource hasn\'t changed, the server returns 304 Not Modified (no body). Used by the MDM cache to avoid redundant registry fetches.', where:'MDM Redis Cache, Orchestrator' },
  { term:'Event Grid', cat:'Messaging', def:'Azure Event Grid. A fully managed event routing service for fan-out scenarios. Delivers events from sources (registry SoR changes, Blob Storage, Service Bus) to multiple handlers (Azure Functions, webhooks, Logic Apps) in near-real-time with at-least-once delivery.', where:'Event Backbone, MDM invalidation, analytics triggers' },
  // F
  { term:'Facade', cat:'Architecture', def:'See API Facade.', where:'API Facade layer' },
  { term:'Front Door', cat:'Networking', def:'Azure Front Door Premium. A global Layer 7 load balancer and CDN with built-in WAF. Provides TLS termination, OWASP managed rule sets, DDoS protection, health probes for DR failover, and routing to regional APIM origins. The first line of defence for all inbound traffic.', where:'Edge layer' },
  // G
  { term:'Gold Layer', cat:'Data', def:'The third and final layer of the Medallion architecture. Contains curated, aggregated, BI-ready data models (star/snowflake schemas, KPI aggregations). Serves Fabric Warehouse via Direct Lake and powers Power BI dashboards.', where:'Delta Lake, Fabric OneLake, Fabric Warehouse' },
  { term:'GRS', abbr:'GRS', cat:'Storage', def:'Geo-Redundant Storage. Azure Blob Storage replication to a paired secondary region (typically hundreds of km away). Provides protection against full region failures. RA-GRS (Read-Access GRS) additionally allows reading from the secondary replica during failover.', where:'Blob Storage WORM Audit, DR path' },
  // H
  { term:'HMAC', abbr:'HMAC', cat:'Security', def:'Hash-based Message Authentication Code. A keyed-hash signature used to verify the integrity and authenticity of a message. In this platform, webhook payloads from external providers (eSign, PSP) are signed with HMAC-SHA256 using a shared secret stored in Key Vault.', where:'Webhook security, eSign Provider, Payment Gateway' },
  { term:'HttpOnly Cookie', cat:'Security', def:'A browser cookie with the <code>HttpOnly</code> flag set, which prevents JavaScript from reading it. Used for storing refresh tokens in the Portal — malicious scripts injected via XSS cannot steal the token.', where:'Portal session management' },
  // I
  { term:'Idempotency Key', cat:'API Design', def:'A client-provided unique identifier (<code>Idempotency-Key</code> header) that allows safe retry of non-idempotent operations. If the server has already processed a request with the same key, it returns the original response without re-executing the operation. Critical for payment and submission endpoints.', where:'API Facade, Payment Gateway' },
  // J
  { term:'JWS', abbr:'JWS', cat:'Security', def:'JSON Web Signature. A standard for representing cryptographically signed content as a compact, URL-safe string. Used in this platform to create signed audit receipts and consent records, providing tamper-evidence for WORM storage.', where:'Audit Evidence store, Consent Service, webhook callbacks' },
  { term:'JWT', abbr:'JWT', cat:'Identity', def:'JSON Web Token. A compact, self-contained token format for securely transmitting claims as a JSON object, signed with RS256 or ES256. Contains sub (subject), exp (expiry), aud (audience), iss (issuer), and custom claims (roles, ACR, scopes). Validated by APIM on every API call.', where:'eID IdP, APIM, Facade, Claims Mapper' },
  { term:'JWKS', abbr:'JWKS', cat:'Identity', def:'JSON Web Key Set. A published endpoint exposing the public keys used to verify JWT signatures. APIM fetches the JWKS from the eID IdP on startup (and periodically) to validate incoming tokens without a live call to the IdP.', where:'eID IdP, APIM validation policy' },
  // K
  { term:'KEDA', abbr:'KEDA', cat:'Infrastructure', def:'Kubernetes Event-Driven Autoscaling. A CNCF project that autoscales workloads based on external event sources (Service Bus queue depth, Event Hubs consumer lag, HTTP request rate, CPU). Used by Azure Container Apps to scale microservices precisely to demand, including scale-to-zero.', where:'All Container Apps microservices' },
  { term:'Key Vault', cat:'Security', def:'Azure Key Vault. A managed secrets and key management service. Stores webhook signing secrets, provider API keys, TLS certificates, and platform encryption keys. Accessed by services via Managed Identity — no credentials in application configuration.', where:'All microservices, APIM, Key management' },
  { term:'KQL', abbr:'KQL', cat:'Observability', def:'Kusto Query Language. A read-only query language used to query Azure Log Analytics, Application Insights, and Microsoft Sentinel. Used in this platform for SLO dashboard queries, burn-rate alerting rules, and security analytics in Sentinel.', where:'Log Analytics, App Insights, Sentinel' },
  // M
  { term:'Managed Identity', cat:'Security', def:'An Azure Entra ID identity automatically created for an Azure resource (VM, Container App, APIM, Function). Services authenticate to other Azure services (Key Vault, Storage, Cosmos DB) using their Managed Identity — eliminating the need for stored credentials or connection strings.', where:'All Azure services' },
  { term:'MDM Cache', abbr:'MDM', cat:'Architecture', def:'Master Data Management Cache. In this platform, the Redis Enterprise-backed component that stores canonical citizen/business data snapshots with ETag and TTL. Implements the Once-Only Principle by allowing the Portal to prefill forms with verified registry data without re-fetching from source registries on every request.', where:'Redis Enterprise, Orchestrator, Portal prefill' },
  { term:'Medallion Architecture', cat:'Data', def:'A data engineering pattern organising data into Bronze (raw), Silver (cleansed), and Gold (curated) layers in a data lake or lakehouse. Each layer progressively increases data quality, trust, and business readiness. Used in this platform\'s Fabric OneLake.', where:'Fabric OneLake, all Delta Lake layers' },
  // O
  { term:'OIDC', abbr:'OIDC', cat:'Identity', def:'OpenID Connect. An identity layer built on top of OAuth 2.0 that adds a standardised ID Token (JWT containing user identity claims) to the authorisation flow. Used by the Portal to authenticate citizens against the national eID IdP.', where:'Portal, eID IdP, Claims Mapper' },
  { term:'Once-Only Principle', abbr:'OOP', cat:'Architecture', def:'A government digital service principle that citizens and businesses should only need to submit data once. The government reuses data it already holds (with consent) to prefill forms and services. Implemented in this platform via the MDM Cache with ETag/TTL and event-driven invalidation.', where:'MDM Cache, Consent Service, Portal prefill' },
  { term:'OpenAPI', cat:'API Design', def:'OpenAPI Specification (formerly Swagger). A standard, language-agnostic interface description for REST APIs. The Facade publishes OpenAPI 3.1 specs for all /v1 and /v2 operations. Consumers use the spec to generate client SDKs and validate requests.', where:'API Facade, APIM developer portal' },
  // P
  { term:'PKCE', abbr:'PKCE', cat:'Identity', def:'Proof Key for Code Exchange (pronounced "pixy"). An OAuth 2.0 extension that prevents authorisation code interception attacks in public clients. The client generates a random code_verifier, computes code_challenge = SHA-256(verifier), and sends the challenge with /authorize. The verifier is sent at /token. The server verifies SHA-256(verifier) = challenge.', where:'Portal, eID IdP' },
  { term:'Private Endpoint', cat:'Networking', def:'An Azure network interface that connects a service (PostgreSQL, Cosmos DB, Key Vault, Blob) to a Virtual Network using a private IP address. Traffic between the service and the VNet never leaves the Azure backbone — no public internet exposure for data stores.', where:'All data stores in Region A' },
  { term:'Purview', cat:'Data Governance', def:'Microsoft Purview. A unified data governance service providing automated data discovery, lineage tracking, PII/sensitivity classification, and access governance across all data stores. In this platform, Purview scans OneLake, PostgreSQL, and Cosmos DB, builds an automated lineage graph, and alerts on unredacted PII in analytical layers.', where:'Analytics layer, Fabric OneLake, all data stores' },
  // R
  { term:'RBAC', abbr:'RBAC', cat:'Security', def:'Role-Based Access Control. An access control model where permissions are assigned to roles, and users are assigned to roles. In this platform, RBAC is enforced at three layers: APIM (API products/subscriptions), Facade (resource-level roles), and Fabric Warehouse (Row-Level Security per department).', where:'APIM, Facade, Claims Mapper, Fabric Warehouse' },
  { term:'RPO', abbr:'RPO', cat:'Resilience', def:'Recovery Point Objective. The maximum acceptable amount of data loss measured in time. This platform targets RPO ≤ 5 minutes, achieved via streaming replication (PostgreSQL), multi-region writes (Cosmos DB), and geo-redundant storage (Blob GRS).', where:'DR architecture, Region B' },
  { term:'RTO', abbr:'RTO', cat:'Resilience', def:'Recovery Time Objective. The maximum acceptable downtime after a failure. This platform targets RTO ≤ 60 minutes, achieved via Front Door automatic failover, pre-warmed Region B environments, and detailed DR runbooks.', where:'DR architecture, Region B, Front Door' },
  { term:'Row-Level Security', abbr:'RLS', cat:'Data', def:'A database/BI feature that restricts which rows a user can see based on their identity. In this platform, Fabric Warehouse and Power BI use RLS to ensure a department manager only sees their department\'s operational data, while a platform admin can see all.', where:'Fabric Warehouse, Power BI' },
  // S
  { term:'Saga Pattern', cat:'Architecture', def:'A pattern for managing distributed transactions across microservices. A saga is a sequence of local transactions, each publishing events/commands to trigger the next step. If a step fails, compensating transactions undo previous steps. The Orchestrator in this platform uses sagas to coordinate consent, adapter calls, document upload, payment, and case submission.', where:'Orchestrator (Controller)' },
  { term:'Sentinel', cat:'Security', def:'Microsoft Sentinel. A cloud-native SIEM/SOAR platform. See Microsoft Sentinel in the FAQ for full detail.', where:'Observability & SecOps layer' },
  { term:'Service Bus', cat:'Messaging', def:'Azure Service Bus. A fully managed enterprise messaging service providing queues (point-to-point) and topics (publish/subscribe). Premium SKU supports partitioned entities, message sessions (ordered processing), geo-disaster recovery pairing, and Private Endpoints.', where:'Event Backbone, Orchestrator, DLQ' },
  { term:'Silver Layer', cat:'Data', def:'The second layer of the Medallion architecture. Contains cleansed, de-duplicated, type-normalised, and PII-redacted data derived from Bronze. Incrementally maintained by Spark MERGE operations. Serves as the foundation for Gold layer aggregations.', where:'Delta Lake, Fabric OneLake' },
  { term:'SLI', abbr:'SLI', cat:'Observability', def:'Service Level Indicator. A quantitative measure of some aspect of service behaviour (e.g. request latency P95, error rate, availability). SLIs are the metrics used to evaluate whether SLOs are being met.', where:'App Insights, Log Analytics' },
  { term:'SLO', abbr:'SLO', cat:'Observability', def:'Service Level Objective. A target value for an SLI. If the SLO is consistently met, the service is considered reliable. Example: P95 latency ≤ 600ms, availability ≥ 99.9%. SLOs define the error budget — the acceptable amount of unreliability.', where:'App Insights, Log Analytics, KQL dashboards' },
  { term:'SOAR', abbr:'SOAR', cat:'Security', def:'Security Orchestration, Automation, and Response. The automation layer of a SIEM (Sentinel). In this platform, Logic Apps playbooks automatically respond to security incidents (e.g. blocking an IP in Front Door when a brute-force incident is raised).', where:'Microsoft Sentinel' },
  // T
  { term:'TTL', abbr:'TTL', cat:'Caching', def:'Time To Live. The duration for which a cached item is considered valid. After TTL expiry, the item is evicted and must be re-fetched from the source. In the MDM cache, TTL is configurable per data type (e.g. address may have a 24-hour TTL; business license status may have a 1-hour TTL).', where:'MDM Redis Cache' },
  // V
  { term:'VNet', abbr:'VNet', cat:'Networking', def:'Azure Virtual Network. A logically isolated private network in Azure. All platform services (Container Apps, APIM backends, data stores) communicate within the VNet. Data stores are accessible only via Private Endpoints. No direct internet access from backend services.', where:'Region A primary networking' },
  // W
  { term:'WAF', abbr:'WAF', cat:'Security', def:'Web Application Firewall. Inspects HTTP/S traffic at Layer 7 for common exploits (SQL injection, XSS, command injection — OWASP Top 10) before it reaches application infrastructure. In this platform, Front Door Premium\'s managed WAF policy is enabled with Microsoft-managed OWASP rule sets.', where:'Azure Front Door Premium, Edge layer' },
  { term:'WAL', abbr:'WAL', cat:'Data', def:'Write-Ahead Log. A PostgreSQL durability mechanism that records every change before it is applied to data files. Debezium reads the WAL as a CDC source — no application changes needed, and no additional database load beyond what PostgreSQL already produces.', where:'PostgreSQL, Debezium CDC' },
  { term:'WCAG', abbr:'WCAG', cat:'Accessibility', def:'Web Content Accessibility Guidelines. International W3C standard for accessible web content. Level AA is the mandatory baseline in EU digital services law. The Portal is designed and tested to WCAG 2.1 AA compliance.', where:'Portal, Form / UI Schema Service' },
  { term:'WORM', abbr:'WORM', cat:'Storage', def:'Write Once, Read Many. An immutability policy on Azure Blob Storage preventing modification or deletion for a defined retention period. Required for legally admissible audit records. In this platform, all consent receipts and audit events are written to WORM-enabled containers.', where:'Blob Storage, Audit Evidence store, Consent Service' },
  // Z
  { term:'Zero-Trust', cat:'Security', def:'A security model based on the principle "never trust, always verify." Every request — regardless of network origin — must be authenticated and authorised. No implicit trust is granted based on network location. Enforced in this platform via Front Door WAF, APIM JWT validation, Consent Gate, Private Endpoints, and Managed Identity.', where:'All platform layers' },
  { term:'ZRS', abbr:'ZRS', cat:'Infrastructure', def:'Zone-Redundant Storage / Zone-Redundant Services. Data and compute replicated synchronously across three Availability Zones within a region. Provides zero-downtime protection against single-zone failures. Used for PostgreSQL, Blob Storage, and Container Apps in this platform.', where:'PostgreSQL Flexible Server, Blob Storage, Container Apps' }
];

function initGlossary() {
  const container = document.getElementById('glossary-list');
  if (!container) return;

  function render(filter='') {
    const q = filter.toLowerCase();
    const groups = {};
    GLOSSARY.forEach(g => {
      if (q && !g.term.toLowerCase().includes(q) && !g.def.toLowerCase().includes(q) && !(g.abbr||'').toLowerCase().includes(q)) return;
      const letter = g.term[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(g);
    });
    let html = '';
    Object.keys(groups).sort().forEach(letter => {
      html += `<div class="glossary-group"><div class="glossary-letter">${letter}</div>`;
      groups[letter].forEach(g => {
        html += `<div class="glos-item">
          <div class="glos-term">${g.term}${g.abbr&&g.abbr!==g.term?`<span class="glos-abbr">${g.abbr}</span>`:''}</div>
          <div class="glos-cat">${g.cat}</div>
          <div class="glos-def">${g.def}</div>
          ${g.where?`<div class="glos-where">Used in: ${g.where}</div>`:''}
        </div>`;
      });
      html += `</div>`;
    });
    container.innerHTML = html || '<p style="color:var(--text-3);font-size:0.8rem;padding:20px 0;">No matching terms.</p>';
  }

  render();

  const search = document.getElementById('glossary-search');
  if (search) search.addEventListener('input', () => render(search.value));

  // Alpha buttons
  document.querySelectorAll('.alpha-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const letter = btn.dataset.letter;
      if (letter === 'ALL') { render(); if(search) search.value=''; return; }
      render(letter);
      if (search) search.value = letter;
    });
  });
}

})();
