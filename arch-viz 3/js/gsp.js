// ── Global Side Panel (GSP) ───────────────────────────────────────────────────
// Single, unified detail drawer used by ALL clickable components across every tab.
// Usage: GSP.open(config)  where config = { color, cat, title, sub, sections[] }
// Each section: { label, type:'prose'|'list'|'code'|'tags'|'tables', body }
// ─────────────────────────────────────────────────────────────────────────────
(function() {
'use strict';

const GSP = window.GSP = {};

const panel   = document.getElementById('gsp');
const overlay = document.getElementById('gsp-overlay');
const accentEl  = document.getElementById('gsp-accent');
const catEl     = document.getElementById('gsp-cat');
const titleEl   = document.getElementById('gsp-title');
const subEl     = document.getElementById('gsp-sub');
const bodyEl    = document.getElementById('gsp-body');
const closeBtn  = document.getElementById('gsp-close');

function hexA(hex, a) {
  try { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; }
  catch { return hex; }
}

GSP.open = function(cfg) {
  const c = cfg.color || '#f97316';
  // Accent bar
  accentEl.style.background = `linear-gradient(90deg, ${c}, ${c}cc)`;
  // Head
  catEl.textContent   = cfg.cat   || '';
  titleEl.textContent = cfg.title || '';
  subEl.textContent   = cfg.sub   || '';
  titleEl.style.color = c;
  panel.style.setProperty('--gsp-color', c);
  // Body
  bodyEl.innerHTML = buildBody(cfg.sections || [], c);
  bodyEl.scrollTop = 0;
  // Show
  overlay.classList.add('open');
  panel.classList.add('open');
  document.body.style.overflow = 'hidden';
};

GSP.close = function() {
  overlay.classList.remove('open');
  panel.classList.remove('open');
  document.body.style.overflow = '';
};

GSP.isOpen = function() { return panel.classList.contains('open'); };

function buildBody(sections, color) {
  let html = '';
  sections.forEach(s => {
    if (!s || !s.label) return;
    html += `<div class="gsp-section-lbl">${s.label}</div>`;
    const b = s.body;
    switch (s.type) {
      case 'prose':
        html += `<div class="gsp-prose accent-border" style="border-left-color:${hexA(color,0.5)}">${b}</div>`;
        break;
      case 'list':
        if (Array.isArray(b)) {
          html += `<ul class="gsp-list">${b.map(x=>`<li>${x}</li>`).join('')}</ul>`;
        } else {
          html += `<div class="gsp-prose">${b}</div>`;
        }
        break;
      case 'code':
        html += `<div class="gsp-code">${b}</div>`;
        break;
      case 'tags':
        if (Array.isArray(b)) {
          html += `<div class="gsp-tags">${b.map(t=>`<span class="gsp-tag">${t}</span>`).join('')}</div>`;
        }
        break;
      case 'tables':
        // b = array of { icon, name, rows[] }
        if (Array.isArray(b)) {
          b.forEach(tbl => {
            html += `<div class="gsp-db-table">
              <div class="gsp-db-table-hdr"><span class="db-icon">${tbl.icon||'🗄'}</span>${tbl.name}</div>
              ${tbl.rows.map(r=>`<div class="gsp-db-row">${r}</div>`).join('')}
            </div>`;
          });
        }
        break;
      case 'badge-list':
        if (Array.isArray(b)) {
          html += `<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:6px">`;
          b.forEach(({label:bl, value:bv, color:bc}) => {
            const fc = bc||color;
            html += `<div class="gsp-badge" style="color:${fc};border-color:${hexA(fc,0.35)};background:${hexA(fc,0.07)}">
              <span style="font-weight:700">${bl}:</span> ${bv}
            </div>`;
          });
          html += '</div>';
        }
        break;
      default:
        html += `<div class="gsp-prose">${b}</div>`;
    }
  });
  return html || '<div style="color:var(--text-3);font-size:.78rem;text-align:center;padding:24px 0">Select a component to see details</div>';
}

// Close handlers
closeBtn.addEventListener('click', GSP.close);
overlay.addEventListener('click', GSP.close);
document.addEventListener('keydown', e => { if (e.key === 'Escape') GSP.close(); });

})();
