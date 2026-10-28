'use strict';
/* =====================================================================
   COLDALERT · helpers de interface
   ===================================================================== */
const svgI = p => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  layers: svgI('<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
  plus: svgI('<path d="M12 5v14M5 12h14"/>'),
  minus: svgI('<path d="M5 12h14"/>'),
  home: svgI('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'),
  expand: svgI('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  x: svgI('<path d="M6 6l12 12M18 6 6 18"/>'),
  grid: svgI('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
  target: svgI('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>'),
  globe: svgI('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
  cloud: svgI('<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 10a4 4 0 0 1 0 8H7z"/>'),
  gauge: svgI('<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4-6"/>'),
  trend: svgI('<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>'),
  bell: svgI('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 21h4"/>'),
  pin: svgI('<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  house: svgI('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  users: svgI('<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14a5 5 0 0 1 5 5"/>'),
  clip: svgI('<rect x="6" y="4" width="12" height="17" rx="1.5"/><path d="M9 4h6v3H9zM9 12h6M9 16h6"/>'),
  hist: svgI('<path d="M4 12a8 8 0 1 0 3-6.2L4 8"/><path d="M4 3v5h5M12 8v4l3 2"/>'),
  file: svgI('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>'),
  db: svgI('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
  cog: svgI('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'),
  menu: svgI('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  user: svgI('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  check: svgI('<path d="m5 12 5 5 9-10"/>'),
  print: svgI('<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>')
};

const BADGES = {
  live: 'DADO EM TEMPO REAL', official: 'DADO OFICIAL', upd: 'ÚLTIMA ATUALIZAÇÃO', hist: 'DADO HISTÓRICO',
  sim: 'DADO SIMULADO', down: 'FONTE INDISPONÍVEL', manual: 'IMPORTAÇÃO MANUAL'
};
function badge(kind, extra) { return `<span class="bdg b-${kind}">${BADGES[kind] || kind}${extra ? ' · ' + esc(extra) : ''}</span>`; }

function toast(msg, type) {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 4200);
}

/* Modal em página (alert/confirm do navegador não funcionam no visualizador). */
function openModal(html, o) {
  closeModal();
  const m = document.createElement('div');
  m.className = 'modal'; m.id = 'modal';
  m.innerHTML = `<div class="modal-bg" data-m="close"></div><div class="modal-box" role="dialog" aria-modal="true" aria-label="${esc((o && o.title) || 'Detalhes')}"><button class="gis-btn sq modal-x" data-m="close" aria-label="Fechar">${ICON.x}</button>${html}</div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target.closest('[data-m="close"]')) closeModal(); });
  m._esc = ev => { if (ev.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', m._esc);
  const first = m.querySelector('button.primary,input,select,textarea,button:not(.modal-x)');
  (first || m.querySelector('.modal-x')).focus();
  return m;
}
function closeModal() {
  const m = document.getElementById('modal');
  if (m) { document.removeEventListener('keydown', m._esc); m.remove(); }
}
function confirmModal(title, body, okLabel, onOk) {
  const m = openModal(`<h3>${esc(title)}</h3><p>${body}</p><div class="row-end"><button class="btn ghost" data-m="close">Cancelar</button><button class="btn primary" id="cm-ok">${esc(okLabel || 'Confirmar')}</button></div>`, { title });
  m.querySelector('#cm-ok').addEventListener('click', () => { closeModal(); onOk(); });
}

const sevLabel = { baixo: 'Baixa', moderado: 'Moderada', alto: 'Alta', critico: 'Crítica' };
const sevPill = s => `<span class="pill sev-${s}">${sevLabel[s] || s}</span>`;
const statusPill = s => `<span class="pill st-${String(s).replace(/\s/g, '-')}">${esc(s)}</span>`;
const prioPill = p => `<span class="pill pr-${p === 'média' ? 'media' : p}">${esc(p)}</span>`;
const card = (title, body, o) => { o = o || {}; return `<section class="card ${o.cls || ''}"${o.id ? ` id="${o.id}"` : ''}>${title || o.right ? `<header class="card-h"><h3>${title || ''}</h3>${o.right ? `<div class="card-r">${o.right}</div>` : ''}</header>` : ''}<div class="card-b">${body}</div></section>`; };
const pageHead = (title, sub, right) => `<div class="page-h"><div><span class="eyebrow">${esc(sub || '')}</span><h1>${esc(title)}</h1></div>${right ? `<div class="page-r">${right}</div>` : ''}</div>`;
const tile = (label, value, sub, color, spark) => `<div class="tile"><span class="t-l">${esc(label)}</span><b class="t-v" ${color ? `style="color:${color}"` : ''}>${value}</b><span class="t-s">${sub || ''}</span>${spark || ''}</div>`;
const protoNote = txt => `<div class="proto-note"><b>PROTÓTIPO</b> ${txt}</div>`;
const selectHTML = (id, opts, val, label) => `<label class="fld"><span>${esc(label)}</span><select id="${id}">${opts.map(o => { const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`; }).join('')}</select></label>`;

/* Estado compartilhado de navegação e filtros */
const ALERT_FILTER = { reg: '', sev: '', status: '', range: '' };
function overallNow() { return overallAt(0); }
function openAlerts() { return ALERTS.filter(a => a.status !== 'encerrado'); }
