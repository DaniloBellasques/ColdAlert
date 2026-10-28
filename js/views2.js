'use strict';
/* =====================================================================
   COLDALERT · módulos 7 a 15
   ===================================================================== */
let ALERT_SEL = null;
const fmtLong = d => fmtDMY(d) + ' ' + fmtHM(d);

/* ---------- 7. Central de alertas ---------- */
function vAlertas(root) {
  const F = ALERT_FILTER;
  const list = ALERTS.filter(a => (!F.reg || a.reg === F.reg) && (!F.sev || a.sev === F.sev) && (!F.status || a.status === F.status) && (!F.range || (T0 - a.at) / MS_H <= +F.range)).sort((a, b) => b.at - a.at);
  if (!ALERT_SEL || !list.find(a => a.id === ALERT_SEL)) ALERT_SEL = list[0] ? list[0].id : null;
  const sel = ALERTS.find(a => a.id === ALERT_SEL);
  root.innerHTML = pageHead('Central de alertas', 'Alertas internos do ColdAlert · não são alertas oficiais', badge('sim') + badge('down', 'Defesa Civil')) + `
    <div class="warn-box">Os alertas abaixo são gerados pelo motor de demonstração e por regras internas. Sem integração com a Defesa Civil ou outra fonte oficial, o sistema não emite nem confirma alertas oficiais.</div>
    <div class="filters">
      ${selectHTML('f-reg', [['', 'Todas as regiões'], ...REGIONS.map(r => [r.id, r.name])], F.reg, 'Região')}
      ${selectHTML('f-sev', [['', 'Todas'], ['critico', 'Crítica'], ['alto', 'Alta'], ['moderado', 'Moderada'], ['baixo', 'Baixa']], F.sev, 'Severidade')}
      ${selectHTML('f-st', [['', 'Todas'], ...ALERT_STATUS], F.status, 'Situação')}
      ${selectHTML('f-rg', [['', 'Todo o período'], ['6', 'Últimas 6 h'], ['24', 'Últimas 24 h'], ['72', 'Últimas 72 h']], F.range, 'Data')}
      <button class="btn ghost" id="f-clr">Limpar filtros</button>
    </div>
    <div class="al-grid">
      <div class="al-list" role="list">${list.map(a => `<button class="al-it${a.id === ALERT_SEL ? ' on' : ''}" data-id="${a.id}" role="listitem"><span class="sevbar sev-${a.sev}"></span><span class="al-main"><b>${esc(a.id)}</b><span>${esc(a.type)}</span><small>${esc(REG[a.reg].name)} · ${fmtDMHM(a.at)}</small></span><span class="al-r">${sevPill(a.sev)}${statusPill(a.status)}</span></button>`).join('') || '<div class="empty"><b>Nenhum alerta com esses filtros.</b><span>Ajuste ou limpe os filtros para ver os demais.</span></div>'}</div>
      <div class="al-det" id="aldet">${sel ? alertDetail(sel) : '<div class="empty"><b>Selecione um alerta</b><span>Os detalhes e o registro de providências aparecem aqui.</span></div>'}</div>
    </div>`;
  const rf = () => refreshView();
  const bind = (id, k) => root.querySelector(id).addEventListener('change', e => { F[k] = e.target.value; rf(); });
  bind('#f-reg', 'reg'); bind('#f-sev', 'sev'); bind('#f-st', 'status'); bind('#f-rg', 'range');
  root.querySelector('#f-clr').addEventListener('click', () => { Object.assign(F, { reg: '', sev: '', status: '', range: '' }); rf(); });
  root.querySelector('.al-list').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { ALERT_SEL = b.dataset.id; rf(); } });
  const f = root.querySelector('#alform');
  if (f) f.addEventListener('submit', e => {
    e.preventDefault();
    const st = f.querySelector('#al-st').value, own = f.querySelector('#al-own').value.trim(), note = f.querySelector('#al-note').value.trim();
    const apply = () => {
      const changed = st !== sel.status;
      if (own) sel.owner = own;
      sel.status = st;
      sel.hist.push({ at: new Date(), who: OPERATOR, txt: (changed ? 'Status alterado para ' + st + '. ' : '') + (note ? 'Providência: ' + note : 'Sem observações.') });
      toast('Providência registrada em ' + sel.id + ' (protótipo, não persiste ao recarregar).', 'ok'); refreshView();
    };
    if (st === 'encerrado' && sel.status !== 'encerrado') confirmModal('Encerrar alerta?', `O alerta <b>${esc(sel.id)}</b> será marcado como encerrado. Isso não afeta nenhum alerta oficial.`, 'Encerrar', apply); else apply();
  });
}
function alertDetail(a) {
  return `<span class="eyebrow">${esc(a.id)}</span><h3>${esc(a.type)}</h3><div class="chips">${sevPill(a.sev)}${statusPill(a.status)}${badge('sim')}</div>
  <dl class="kv"><div><dt>Região afetada</dt><dd>${esc(REG[a.reg].name)} (esquemático)</dd></div><div><dt>Data e hora</dt><dd>${fmtDMHM(a.at)}</dd></div><div><dt>Fonte</dt><dd>${esc(a.src)}</dd></div><div><dt>Responsável</dt><dd>${esc(a.owner)}</dd></div></dl>
  <h5>Evidências utilizadas</h5><ul class="plain">${a.ev.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  <h5>Histórico de alterações</h5><ol class="tl">${a.hist.map(h => `<li><time>${fmtDMHM(h.at)}</time><b>${esc(h.who)}</b><span>${esc(h.txt)}</span></li>`).join('')}</ol>
  <form id="alform" class="form-g one"><h5>Confirmação e registro de providências</h5>
    ${selectHTML('al-st', ALERT_STATUS, a.status, 'Situação')}<label class="fld"><span>Órgão ou equipe responsável</span><input id="al-own" value="${esc(a.owner)}"></label>
    <label class="fld"><span>Providência realizada</span><textarea id="al-note" rows="3" placeholder="Descreva a ação e o encaminhamento. Não inclua dados pessoais."></textarea></label>
    <div class="row-end"><button class="btn primary" type="submit">Registrar</button></div></form>`;
}

/* ---------- 8. Ocorrências ---------- */
function openIncident(id) {
  const o = INCIDENTS.find(x => x.id === id); if (!o) return;
  const m = openModal(`<span class="eyebrow">OCORRÊNCIA · ${esc(o.id)}</span><h3>${esc(o.type)}</h3><div class="chips">${prioPill(o.prio)}${statusPill(o.status)}${badge('sim')}</div>
    <dl class="kv"><div><dt>Setor</dt><dd>${esc(REG[o.reg].name)}</dd></div><div><dt>Registrada</dt><dd>${fmtDMHM(o.at)}</dd></div><div><dt>Equipe</dt><dd>${esc(o.team)}</dd></div><div><dt>Providências</dt><dd>${esc(o.act || '—')}</dd></div><div><dt>Encaminhamento</dt><dd>${esc(o.enc || '—')}</dd></div><div><dt>Observações</dt><dd>${esc(o.note || '—')}</dd></div></dl>
    <div class="form-g one">${selectHTML('inc-st', INC_STATUS, o.status, 'Alterar status')}</div><div class="row-end"><button class="btn ghost" data-m="close">Fechar</button><button class="btn primary" id="inc-ok">Salvar status</button></div>`, { title: o.id });
  m.querySelector('#inc-ok').addEventListener('click', () => { o.status = m.querySelector('#inc-st').value; closeModal(); toast(o.id + ': status alterado para ' + o.status + '.', 'ok'); refreshView(); });
}
function vOcorrencias(root) {
  root.innerHTML = pageHead('Monitoramento de ocorrências', 'Registro interno · dados agregados', badge('sim')) + `
    <div class="warn-box info"><b>Proteção de dados.</b> Os registros não possuem campos para nome, documento ou imagem de pessoas. Em produção, o acesso por perfil limitará as informações sensíveis. Nada é exibido publicamente.</div>
    ${card('', '<div class="gis tall" id="ocmap"></div>', { cls: 'nopad' })}
    <div class="cols-oc">
      ${card('Ocorrências', `<div class="tbl-w"><table class="tbl"><thead><tr><th>ID</th><th>Setor</th><th>Tipo</th><th>Prioridade</th><th>Equipe</th><th>Status</th><th>Registro</th></tr></thead><tbody>${INCIDENTS.slice().sort((a, b) => b.at - a.at).map(o => `<tr class="clk" tabindex="0" data-id="${o.id}"><td><b>${esc(o.id)}</b></td><td>${esc(o.reg)}</td><td>${esc(o.type)}</td><td>${prioPill(o.prio)}</td><td>${esc(o.team)}</td><td>${statusPill(o.status)}</td><td>${fmtDMHM(o.at)}</td></tr>`).join('')}</tbody></table></div>`, { right: badge('sim') })}
      ${card('Registrar ocorrência', `<form id="ocf" class="form-g one">
        ${selectHTML('oc-reg', REGIONS.map(r => [r.id, r.name]), 'A', 'Localização (setor)')}${selectHTML('oc-type', INC_TYPES, INC_TYPES[0], 'Tipo de ocorrência')}
        ${selectHTML('oc-prio', ['alta', 'média', 'baixa'], 'média', 'Nível de prioridade')}${selectHTML('oc-team', TEAM_NAMES, TEAM_NAMES[0], 'Equipe responsável')}${selectHTML('oc-st', INC_STATUS, 'Aberta', 'Status')}
        <label class="fld"><span>Providências realizadas</span><input id="oc-act"></label><label class="fld"><span>Encaminhamento efetuado</span><input id="oc-enc"></label>
        <label class="fld"><span>Observações operacionais</span><textarea id="oc-note" rows="2" placeholder="Sem dados pessoais."></textarea></label>
        <div class="row-end"><button class="btn primary" type="submit">Registrar</button></div></form><p class="sm dim">Data e hora são preenchidas automaticamente com o relógio do navegador.</p>`)}
    </div>`;
  mkMap(root.querySelector('#ocmap'), { kind: 'ops' }).st.ov.incidents = true;
  root.querySelector('tbody').addEventListener('click', e => { const tr = e.target.closest('[data-id]'); if (tr) openIncident(tr.dataset.id); });
  root.querySelector('tbody').addEventListener('keydown', e => { if (e.key === 'Enter') { const tr = e.target.closest('[data-id]'); if (tr) openIncident(tr.dataset.id); } });
  root.querySelector('#ocf').addEventListener('submit', e => {
    e.preventDefault(); const v = id => root.querySelector('#' + id).value.trim(), n = INCIDENTS.length + 1, ri = REG[v('oc-reg')].idx, list = TERR.byReg[ri], c = list[Math.floor(Math.random() * list.length)] || TERR.cells[0];
    INCIDENTS.push({ id: 'OCO-DEMO-' + String(n).padStart(3, '0'), reg: v('oc-reg'), type: v('oc-type'), prio: v('oc-prio'), team: v('oc-team'), status: v('oc-st'), at: new Date(), act: v('oc-act'), note: v('oc-note'), enc: v('oc-enc'), pos: { x: c.x, y: c.y } });
    toast('Ocorrência registrada (protótipo, não persiste ao recarregar).', 'ok'); refreshView();
  });
}

/* ---------- 9. Abrigos ---------- */
function vAbrigos(root) {
  const sim = SHELTERS.filter(s => s.kind === 'sim');
  const rows = SHELTERS.map(s => {
    const pct = s.cap ? s.occ / s.cap : 0, stale = shelterStale(s), col = s.status === 'Indisponível' ? C.mut : pct >= 0.9 ? C.crit : pct >= 0.75 ? C.warn : C.ok;
    return `<tr class="clk${stale ? ' stale' : ''}" tabindex="0" data-id="${s.id}"><td><b>${esc(s.name)}</b><small>${esc(s.addr)}</small></td><td class="num">${s.cap}</td><td class="num">${s.occ}</td><td class="num">${s.cap - s.occ}</td><td><div class="occ"><i style="width:${Math.round(pct * 100)}%;background:${col}"></i></div><small>${Math.round(pct * 100)}%</small></td><td>${esc(s.status)}</td><td>${fmtDMHM(s.asOf)}<small>${ageText(shelterAge(s))}</small></td><td>${badge(stale ? 'hist' : 'sim')}</td></tr>`;
  }).join('');
  const cov = REGIONS.map(r => ({ r, cap: SHELTERS.filter(s => s.reg === r.id && s.kind === 'sim').reduce((a, s) => a + s.cap, 0) })).sort((a, b) => a.cap - b.cap);
  root.innerHTML = pageHead('Gestão de abrigos e infraestrutura', 'Equipamentos públicos e pontos de acolhimento', badge('sim')) + `
    <div class="warn-box">A única unidade com dado real é o Centro de Acolhimento (Baeta Neves), conforme reportagem de 02/06/2026. Ela aparece como <b>dado histórico</b> e não representa a ocupação de hoje. As demais unidades são fictícias.</div>
    <div class="tiles">${tile('Capacidade (unidades simuladas)', sim.reduce((a, s) => a + s.cap, 0), 'vagas', '', '')}${tile('Ocupação', sim.reduce((a, s) => a + s.occ, 0), `${fmt0(100 * sim.reduce((a, s) => a + s.occ, 0) / sim.reduce((a, s) => a + s.cap, 0))}% das vagas`, '', '')}${tile('Unidades operando', sim.filter(s => s.status !== 'Indisponível').length + ' de ' + sim.length, 'simuladas', '', '')}${tile('Dados com mais de 24 h', SHELTERS.filter(shelterStale).length, 'marcados como históricos', C.warn, '')}</div>
    ${card('', '<div class="gis" id="abmap" style="height:380px"></div>', { cls: 'nopad' })}
    ${card('Unidades', `<div class="tbl-w"><table class="tbl"><thead><tr><th>Unidade</th><th>Capacidade</th><th>Ocupação</th><th>Livres</th><th>Taxa</th><th>Status</th><th>Atualização</th><th>Estado do dado</th></tr></thead><tbody>${rows}</tbody></table></div>`)}
    <div class="cols-2">
      ${card('Cobertura por setor (vagas simuladas conhecidas)', cov.map(c => `<div class="rk"><span>${esc(c.r.name)}</span><div class="rk-bar"><i style="width:${Math.min(100, c.cap / 80 * 100)}%;background:${c.cap ? C.ok : C.crit}"></i></div><b>${c.cap}</b></div>`).join('') + '<p class="sm dim">Setores com barra vazia não têm unidade conhecida. Compare com o déficit estimado (simulado) na tela Inteligência territorial.</p>', { right: badge('sim') })}
      ${card('Atualizar ocupação (operador autorizado)', `<form id="abf" class="form-g one">${selectHTML('ab-u', SHELTERS.map(s => [s.id, s.name]), SHELTERS[1].id, 'Unidade')}<label class="fld"><span>Ocupação atual (vagas)</span><input id="ab-o" type="number" min="0" required value="${SHELTERS[1].occ}"></label><div class="row-end"><button class="btn primary" type="submit">Atualizar</button></div></form><p class="sm dim">Em produção, a ocupação virá de integração ou de operadores autenticados. Aqui a alteração vale só nesta sessão.</p>`)}
    </div>`;
  const m = mkMap(root.querySelector('#abmap'), { kind: 'ops', mini: true, layers: false, slider: false, data: 'none', ov: { shelters: true }, panel: false });
  const go = id => { const s = SHELTERS.find(x => x.id === id); if (s) onMapMarker('shelter', s); };
  root.querySelector('tbody').addEventListener('click', e => { const tr = e.target.closest('[data-id]'); if (tr) go(tr.dataset.id); });
  root.querySelector('tbody').addEventListener('keydown', e => { if (e.key === 'Enter') { const tr = e.target.closest('[data-id]'); if (tr) go(tr.dataset.id); } });
  const u = root.querySelector('#ab-u'), o = root.querySelector('#ab-o');
  u.addEventListener('change', () => { o.value = SHELTERS.find(s => s.id === u.value).occ; });
  root.querySelector('#abf').addEventListener('submit', e => {
    e.preventDefault(); const s = SHELTERS.find(x => x.id === u.value), v = Math.round(+o.value);
    if (v > s.cap) { toast('A ocupação não pode passar da capacidade (' + s.cap + ').', 'err'); return; }
    s.occ = v; s.asOf = new Date(T0.getTime()); s.kind = 'sim'; s.src = 'Operador Demo (protótipo)';
    toast('Ocupação atualizada em ' + s.name + '.', 'ok'); refreshView();
  });
}

/* ---------- 10. Operações de campo ---------- */
function vCampo(root) {
  const nextSt = s => TASK_STATUS[(TASK_STATUS.indexOf(s) + 1) % 3];
  root.innerHTML = pageHead('Operações de campo', 'Equipes, tarefas e andamento', badge('sim')) + `
    <div class="tiles">${TEAMS.map(t => tile(t.name, t.state, `setor ${esc(t.reg)} · ${TASKS.filter(x => x.team === t.name && x.status !== 'Concluída').length} tarefa(s) ativas`, t.state === 'Em campo' ? C.ok : C.cyan, '')).join('')}</div>
    ${card('', '<div class="gis" id="cpmap" style="height:360px"></div>', { cls: 'nopad' })}
    <div class="kanban">${TASK_STATUS.map(st => `<section class="kcol"><h4>${st} <span class="cnt">${TASKS.filter(t => t.status === st).length}</span></h4>${TASKS.filter(t => t.status === st).map(t => `<article class="kcard"><div class="kc-t"><b>${esc(t.title)}</b>${prioPill(t.prio)}</div><small>${esc(t.id)} · setor ${esc(t.reg)} · ${esc(t.team)}</small><div class="kc-a"><button class="btn sm ghost" data-t="${t.id}">Mover para ${nextSt(t.status)}</button></div></article>`).join('') || '<p class="dim sm">Sem tarefas.</p>'}</section>`).join('')}</div>
    ${card('Nova tarefa', `<form id="tkf" class="form-g"><label class="fld"><span>Título</span><input id="tk-t" required></label>${selectHTML('tk-r', REGIONS.map(r => [r.id, r.name]), 'A', 'Região de atuação')}${selectHTML('tk-e', TEAM_NAMES, TEAM_NAMES[0], 'Equipe')}${selectHTML('tk-p', ['alta', 'média', 'baixa'], 'média', 'Prioridade')}<div class="row-end full"><button class="btn primary" type="submit">Atribuir tarefa</button></div></form>`)}`;
  mkMap(root.querySelector('#cpmap'), { kind: 'ops', mini: true, layers: false, slider: false, data: 'cri', ov: { teams: true, incidents: true }, panel: false });
  root.querySelector('.kanban').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { const t = TASKS.find(x => x.id === b.dataset.t); t.status = nextSt(t.status); toast(t.id + ' movida para ' + t.status + '.', 'ok'); refreshView(); } });
  root.querySelector('#tkf').addEventListener('submit', e => { e.preventDefault(); const v = id => root.querySelector('#' + id).value.trim(); TASKS.push({ id: 'TAR-DEMO-' + String(TASKS.length + 1).padStart(2, '0'), title: v('tk-t'), reg: v('tk-r'), team: v('tk-e'), prio: v('tk-p'), status: 'A fazer' }); toast('Tarefa atribuída.', 'ok'); refreshView(); });
}

/* ---------- 11. Planejamento de resposta ---------- */
function vPlano(root) {
  const recs = buildRecommendations(), F = CUR.recFilter || '';
  const list = recs.filter(r => !F || r.prio === F), sel = recs.find(r => r.id === CUR.recSel) || list[0];
  root.innerHTML = pageHead('Planejamento de resposta', 'RESPONSE PLANNER · apoio à decisão humana', badge('sim')) + protoNote('As recomendações são sugestões geradas com dados de demonstração. Não são ordens automáticas nem substituem os protocolos oficiais. A decisão é sempre de quem gerencia a operação.') + `
    <div class="seg" role="group" aria-label="Prioridade">${[['', 'Todas'], ['alta', 'Alta'], ['média', 'Média'], ['baixa', 'Baixa']].map(([k, l]) => `<button class="seg-b${F === k ? ' on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
    <div class="al-grid">
      <div class="al-list">${list.map(r => `<button class="al-it${sel && r.id === sel.id ? ' on' : ''}" data-id="${r.id}"><span class="sevbar pr-${r.prio === 'média' ? 'media' : r.prio}"></span><span class="al-main"><b>${esc(r.title)}</b><small>${esc(r.owner)}</small></span><span class="al-r">${prioPill(r.prio)}<span class="pill st-x">${esc(RECSTATE[r.id])}</span></span></button>`).join('')}</div>
      <div class="al-det">${sel ? `<span class="eyebrow">${esc(sel.id)}</span><h3>${esc(sel.title)}</h3><div class="chips">${prioPill(sel.prio)}${badge('sim')}</div>
        <h5>Justificativa</h5><p>${esc(sel.why)}</p><h5>Dados utilizados</h5><ul class="plain">${sel.data.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <dl class="kv"><div><dt>Responsável sugerido</dt><dd>${esc(sel.owner)}</dd></div><div><dt>Status de execução</dt><dd>${esc(RECSTATE[sel.id])}</dd></div></dl>
        ${selectHTML('rc-st', REC_STATUS, RECSTATE[sel.id], 'Alterar status')}${sel.reg ? '<div class="gis" id="rcmap" style="height:260px;margin-top:12px"></div>' : ''}` : '<div class="empty"><b>Nenhuma recomendação neste filtro.</b></div>'}</div>
    </div>`;
  root.querySelector('.seg').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { CUR.recFilter = b.dataset.f; refreshView(); } });
  root.querySelector('.al-list').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { CUR.recSel = b.dataset.id; refreshView(); } });
  const s = root.querySelector('#rc-st'); if (s) s.addEventListener('change', () => { RECSTATE[sel.id] = s.value; toast('Recomendação: ' + s.value + '.', 'ok'); refreshView(); });
  if (sel && sel.reg) { const m = mkMap(root.querySelector('#rcmap'), { kind: 'ops', mini: true, layers: false, slider: false, data: 'cri', ov: { priority: true }, panel: false }); m.sel = REG[sel.reg].idx; const c = TERR.centers[m.sel]; m.v = { x: c.x, y: c.y, k: 1.6 }; m.draw(); }
}

/* ---------- 12. Análise histórica ---------- */
function vHistorico(root) {
  const N = CUR.histN || 60, rid = CUR.histReg || '', mode = CUR.histMode || 'hist';
  const reg = rid ? REG[rid] : null, kf = reg ? 0.4 + reg.recur : 1;
  const days = []; for (let d = N; d >= 0; d--) days.push(-d);
  root.innerHTML = pageHead('Análise histórica', 'Inteligência histórica · todas as séries são simuladas', badge(mode === 'hist' ? 'hist' : 'sim') + badge('sim')) + `
    <div class="warn-box">Não há histórico real conectado. As séries abaixo são sintéticas e mostram o formato da análise que será calculada com INMET, registros de alertas e dados operacionais.</div>
    <div class="filters">${selectHTML('h-n', [['30', '30 dias'], ['60', '60 dias'], ['90', '90 dias']], String(N), 'Período')}${selectHTML('h-r', [['', 'Todos os setores'], ...REGIONS.map(r => [r.id, r.name])], rid, 'Região')}${selectHTML('h-m', [['hist', 'Série histórica'], ['now', 'Cenário atual (−24 h a +72 h)']], mode, 'Dados')}</div>
    ${mode === 'hist' ? `
      <div class="cols-2">${card('Temperatura média diária (°C)', '<div id="h1"></div>', { right: badge('sim') })}${card('Alertas por dia' + (reg ? ' · ' + reg.name : ''), '<div id="h2"></div>', { right: badge('sim') })}</div>
      <div class="cols-2">${card('Utilização dos equipamentos de acolhimento (%)', '<div id="h3"></div>', { right: badge('sim') })}${card('Previsto × observado: erro médio por dia (°C)', '<div id="h4"></div>', { right: badge('sim') })}</div>` : card('Cenário atual', '<div id="h5"></div>', { right: badge('sim') })}
    <div class="cols-2">${card('Tempo de resposta operacional (min, mediana)', '<div id="h6"></div>', { right: badge('sim') })}${card('Regiões com maior recorrência', '<div id="h7"></div>', { right: badge('sim') })}</div>`;
  const bind = (id, k, num) => root.querySelector(id).addEventListener('change', e => { CUR[k] = num ? +e.target.value : e.target.value; refreshView(); });
  bind('#h-n', 'histN', true); bind('#h-r', 'histReg'); bind('#h-m', 'histMode');
  const dx = x => fmtDM(new Date(T0.getTime() + x * 24 * MS_H)), common = { xs: days, xfmt: dx, tipx: x => fmtDMY(new Date(T0.getTime() + x * 24 * MS_H)), xstep: N <= 30 ? 5 : 10 };
  if (mode === 'hist') {
    chartLine(root.querySelector('#h1'), Object.assign({ series: [{ name: 'Temperatura média', vals: days.map(x => histTemp(-x)), color: C.warn, area: true }], yfmt: v => fmt0(v) + '°', tipfmt: v => fmt1(v) + ' °C', h: 220, label: 'Temperatura média diária' }, common));
    const al = days.map(x => Math.round(histAlerts(-x) * kf));
    chartBars(root.querySelector('#h2'), { cats: days.map(x => dx(x)).map((s, i) => (i % Math.ceil(days.length / 8) === 0 ? s : '')), series: [{ name: 'Alertas', color: C.crit, vals: al }], h: 220, tipfmt: v => fmt0(v), yfmt: fmt0, label: 'Alertas por dia' });
    chartLine(root.querySelector('#h3'), Object.assign({ series: [{ name: 'Ocupação', vals: days.map(x => histOcc(-x) * 100), color: C.cyan, area: true }], ymin: 0, ymax: 100, yfmt: v => fmt0(v) + '%', tipfmt: v => fmt0(v) + '%', h: 220, label: 'Utilização' }, common));
    chartLine(root.querySelector('#h4'), Object.assign({ series: [{ name: 'Erro médio absoluto', vals: days.map(x => 0.6 + 1.2 * vnoise(-x * 0.4, 5, 8)), color: C.blue }], ymin: 0, yfmt: v => fmt1(v), tipfmt: v => fmt1(v) + ' °C', h: 220, label: 'Erro de previsão' }, common));
  } else {
    const xs = []; for (let h = -24; h <= 72; h++) xs.push(h);
    chartLine(root.querySelector('#h5'), { xs, xfmt: x => (x === 0 ? 'agora' : (x > 0 ? '+' : '−') + Math.abs(x) + 'h'), tipx: x => hLabel(x) + ' · ' + fmtDMHM(tAt(x)), xstep: 12, series: [{ name: 'Sensação térmica', vals: xs.map(h => reg ? regionFeels(reg, h) : feelsAt(h)), color: C.cyan, area: true }, { name: 'Índice de risco / 5', vals: xs.map(h => (reg ? criAt(reg, h).score : overallAt(h).score) / 5), color: C.warn, dash: '4 3' }], vlines: [{ x: 0, label: 'agora', color: C.fg }], tipfmt: v => fmt1(v), h: 240, label: 'Cenário atual' });
  }
  chartBars(root.querySelector('#h6'), { cats: REGIONS.map(r => r.id), series: [{ name: 'Minutos', color: C.blue, vals: REGIONS.map((r, i) => histResp(i)) }], colors: REGIONS.map(r => r.id === rid ? C.cyan : C.blue), h: 220, tipfmt: v => fmt0(v) + ' min', yfmt: fmt0, label: 'Tempo de resposta por setor' });
  const rec = REGIONS.map(r => ({ r, v: r.recur * 100 })).sort((a, b) => b.v - a.v);
  root.querySelector('#h7').innerHTML = rec.map(x => `<div class="rk"><span>${esc(x.r.name)}</span><div class="rk-bar"><i style="width:${x.v}%;background:${gradCss(x.v)}"></i></div><b>${fmt0(x.v)}</b></div>`).join('') + '<p class="sm dim">Recorrência relativa de eventos de frio (0 a 100), valores de demonstração.</p>';
}
function gradCss(v) { return rgbCss(gradRGB(v, RISK_STOPS)); }

/* ---------- 13. Relatórios ---------- */
function reportText(kind) {
  const ov = overallAt(0), open = openAlerts();
  if (kind === 'exec') return [`COLDALERT · Resumo executivo`, `Município: São Bernardo do Campo — SP · Referência: ${fmtLong(T0)}`, `ATENÇÃO: relatório de demonstração, com dados simulados.`, `Índice de risco (máx.): ${fmt0(ov.score)} (${ov.cls.label}), setor ${ov.max.r.name}.`, `Sensação térmica: ${fmt1(feelsAt(0))} °C; vento ${fmt0(windAt(0))} km/h.`, `Alertas internos abertos: ${open.length}. Ocorrências em aberto: ${INCIDENTS.filter(i => i.status !== 'Concluída').length}.`, `Setores prioritários: ${ov.top.slice(0, 3).map(t => t.r.name + ' (' + fmt0(t.c.score) + ')').join(', ')}.`].join('\n');
  if (kind === 'alerts') return ['COLDALERT · Alertas internos (demonstração)', ...ALERTS.map(a => `${a.id} | ${sevLabel[a.sev]} | ${REG[a.reg].name} | ${a.type} | ${a.status} | ${fmtDMHM(a.at)}`)].join('\n');
  if (kind === 'shel') return ['COLDALERT · Equipamentos de acolhimento', ...SHELTERS.map(s => `${s.name} | ${s.occ}/${s.cap} | ${s.status} | atualizado ${fmtDMHM(s.asOf)} (${ageText(shelterAge(s))}) | ${s.kind === 'hist' ? 'DADO HISTÓRICO' : 'DADO SIMULADO'}`)].join('\n');
  return ['COLDALERT · Situação por setor', ...overallAt(0).top.map(t => `${t.r.name} | índice ${fmt0(t.c.score)} (${t.c.cls.label}) | sensação ${fmt1(regionFeels(t.r, 0))} °C`)].join('\n');
}
function vRelatorios(root) {
  const kind = CUR.repKind || 'exec', paper = !!CUR.paper, ov = overallAt(0);
  const rep = (() => {
    const hd = `<header class="rp-hd"><div><b>COLDALERT</b><span>Relatório de gestão · São Bernardo do Campo — SP</span></div><div><span>Gerado em ${fmtLong(new Date())}</span><span class="demo-tag">DADOS SIMULADOS</span></div></header>`;
    if (kind === 'exec') return hd + `<h2>Resumo executivo</h2><p>No horário de referência, o setor de maior risco é o <b>${esc(ov.max.r.name)}</b>, com índice <b>${fmt0(ov.score)}</b> (${ov.cls.label.toLowerCase()}). A sensação térmica no município é de <b>${fmt1(feelsAt(0))} °C</b>. Há <b>${openAlerts().length}</b> alertas internos abertos e <b>${INCIDENTS.filter(i => i.status !== 'Concluída').length}</b> ocorrências em aberto.</p><div id="rp-c" class="rp-fig"></div><div class="tbl-w"><table class="tbl"><thead><tr><th>Setor</th><th>Índice</th><th>Classe</th><th>Sensação</th></tr></thead><tbody>${ov.top.map(t => `<tr><td>${esc(t.r.name)}</td><td class="num">${fmt0(t.c.score)}</td><td>${t.c.cls.label}</td><td class="num">${fmt1(regionFeels(t.r, 0))} °C</td></tr>`).join('')}</tbody></table></div><div class="gis" id="rp-m" style="height:300px"></div><p class="sm">Fontes: cenário de demonstração. Nenhuma fonte oficial conectada. Índice experimental.</p>`;
    if (kind === 'alerts') return hd + `<h2>Alertas internos</h2><div class="tbl-w"><table class="tbl"><thead><tr><th>ID</th><th>Severidade</th><th>Setor</th><th>Tipo</th><th>Situação</th><th>Data</th></tr></thead><tbody>${ALERTS.map(a => `<tr><td>${esc(a.id)}</td><td>${sevLabel[a.sev]}</td><td>${esc(a.reg)}</td><td>${esc(a.type)}</td><td>${esc(a.status)}</td><td>${fmtDMHM(a.at)}</td></tr>`).join('')}</tbody></table></div><p class="sm">Alertas internos de demonstração, sem valor oficial.</p>`;
    if (kind === 'shel') return hd + `<h2>Equipamentos de acolhimento</h2><div class="tbl-w"><table class="tbl"><thead><tr><th>Unidade</th><th>Ocupação</th><th>Status</th><th>Atualização</th><th>Estado do dado</th></tr></thead><tbody>${SHELTERS.map(s => `<tr><td>${esc(s.name)}</td><td class="num">${s.occ}/${s.cap}</td><td>${esc(s.status)}</td><td>${fmtDMHM(s.asOf)} (${ageText(shelterAge(s))})</td><td>${shelterStale(s) ? 'DADO HISTÓRICO' : 'DADO SIMULADO'}</td></tr>`).join('')}</tbody></table></div>`;
    return hd + `<h2>Situação por setor</h2><div class="tbl-w"><table class="tbl"><thead><tr><th>Setor</th><th>Índice</th><th>Classe</th><th>Temperatura</th><th>Sensação</th><th>Vento</th></tr></thead><tbody>${ov.top.map(t => `<tr><td>${esc(t.r.name)}</td><td class="num">${fmt0(t.c.score)}</td><td>${t.c.cls.label}</td><td class="num">${fmt1(regionTemp(t.r, 0))}</td><td class="num">${fmt1(regionFeels(t.r, 0))}</td><td class="num">${fmt0(regionWind(t.r, 0))}</td></tr>`).join('')}</tbody></table></div>`;
  })();
  root.innerHTML = pageHead('Relatórios de gestão', 'Resumos executivos, tabelas, gráficos e mapas', badge('sim')) + `
    <div class="filters">${selectHTML('rp-k', [['exec', 'Resumo executivo'], ['sect', 'Situação por setor'], ['alerts', 'Alertas internos'], ['shel', 'Equipamentos de acolhimento']], kind, 'Relatório')}
      <button class="btn ${paper ? 'primary' : ''}" id="rp-p">${ICON.print}<span>${paper ? 'Sair da versão para impressão' : 'Versão para impressão'}</span></button>
      <button class="btn ghost" id="rp-cp">Copiar texto</button>
      <button class="btn ghost" disabled title="Previsto para a implementação funcional">Exportar PDF</button><button class="btn ghost" disabled title="Previsto para a implementação funcional">Exportar CSV</button></div>
    <p class="sm dim">A exportação em PDF e CSV está prevista para a implementação funcional, com geração no servidor. Neste protótipo é possível visualizar a versão de impressão e copiar o texto do relatório.</p>
    <article class="report${paper ? ' paper' : ''}">${rep}</article>`;
  root.querySelector('#rp-k').addEventListener('change', e => { CUR.repKind = e.target.value; refreshView(); });
  root.querySelector('#rp-p').addEventListener('click', () => { CUR.paper = !CUR.paper; refreshView(); });
  root.querySelector('#rp-cp').addEventListener('click', () => {
    const txt = reportText(kind), ok = () => toast('Texto do relatório copiado.', 'ok');
    const fb = () => { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); let r = false; try { r = document.execCommand('copy'); } catch (e) { /* noop */ } ta.remove(); r ? ok() : toast('Não foi possível copiar. Selecione o texto do relatório manualmente.', 'err'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fb); else fb();
  });
  const c = root.querySelector('#rp-c');
  if (c) { const xs = []; for (let h = -12; h <= 36; h++) xs.push(h); chartLine(c, { xs, xfmt: x => (x === 0 ? 'agora' : (x > 0 ? '+' : '−') + Math.abs(x) + 'h'), tipx: x => hLabel(x), xstep: 12, series: [{ name: 'Índice (máx.)', vals: xs.map(h => overallAt(h).score), color: C.cyan, area: true }], ymin: 0, ymax: 100, tipfmt: v => fmt0(v), h: 200, label: 'Índice de risco' }); }
  const rm = root.querySelector('#rp-m'); if (rm) mkMap(rm, { kind: 'ops', mini: true, layers: false, slider: false, controls: false, legend: false, data: 'cri', ov: { priority: true }, panel: false });
}

/* ---------- 14. Banco de dados e fontes ---------- */
function vDados(root) {
  const flow = ['FONTES METEOROLÓGICAS', 'CARTOGRAFIA GIS', 'OBSERVAÇÃO DA TERRA', 'DADOS PÚBLICOS', 'REGISTROS OPERACIONAIS'];
  const chain = [['CAMADA DE INTEGRAÇÃO', 'conectores, validação e metadados de procedência'], ['BANCO DE DADOS', 'PostgreSQL + PostGIS'], ['MOTOR DE ANÁLISE', 'índice, previsão e recomendações'], ['DASHBOARD', 'centro de comando'], ['APOIO À DECISÃO PÚBLICA', 'decisão humana']];
  const ents = [['Acesso', 'usuarios, perfis, permissoes, trilha_auditoria'], ['Território', 'regioes (MultiPolygon, SIRGAS 2000)'], ['Clima', 'estacoes, observacoes, previsoes'], ['Observação da Terra', 'imagens_metadados, produtos_derivados'], ['Risco', 'indices_risco, fatores_indice, alertas'], ['Operação', 'ocorrencias, equipes, tarefas_campo'], ['Acolhimento', 'equipamentos, capacidade_disponibilidade'], ['Decisão e gestão', 'recomendacoes, historico_alteracoes, relatorios, fontes_dados']];
  root.innerHTML = pageHead('Banco de dados e fontes', 'Arquitetura de dados e transparência de procedência', badge('down', 'nenhuma integração ativa')) + `
    <div class="warn-box"><b>Estado real deste protótipo.</b> Não há banco de dados, autenticação, APIs nem monitoramento real em funcionamento. O que existe é a interface e um cenário de demonstração. As fontes abaixo estão <b>previstas</b>.</div>
    ${card('Fontes de dados', `<div class="tbl-w"><table class="tbl"><thead><tr><th>Fonte</th><th>Tipo</th><th>Estado</th><th>Observação</th></tr></thead><tbody>${SOURCES.map(s => `<tr><td><b>${esc(s.name)}</b><small>${esc(s.org)}</small></td><td>${esc(s.kind)}</td><td>${badge(s.status === 'sim' ? 'sim' : s.status === 'manual' ? 'manual' : s.status === 'live' ? 'live' : 'down')}</td><td>${esc(s.note)}</td></tr>`).join('')}</tbody></table></div>`)}
    ${card('Estados de dado usados em toda a interface', `<div class="legend-b">${['live', 'official', 'upd', 'hist', 'sim', 'down'].map(k => `<div>${badge(k)}<span>${{ live: 'Só aparece com integração ativa e atualizada.', official: 'Só aparece quando a origem é um órgão oficial integrado.', upd: 'Acompanha o horário da última carga recebida.', hist: 'Referência passada, com data e período.', sim: 'Gerado pelo protótipo para demonstração.', down: 'Origem prevista, mas sem conexão.' }[k]}</span></div>`).join('')}</div>`)}
    ${card('Fluxo de dados', `<div class="flow"><div class="fl-in">${flow.map(f => `<div class="fl-b src">${f}</div>`).join('')}</div><div class="fl-ar" aria-hidden="true">▶</div><div class="fl-ch">${chain.map((c, i) => `<div class="fl-b${i === 0 ? ' int' : ''}"><b>${c[0]}</b><small>${c[1]}</small></div>${i < chain.length - 1 ? '<div class="fl-ar sm" aria-hidden="true">▶</div>' : ''}`).join('')}</div></div>`)}
    ${card('Modelo de dados planejado (PostgreSQL/PostGIS)', `<div class="ents">${ents.map(e => `<div class="ent"><h4>${esc(e[0])}</h4><code>${esc(e[1])}</code></div>`).join('')}</div>
      <pre class="code" tabindex="0"><code>-- Exemplo ilustrativo (não executado neste protótipo)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE regioes (
  id          BIGSERIAL PRIMARY KEY,
  nome        TEXT NOT NULL,
  geom        GEOMETRY(MultiPolygon, 4674) NOT NULL,  -- SIRGAS 2000
  fonte_id    BIGINT REFERENCES fontes_dados(id)
);
CREATE INDEX regioes_geom_gix ON regioes USING GIST (geom);
CREATE TABLE indices_risco (
  id          BIGSERIAL PRIMARY KEY,
  regiao_id   BIGINT REFERENCES regioes(id),
  calculado_em TIMESTAMPTZ NOT NULL,
  valor       NUMERIC(5,2) NOT NULL,
  versao_modelo TEXT NOT NULL,    -- índice experimental até validação
  fatores     JSONB NOT NULL      -- fatores e pesos usados
);</code></pre>
      <p class="sm dim">Segurança: autenticação por perfis, chaves e credenciais apenas no servidor, nunca no navegador. Cada registro guarda fonte, data de aquisição e data de atualização.</p>`)}`;
}

/* ---------- 15. Configurações e acessos ---------- */
function vConfig(root) {
  const perms = [['Administrador', 'Gerencia usuários, fontes e parâmetros', 1, 1, 1, 1], ['Gestor / Coordenação', 'Aprova recomendações e relatórios', 1, 1, 0, 1], ['Analista', 'Consulta, análise e relatórios', 1, 0, 0, 1], ['Operador de campo', 'Registra ocorrências e tarefas', 1, 1, 0, 0], ['Leitura', 'Consulta sem dados sensíveis', 1, 0, 0, 0]];
  root.innerHTML = pageHead('Configurações e acessos', 'Perfis, território e parâmetros', badge('sim')) + protoNote('A autenticação ainda não existe. Esta tela mostra como os perfis serão organizados. O operador atual (“' + esc(OPERATOR) + '”) é fictício.') + `
    ${card('Perfis de acesso planejados', `<div class="tbl-w"><table class="tbl"><thead><tr><th>Perfil</th><th>Função</th><th>Consultar</th><th>Registrar</th><th>Configurar</th><th>Aprovar</th></tr></thead><tbody>${perms.map(p => `<tr><td><b>${p[0]}</b></td><td>${p[1]}</td>${p.slice(2).map(v => `<td class="num">${v ? '●' : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`)}
    <div class="cols-2">
      ${card('Território', `<p class="sm">${TERR.mode === 'geo' ? 'Malha importada: ' + esc(TERR.name) : 'Esquema hexagonal sem georreferência.'}</p><div class="row-gap"><button class="btn" id="cf-imp">Importar GeoJSON</button>${TERR.mode === 'geo' ? '<button class="btn ghost" id="cf-rst">Voltar ao esquema</button>' : ''}</div><p class="sm dim">Use a malha municipal do IBGE (código 3548708) em graus (longitude, latitude).</p>`, { right: badge(TERR.mode === 'geo' ? 'manual' : 'down') })}
      ${card('Parâmetros do índice', `<p class="sm">Pesos e limites são ajustados na tela Índice de risco. Aqui é possível voltar ao padrão.</p><div class="row-gap"><button class="btn ghost" id="cf-prm">Restaurar padrão do índice</button><button class="btn ghost" data-go="risco">Abrir Índice de risco</button></div>`)}
    </div>
    ${card('Privacidade e segurança', `<ul class="plain"><li>Nenhum dado pessoal identificável é exibido ou coletado neste protótipo.</li><li>Em produção: acesso por perfil, trilha de auditoria e minimização de dados.</li><li>Senhas, chaves de API e credenciais nunca ficam no navegador.</li><li>Dados agregados para vulnerabilidade territorial. Imagens de satélite não identificam pessoas.</li></ul>`)}
    ${card('O que este protótipo não faz', `<ul class="plain"><li>Não acessa banco de dados, APIs, estações nem satélites.</li><li>Não emite nem confirma alertas oficiais.</li><li>Não apresenta o globo com continentes: nenhuma fonte de contornos está embutida.</li><li>Não persiste alterações ao recarregar a página.</li></ul>`)}`;
  root.querySelector('#cf-imp').addEventListener('click', pickGeoFile);
  const r = root.querySelector('#cf-rst'); if (r) r.addEventListener('click', () => { resetTerritory(); refreshView(); });
  root.querySelector('#cf-prm').addEventListener('click', () => { PARAMS.w = JSON.parse(JSON.stringify(DEFAULT_PARAMS.w)); PARAMS.th = JSON.parse(JSON.stringify(DEFAULT_PARAMS.th)); bumpParams(); toast('Parâmetros restaurados.', 'ok'); });
}
