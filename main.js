'use strict';
/* =====================================================================
   COLDALERT · casca da aplicação, navegação e tela inicial
   ===================================================================== */
const $ = id => document.getElementById(id);
const VIEWS = [
  { id: 'visao', label: 'Visão geral', ico: 'grid', fn: vOverview },
  { id: 'territorial', label: 'Inteligência territorial', ico: 'target', fn: vTerritorial },
  { id: 'eo', label: 'Observação da Terra', ico: 'globe', fn: vEO },
  { id: 'clima', label: 'Monitoramento climático', ico: 'cloud', fn: vClima },
  { id: 'risco', label: 'Índice de risco de frio', ico: 'gauge', fn: vRisco },
  { id: 'previsao', label: 'Previsão de risco', ico: 'trend', fn: vPrevisao },
  { id: 'alertas', label: 'Central de alertas', ico: 'bell', fn: vAlertas },
  { id: 'ocorrencias', label: 'Monitoramento de ocorrências', ico: 'pin', fn: vOcorrencias },
  { id: 'abrigos', label: 'Gestão de abrigos', ico: 'house', fn: vAbrigos },
  { id: 'campo', label: 'Operações de campo', ico: 'users', fn: vCampo },
  { id: 'plano', label: 'Planejamento de resposta', ico: 'clip', fn: vPlano },
  { id: 'historico', label: 'Análise histórica', ico: 'hist', fn: vHistorico },
  { id: 'relatorios', label: 'Relatórios de gestão', ico: 'file', fn: vRelatorios },
  { id: 'dados', label: 'Banco de dados e fontes', ico: 'db', fn: vDados },
  { id: 'config', label: 'Configurações e acessos', ico: 'cog', fn: vConfig }
];
const GROUPS = { 0: 'Operação', 3: 'Análise e previsão', 6: 'Resposta', 11: 'Gestão e dados' };
let CURV = 'visao', GLOBE = null, MENU = null;

function buildNav() {
  $('side').innerHTML = VIEWS.map((v, i) => (GROUPS[i] ? `<div class="grp">${GROUPS[i]}</div>` : '') + `<a href="#${v.id}" data-nav="${v.id}"><span class="n">${String(i + 1).padStart(2, '0')}</span>${ICON[v.ico]}<span>${v.label}</span></a>`).join('');
  $('side').addEventListener('click', e => { const a = e.target.closest('[data-nav]'); if (a) { e.preventDefault(); navigate(a.dataset.nav); } });
}
function navigate(id) {
  if (!VIEWS.find(v => v.id === id)) return;
  CURV = id; try { location.hash = id; } catch (e) { /* noop */ }
  closeMenu(); closeDrawer(); renderView(false);
}
function renderView(keep) {
  CUR.cleanup.forEach(f => { try { f(); } catch (e) { /* noop */ } }); CUR.cleanup = [];
  const main = $('main'), v = VIEWS.find(x => x.id === CURV), y = main.scrollTop;
  const wrap = document.createElement('div'); wrap.className = 'view'; main.replaceChildren(wrap);
  try { v.fn(wrap); }
  catch (err) { console.error(err); wrap.innerHTML = `<div class="empty"><b>Não foi possível montar esta tela.</b><span>${esc(err && err.message)}. Tente voltar à Visão geral.</span><button class="btn" data-go="visao">Voltar à Visão geral</button></div>`; }
  main.scrollTop = keep ? y : 0;
  $('side').querySelectorAll('[data-nav]').forEach(a => { a.classList.toggle('on', a.dataset.nav === CURV); if (a.dataset.nav === CURV) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.title = 'ColdAlert Command Center';
  updateBell();
}
function refreshView() { renderView(true); }
function closeDrawer() { $('side').classList.remove('open'); $('dbg').classList.remove('on'); }

/* ---------- menus da barra superior ---------- */
function closeMenu() { if (MENU) { MENU.el.remove(); MENU.btn.setAttribute('aria-expanded', 'false'); MENU = null; } }
function openMenu(btn, html) {
  const same = MENU && MENU.btn === btn; closeMenu(); if (same) return;
  const m = document.createElement('div'); m.className = 'menu'; m.innerHTML = html; $('app').appendChild(m);
  btn.setAttribute('aria-expanded', 'true'); MENU = { el: m, btn };
  m.addEventListener('click', e => { const a = e.target.closest('[data-alert]'); if (a) { ALERT_SEL = a.dataset.alert; navigate('alertas'); } const g = e.target.closest('[data-go]'); if (g) navigate(g.dataset.go); });
}
function notices() {
  const items = openAlerts().filter(a => a.status === 'novo').map(a => `<button class="row-btn" data-alert="${a.id}">${sevPill(a.sev)}<span><b>${esc(a.id)}</b> · ${esc(a.type)}<small>${esc(REG[a.reg].name)} · ${fmtDMHM(a.at)} · demonstração</small></span></button>`);
  const sys = [`<button class="row-btn" data-go="dados"><span class="pill sev-alto">SISTEMA</span><span>Nenhuma fonte de dados real está conectada<small>${SOURCES.filter(s => s.status === 'down').length} de ${SOURCES.length} fontes indisponíveis</small></span></button>`];
  return { items, sys, n: items.length };
}
function updateBell() { const n = notices().n, c = $('bellcnt'); c.hidden = !n; c.textContent = n; $('bell').setAttribute('aria-label', 'Notificações operacionais: ' + n + ' novas'); }
function wireTopbar() {
  $('logo').addEventListener('click', () => showLanding(true));
  $('navbtn').addEventListener('click', () => { const o = $('side').classList.toggle('open'); $('dbg').classList.toggle('on', o); });
  $('dbg').addEventListener('click', closeDrawer);
  $('bell').addEventListener('click', e => { const n = notices(); openMenu(e.currentTarget, `<h4>Notificações operacionais</h4>${n.items.join('') || '<p class="dim pad">Sem alertas novos.</p>'}<h4>Sistema</h4>${n.sys.join('')}`); });
  $('srcb').addEventListener('click', e => openMenu(e.currentTarget, `<h4>Fontes de dados</h4>${SOURCES.map(s => `<div class="row-i"><span><b>${esc(s.name)}</b><small>${esc(s.kind)}</small></span>${badge(s.status === 'sim' ? 'sim' : s.status === 'manual' ? 'manual' : s.status === 'live' ? 'live' : 'down')}</div>`).join('')}<div class="pad"><button class="lnk" data-go="dados">Ver detalhes das fontes</button></div>`));
  $('opb').addEventListener('click', e => openMenu(e.currentTarget, `<h4>Operador</h4><div class="pad"><b>${esc(OPERATOR)}</b><br><span class="dim">Perfil: Gestor (simulado)</span><p class="sm dim" style="margin-top:8px">Sem autenticação neste protótipo. O nome é fictício.</p><button class="lnk" data-go="config">Perfis e acessos</button></div>`));
  $('wide').addEventListener('click', () => {
    const w = $('app').classList.toggle('wide'); $('wide').setAttribute('aria-pressed', String(w));
    if (w && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { /* usa só o modo expandido */ });
    else if (!w && document.fullscreenElement) document.exitFullscreen().catch(() => { /* noop */ });
    setTimeout(() => GIS_LIST.forEach(m => m.resize()), 60);
  });
  document.addEventListener('click', e => { if (MENU && !e.target.closest('.menu') && !e.target.closest('.tb-b')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  $('main').addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) navigate(g.dataset.go); });
  const tick = () => { const d = new Date(); $('clock').innerHTML = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}<small>${fmtDMY(d)} · relógio do navegador</small>`; };
  tick(); setInterval(tick, 1000);
}

/* ---------- tela inicial: Earth Intelligence ---------- */
function topSectors() { return overallAt(0).top.slice(0, 3); }
function showLanding(reset) {
  $('landing').hidden = false; $('landing').classList.remove('out'); $('app').hidden = true;
  if (!GLOBE) { GLOBE = new Globe($('globe-cv')); GLOBE.onStage = setStageUI; }
  if (reset) { GLOBE.cam = { lat: GLOBE_STAGES[0].lat, lon: GLOBE_STAGES[0].lon, z: 1 }; GLOBE.stage = 0; GLOBE.auto = true; GLOBE.tween = null; setStageUI(0); }
  GLOBE.resize(); GLOBE.start(); closeMenu();
}
function setStageUI(i) {
  $('stages').querySelectorAll('button').forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('done', k < i); });
  const c = $('lcard'); c.hidden = i !== GLOBE_STAGES.length - 1;
  if (!c.hidden) c.innerHTML = `<h4>Áreas prioritárias · ${esc(PLACES.sbc.name)}</h4>${topSectors().map(t => `<div class="rk"><span>${esc(t.r.name)}</span><div class="rk-bar"><i style="width:${t.c.score}%;background:${t.c.cls.color}"></i></div><b>${fmt0(t.c.score)}</b></div>`).join('')}<div class="prov">${badge('sim')}<span>Setores esquemáticos</span></div>`;
  $('stage-d').textContent = GLOBE_STAGES[i].d;
}
let FLYING = false;
function enterApp(view) {
  const go = () => {
    FLYING = false; CURV = view || 'visao'; try { location.hash = CURV; } catch (e) { /* noop */ }
    $('app').hidden = false; $('landing').classList.add('out'); if (GLOBE) GLOBE.stop();
    renderView(false); setTimeout(() => { $('landing').hidden = true; }, 650);
  };
  if (FLYING) return;
  FLYING = true; $('skip').hidden = false;
  const target = view === 'territorial' ? 5 : GLOBE_STAGES.length - 1;
  GLOBE.flyTo(target, 0.85, () => setTimeout(go, GLOBE.reduced ? 0 : 450));
  $('skip').onclick = () => { GLOBE.tween = null; GLOBE.goStage(target, 0, go); };
}
function wireLanding() {
  $('stages').innerHTML = GLOBE_STAGES.map((s, i) => `<button data-i="${i}">${s.label}</button>`).join('');
  $('stages').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b && !FLYING) GLOBE.goStage(+b.dataset.i, 1.6); });
  $('cta1').addEventListener('click', () => enterApp('visao'));
  $('cta2').addEventListener('click', () => enterApp('territorial'));
  $('hud').innerHTML = [
    ['s', 'EARTH OBSERVATION', 'produtos de satélite: fonte indisponível'],
    ['a', 'TERRITORIAL MONITORING', 'esquema operacional, sem georreferência'],
    ['a', 'COLD RISK INTELLIGENCE', 'índice experimental, dados simulados'],
    ['a', 'ATMOSPHERIC CONDITIONS', 'cenário de demonstração'],
    ['d', 'LIVE DATA STATUS', '0 de ' + SOURCES.length + ' fontes conectadas']
  ].map(h => `<li><i class="${h[0]}"></i><span>${h[1]}<em>${h[2]}</em></span></li>`).join('');
}

/* ---------- inicialização ---------- */
function boot() {
  buildNav(); wireTopbar(); wireLanding(); updateBell();
  const h = (location.hash || '').replace('#', '');
  if (VIEWS.find(v => v.id === h)) { CURV = h; $('landing').hidden = true; $('app').hidden = false; renderView(false); }
  else { setStageUI(0); showLanding(false); }
}
window.addEventListener('error', e => console.error('Erro não tratado:', e.message));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { GIS_LIST.forEach(m => m.draw()); }).catch(() => { /* noop */ });
boot();
