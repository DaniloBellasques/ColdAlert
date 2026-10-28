'use strict';
/* =====================================================================
   COLDALERT · módulos 1 a 6
   ===================================================================== */
const CUR = { cleanup: [] };
function mkMap(host, o) { const m = new GisMap(host, o); CUR.cleanup.push(() => m.destroy()); return m; }
function focusRegion(map, ri) {
  const c = TERR.centers[ri];
  map.sel = ri; map.v = { x: c.x, y: c.y, k: 2.2 }; map.refreshPanel(); map.draw();
}
const dirTxt = d => d > 1.5 ? 'subindo' : d < -1.5 ? 'caindo' : 'estável';
const arrow = d => d > 1.5 ? '▲' : d < -1.5 ? '▼' : '►';
function scoreColor(s) { return classify(s).color; }

/* Detalhe de marcadores do mapa */
function onMapMarker(type, ref) {
  if (type === 'shelter') {
    const s = ref, stale = shelterStale(s), pct = s.cap ? Math.round(100 * s.occ / s.cap) : 0;
    openModal(`<span class="eyebrow">EQUIPAMENTO PÚBLICO</span><h3>${esc(s.name)}</h3>
      ${stale ? `<div class="warn-box">Dado antigo (${ageText(shelterAge(s))}). Não deve ser lido como situação atual.</div>` : ''}
      <dl class="kv"><div><dt>Endereço</dt><dd>${esc(s.addr)}</dd></div><div><dt>Coordenadas</dt><dd>${esc(s.coord)}</dd></div><div><dt>Funcionamento</dt><dd>${esc(s.hours)}</dd></div>
      <div><dt>Capacidade</dt><dd>${s.cap} vagas</dd></div><div><dt>Ocupação</dt><dd>${s.occ} (${pct}%) · livres ${s.cap - s.occ}</dd></div><div><dt>Serviços</dt><dd>${esc(s.services.join(', '))}</dd></div>
      <div><dt>Status</dt><dd>${esc(s.status)}</dd></div><div><dt>Atualização</dt><dd>${fmtDMHM(s.asOf)} (${ageText(shelterAge(s))})</dd></div><div><dt>Fonte</dt><dd>${esc(s.src)}</dd></div><div><dt>Contato</dt><dd>${esc(s.contact)}</dd></div></dl>
      ${badge(s.kind === 'hist' ? 'hist' : 'sim')}`, { title: s.name });
  } else if (type === 'incident') openIncident(ref.id);
  else if (type === 'team') {
    const t = ref, tasks = TASKS.filter(x => x.team === t.name);
    openModal(`<span class="eyebrow">EQUIPE DE CAMPO</span><h3>${esc(t.name)}</h3><p>${esc(t.state)} · setor ${esc(t.reg)}. Posição de demonstração, sem rastreamento real.</p>
      ${tasks.length ? '<ul class="plain">' + tasks.map(x => `<li>${esc(x.title)} ${statusPill(x.status)}</li>`).join('') + '</ul>' : '<p class="dim">Sem tarefas atribuídas.</p>'}${badge('sim')}`, { title: t.name });
  }
}

/* ---------- 1. Visão geral ---------- */
function vOverview(root) {
  const ov = overallAt(0), ov6 = overallAt(-6), d = ov.score - ov6.score, cf = confidenceAt(0);
  const open = openAlerts(), openInc = INCIDENTS.filter(i => i.status !== 'Concluída').length;
  const free = SHELTERS.filter(s => s.kind === 'sim' && s.status !== 'Indisponível').reduce((a, s) => a + s.cap - s.occ, 0);
  const sparkVals = []; for (let h = -12; h <= 12; h++) sparkVals.push(overallAt(h).score);
  root.innerHTML = pageHead('Visão geral', 'COLDALERT COMMAND CENTER · São Bernardo do Campo — SP', badge('sim') + badge('down', 'fontes oficiais')) + `
    <div class="tiles">
      ${tile('Índice de risco (máx. dos setores)', fmt0(ov.score), `${ov.cls.label} · ${arrow(d)} ${d >= 0 ? '+' : ''}${fmt1(d)} em 6 h`, ov.cls.color, sparkSVG(sparkVals, 120, 26, ov.cls.color))}
      ${tile('Sensação térmica agora', fmt1(feelsAt(0)) + ' °C', `ar ${fmt1(tempAt(0))} °C · vento ${fmt0(windAt(0))} km/h`, '', '')}
      ${tile('Alertas internos abertos', open.length, `${open.filter(a => a.sev === 'critico' || a.sev === 'alto').length} altos ou críticos · demonstração`, '', '')}
      ${tile('Ocorrências em aberto', openInc, `${INCIDENTS.length} registradas · demonstração`, '', '')}
      ${tile('Vagas livres (unidades simuladas)', free, 'a unidade histórica não entra na soma', '', '')}
    </div>
    <div class="ov-grid">
      ${card('', '<div class="gis" id="ovmap"></div>', { cls: 'nopad ov-map' })}
      <div class="ov-side">
        ${card('Cold Risk Index', `<div class="gauge-w">${gaugeSVG(ov.score, ov.cls)}</div><p class="sm">Setor de maior risco: <b>${esc(ov.max.r.name)}</b>. Confiança da análise: <b>${fmt0(cf * 100)}%</b> (baixa: nenhuma fonte real conectada).</p>
          <div class="chips">${ov.top.slice(0, 3).map(t => `<button class="chip" data-focus="${t.r.idx}" style="--c:${t.c.cls.color}">${esc(t.r.name)} <b>${fmt0(t.c.score)}</b></button>`).join('')}</div>${protoNote('Índice experimental. Pesos e limites configuráveis em Índice de Risco.')}`, { right: badge('sim') })}
        ${card('Alertas que pedem atenção', open.slice().sort((a, b) => CLASSES[b.sev].rank - CLASSES[a.sev].rank).slice(0, 4).map(a => `<button class="row-btn" data-alert="${a.id}">${sevPill(a.sev)}<span><b>${esc(a.id)}</b> · ${esc(a.type)}<small>Setor ${esc(a.reg)} · ${statusPill(a.status)}</small></span></button>`).join('') || '<p class="dim">Nenhum alerta aberto.</p>', { right: '<button class="lnk" data-go="alertas">Central de alertas</button>' })}
      </div>
    </div>`;
  const m = mkMap(root.querySelector('#ovmap'), { kind: 'ops' });
  root.addEventListener('click', e => {
    const f = e.target.closest('[data-focus]'); if (f) focusRegion(m, +f.dataset.focus);
    const a = e.target.closest('[data-alert]'); if (a) { ALERT_SEL = a.dataset.alert; navigate('alertas'); }
  });
}

/* ---------- 2. Inteligência territorial ---------- */
function vTerritorial(root) {
  const ov = overallAt(0);
  root.innerHTML = pageHead('Inteligência territorial', 'Mapa operacional · setores · contexto municipal', badge('sim')) + `
    <div class="search-row"><label class="fld grow"><span>Pesquisar localidade, unidade ou ocorrência</span><input id="q" type="search" placeholder="Ex.: Setor E, Unidade demonstrativa 02, OCO-DEMO-001" autocomplete="off"></label></div>
    <div id="qres" class="q-res" hidden></div>
    ${card('', '<div class="gis tall" id="terrmap"></div>', { cls: 'nopad' })}
    <div class="cols-2">
      ${card('Setores por prioridade', `<div class="tbl-w"><table class="tbl"><thead><tr><th>Setor</th><th>Índice</th><th>Classe</th><th>Sensação</th><th>Déficit de acolhimento</th></tr></thead><tbody>${ov.top.map(t => `<tr data-ri="${t.r.idx}" tabindex="0" class="clk"><td><b>${esc(t.r.name)}</b></td><td class="num">${fmt0(t.c.score)}</td><td><span class="pill" style="--c:${t.c.cls.color}">${t.c.cls.label}</span></td><td class="num">${fmt1(regionFeels(t.r, 0))} °C</td><td class="num">${fmt0(t.r.deficit * 100)}%</td></tr>`).join('')}</tbody></table></div><p class="sm dim">Setores A–H são esquemáticos e não correspondem a bairros nem a regiões administrativas. Vulnerabilidade, exposição e déficit são valores de demonstração.</p>`, { right: badge('sim') })}
      ${card('Território', `<p class="sm">${TERR.mode === 'geo' ? 'Malha importada: <b>' + esc(TERR.name) + '</b>. Os setores continuam esquemáticos.' : 'O limite municipal oficial (IBGE, código 3548708) ainda não foi importado. O mapa usa um esquema hexagonal sem georreferência.'}</p>
        <div class="row-gap"><button class="btn" id="imp">Importar GeoJSON do município</button>${TERR.mode === 'geo' ? '<button class="btn ghost" id="rst">Voltar ao esquema</button>' : ''}</div>
        <p class="sm dim">O arquivo é lido apenas no seu navegador. Não é enviado a nenhum servidor.</p>`, { right: badge(TERR.mode === 'geo' ? 'manual' : 'down') })}
    </div>
    ${card('Contexto municipal', `<p class="sm">Fatos verificáveis, com fonte, data de publicação e período de referência. Nenhum número é tratado como atual. O conteúdo é editável abaixo sem reconstruir a interface.</p><div id="ctxl"></div>
      <details class="det"><summary>Adicionar ou atualizar um registro</summary><form id="ctxf" class="form-g">
        <label class="fld"><span>Indicador</span><input id="cx-k" required></label><label class="fld"><span>Valor</span><input id="cx-v" required></label>
        <label class="fld"><span>Período de referência</span><input id="cx-r" required placeholder="Ex.: maio de 2026"></label><label class="fld"><span>Data de publicação</span><input id="cx-p" required placeholder="dd/mm/aaaa"></label>
        <label class="fld"><span>Fonte</span><input id="cx-s" required></label><label class="fld"><span>Endereço da fonte (opcional)</span><input id="cx-u" type="url" placeholder="https://"></label>
        <div class="row-end full"><button class="btn primary" type="submit">Salvar registro</button></div></form></details>`, { right: badge('hist') })}`;
  const m = mkMap(root.querySelector('#terrmap'), { kind: 'ops' });
  const renderCtx = () => {
    root.querySelector('#ctxl').innerHTML = CONTEXT.map((c, i) => `<article class="ctx"><div><h4>${esc(c.k)}</h4><p>${esc(c.v)}</p><small>Referência: ${esc(c.ref)} · Publicado em ${esc(c.pub)} · Fonte: ${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.src)}</a>` : esc(c.src)}</small></div><div class="ctx-r">${badge('hist')}<button class="lnk" data-del="${i}">Remover</button></div></article>`).join('') || '<p class="dim">Nenhum registro.</p>';
  };
  renderCtx();
  root.querySelector('#ctxl').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) { CONTEXT.splice(+b.dataset.del, 1); renderCtx(); toast('Registro removido do contexto (protótipo).'); } });
  root.querySelector('#ctxf').addEventListener('submit', e => {
    e.preventDefault(); const v = id => root.querySelector('#' + id).value.trim();
    const rec = { k: v('cx-k'), v: v('cx-v'), ref: v('cx-r'), pub: v('cx-p'), src: v('cx-s'), url: /^https?:\/\//.test(v('cx-u')) ? v('cx-u') : '', status: 'hist' };
    const ix = CONTEXT.findIndex(c => c.k.toLowerCase() === rec.k.toLowerCase());
    if (ix >= 0) CONTEXT[ix] = rec; else CONTEXT.push(rec);
    renderCtx(); e.target.reset(); toast(ix >= 0 ? 'Registro atualizado.' : 'Registro adicionado.', 'ok');
  });
  root.querySelector('#imp').addEventListener('click', pickGeoFile);
  const rs = root.querySelector('#rst'); if (rs) rs.addEventListener('click', () => { resetTerritory(); refreshView(); });
  root.querySelector('tbody').addEventListener('click', e => { const tr = e.target.closest('[data-ri]'); if (tr) focusRegion(m, +tr.dataset.ri); });
  root.querySelector('tbody').addEventListener('keydown', e => { if (e.key === 'Enter') { const tr = e.target.closest('[data-ri]'); if (tr) focusRegion(m, +tr.dataset.ri); } });
  const q = root.querySelector('#q'), res = root.querySelector('#qres');
  q.addEventListener('input', () => {
    const t = q.value.trim().toLowerCase(); if (!t) { res.hidden = true; return; }
    const items = [];
    REGIONS.forEach(r => { if ((r.name + ' ' + r.id).toLowerCase().includes(t)) items.push({ l: r.name, s: 'Setor esquemático', f: () => focusRegion(m, r.idx) }); });
    SHELTERS.forEach(s => { if ((s.name + ' ' + s.addr).toLowerCase().includes(t)) items.push({ l: s.name, s: 'Equipamento · ' + s.addr, f: () => { m.v = { x: s.pos.x, y: s.pos.y, k: 2.6 }; m.st.ov.shelters = true; m.syncAll(); onMapMarker('shelter', s); } }); });
    INCIDENTS.forEach(o => { if ((o.id + ' ' + o.type).toLowerCase().includes(t)) items.push({ l: o.id, s: o.type, f: () => { m.v = { x: o.pos.x, y: o.pos.y, k: 2.6 }; m.st.ov.incidents = true; m.syncAll(); onMapMarker('incident', o); } }); });
    res.hidden = false;
    res.innerHTML = items.length ? items.slice(0, 8).map((it, i) => `<button class="row-btn" data-i="${i}"><span><b>${esc(it.l)}</b><small>${esc(it.s)}</small></span></button>`).join('') : '<p class="dim pad">Nenhum resultado. A busca por endereços e ruas depende de cartografia importada.</p>';
    res._items = items.slice(0, 8);
  });
  res.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b && res._items[+b.dataset.i]) { res._items[+b.dataset.i].f(); res.hidden = true; } });
}

/* ---------- 3. Observação da Terra ---------- */
function vEO(root) {
  const di = 5, mean = EO_DAYS.map((_, i) => eoMeanLST(i));
  const cover = EO_DAYS.map((_, i) => { const n = [0, 0, 0, 0]; TERR.cells.forEach(c => n[eoCover(c, i)]++); return n.map(v => v / TERR.cells.length * 100); });
  const inv = eoInvestigate(di);
  root.innerHTML = pageHead('Observação da Terra', 'EARTH OBSERVATION · sensoriamento remoto', badge('sim') + badge('down', 'sem produto conectado')) + `
    <div class="warn-box info"><b>Uso responsável.</b> Sensoriamento remoto descreve condições ambientais e características do território. Ele não identifica pessoas. Informações sobre pessoas e ocorrências vêm de registros autorizados, dados agregados e equipes de campo.</div>
    ${card('', '<div class="gis tall" id="eomap"></div>', { cls: 'nopad' })}
    <div class="cols-2">
      ${card('Metadados do produto', `<dl class="kv"><div><dt>Produto exibido</dt><dd id="eo-prod">—</dd></div><div><dt>Data de aquisição</dt><dd id="eo-date">—</dd></div><div><dt>Fonte</dt><dd>Nenhuma conectada (valores sintéticos)</dd></div><div><dt>Resolução espacial</dt><dd>Grade esquemática, sem escala</dd></div><div><dt>Produtos candidatos</dt><dd>Landsat (superfície), Sentinel-2 (cobertura e vegetação), MODIS/VIIRS (superfície, escala regional)</dd></div></dl>${badge('sim')}`)}
      ${card('Áreas que merecem investigação territorial', inv.length ? inv.map(x => `<button class="row-btn" data-ri="${x.ri}"><span><b>${esc(REGIONS[x.ri].name)}</b><small>Superfície ${fmt1(x.lst)} °C (+${fmt1(x.anom)} vs. média) · vegetação ${fmt0(x.green * 100)}%</small></span></button>`).join('') + '<p class="sm dim">Critério de demonstração: superfície mais de 0,6 °C acima da média e vegetação abaixo de 50%. Apontam onde olhar em campo, não onde há pessoas.</p>' : '<p class="dim">Nenhuma área acima do critério.</p>', { right: badge('sim') })}
    </div>
    <div class="cols-2">
      ${card('Evolução da temperatura média da superfície', '<div id="eo-c1"></div>', { right: badge('sim') })}
      ${card('Cobertura do solo por data (% das células)', '<div id="eo-c2"></div>', { right: badge('sim') })}
    </div>`;
  const m = mkMap(root.querySelector('#eomap'), { kind: 'eo' });
  const upd = () => { root.querySelector('#eo-prod').textContent = EO_LAYERS[m.eo.layer].label; root.querySelector('#eo-date').textContent = fmtDMY(eoDate(m.eo.d)) + ' (simulada)'; };
  upd(); root.querySelector('#eomap').addEventListener('click', () => setTimeout(upd, 0)); root.querySelector('#eomap').addEventListener('change', () => setTimeout(upd, 0));
  chartLine(root.querySelector('#eo-c1'), { xs: EO_DAYS, series: [{ name: 'Superfície (média)', vals: mean, color: C.warn, area: true }], xfmt: x => fmtDM(new Date(T0.getTime() + x * 24 * MS_H)), tipx: x => fmtDMY(new Date(T0.getTime() + x * 24 * MS_H)), xstep: 30, yfmt: v => fmt1(v) + '°', tipfmt: v => fmt1(v) + ' °C', h: 220, label: 'Temperatura média da superfície por data' });
  chartBars(root.querySelector('#eo-c2'), { cats: EO_DAYS.map((_, i) => fmtDM(eoDate(i))), series: COVER.map((c, k) => ({ name: c.label, color: rgbCss(c.rgb), vals: cover.map(r => r[k]) })), stack: true, ymax: 100, tipfmt: v => fmt1(v) + '%', yfmt: v => fmt0(v) + '%', h: 220, label: 'Cobertura do solo por data' });
  root.querySelectorAll('[data-ri]').forEach(b => b.addEventListener('click', () => focusRegion(m, +b.dataset.ri)));
}

/* ---------- 4. Monitoramento climático ---------- */
function vClima(root) {
  const range = CUR.climaRange || 'both';
  const lo = range === 'fc' ? 0 : -24, hi = range === 'obs' ? 0 : 72;
  const xs = []; for (let h = lo; h <= hi; h++) xs.push(h);
  root.innerHTML = pageHead('Monitoramento climático', 'Condições atmosféricas · município', badge('sim') + badge('down', 'INMET')) + `
    <div class="warn-box">Nenhuma estação meteorológica está conectada. Os valores abaixo vêm de um cenário de demonstração (frente fria sintética) e não descrevem o tempo real em São Bernardo do Campo.</div>
    <div class="tiles">
      ${tile('Temperatura do ar', fmt1(tempAt(0)) + ' °C', 'observação simulada', '', '')}
      ${tile('Sensação térmica', fmt1(feelsAt(0)) + ' °C', 'resfriamento pelo vento (fórmula de wind chill)', C.cyan, '')}
      ${tile('Vento', fmt0(windAt(0)) + ' km/h', 'média simulada', '', '')}
      ${tile('Umidade relativa', fmt0(humidAt(0)) + '%', 'simulada', '', '')}
      ${tile('Pressão', fmt0(pressAt(0)) + ' hPa', 'simulada', '', '')}
      ${tile('Precipitação', fmt1(precipAt(0)) + ' mm/h', 'simulada', '', '')}
    </div>
    <div class="seg" role="group" aria-label="Período">${[['obs', 'Últimas 24 h'], ['both', 'Observado e previsto'], ['fc', 'Próximas 72 h']].map(([k, l]) => `<button class="seg-b${range === k ? ' on' : ''}" data-r="${k}">${l}</button>`).join('')}</div>
    ${card('Temperatura e sensação térmica', '<div id="c1"></div>', { right: badge('sim') })}
    <div class="cols-2">${card('Vento (km/h)', '<div id="c2"></div>', { right: badge('sim') })}${card('Precipitação (mm/h)', '<div id="c3"></div>', { right: badge('sim') })}</div>
    ${card('Condição por setor agora', `<div class="tbl-w"><table class="tbl"><thead><tr><th>Setor</th><th>Temperatura</th><th>Sensação</th><th>Vento</th><th>Referência</th></tr></thead><tbody>${REGIONS.map(r => `<tr><td><b>${esc(r.name)}</b></td><td class="num">${fmt1(regionTemp(r, 0))} °C</td><td class="num">${fmt1(regionFeels(r, 0))} °C</td><td class="num">${fmt0(regionWind(r, 0))} km/h</td><td>${fmtDMHM(T0)}</td></tr>`).join('')}</tbody></table></div>`, { right: badge('sim') })}`;
  const vl = lo < 0 && hi > 0 ? [{ x: 0, label: 'agora', color: C.fg }] : [];
  const common = { xs, xfmt: x => (x === 0 ? 'agora' : (x > 0 ? '+' : '−') + Math.abs(x) + 'h'), tipx: x => hLabel(x) + ' · ' + fmtDMHM(tAt(x)), xstep: hi - lo > 50 ? 12 : 6, vlines: vl };
  chartLine(root.querySelector('#c1'), Object.assign({}, common, { series: [{ name: 'Temperatura do ar', vals: xs.map(tempAt), color: C.warn }, { name: 'Sensação térmica', vals: xs.map(feelsAt), color: C.cyan, area: true }], yfmt: v => fmt0(v) + '°', tipfmt: v => fmt1(v) + ' °C', hlines: [{ y: 10, color: C.crit, label: 'sensação 10 °C' }], label: 'Temperatura do ar e sensação térmica' }));
  chartLine(root.querySelector('#c2'), Object.assign({}, common, { series: [{ name: 'Vento', vals: xs.map(windAt), color: C.blue, area: true }], ymin: 0, tipfmt: v => fmt0(v) + ' km/h', h: 200, label: 'Vento' }));
  chartBars(root.querySelector('#c3'), { cats: xs.filter(x => x % 6 === 0).map(x => hLabel(x)), series: [{ name: 'Precipitação', color: C.blue, vals: xs.filter(x => x % 6 === 0).map(precipAt) }], tipfmt: v => fmt1(v) + ' mm/h', yfmt: v => fmt1(v), h: 200, label: 'Precipitação' });
  root.querySelector('.seg').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { CUR.climaRange = b.dataset.r; refreshView(); } });
}

/* ---------- 5. Índice de risco de frio ---------- */
function vRisco(root) {
  const ov = overallAt(0), ov6 = overallAt(-6), d = ov.score - ov6.score, cf = confidenceAt(0), top = [...ov.max.c.contrib].sort((a, b) => b.pts - a.pts);
  const pk = (() => { let b = { h: 0, s: -1 }; for (let h = 0; h <= 72; h++) { const s = overallAt(h).score; if (s > b.s) b = { h, s }; } return b; })();
  const explain = top.slice(0, 3).map(t => {
    const f = ov.max.c.f;
    if (t.key === 'temp') return `A sensação térmica de ${fmt1(regionFeels(ov.max.r, 0))} °C no ${ov.max.r.name} contribui com ${fmt1(t.pts)} pontos.`;
    if (t.key === 'vuln') return `A vulnerabilidade agregada do setor (${fmt1(f.vuln)} em 1) soma ${fmt1(t.pts)} pontos.`;
    if (t.key === 'dur') return `Em ${fmt0(f.dur * 24)} das próximas 24 h a sensação fica abaixo de 10 °C, o que soma ${fmt1(t.pts)} pontos.`;
    return `${t.label} soma ${fmt1(t.pts)} pontos.`;
  });
  root.innerHTML = pageHead('Índice de risco de frio', 'COLD RISK INDEX · protótipo experimental', badge('sim')) + protoNote('Este índice não é um modelo validado nem oficial. É uma soma ponderada e transparente de fatores, com pesos e limites configuráveis abaixo.') + `
    <div class="cols-risk">
      ${card('Situação agora', `<div class="gauge-w big">${gaugeSVG(ov.score, ov.cls)}</div>
        <dl class="kv"><div><dt>Classificação</dt><dd><span class="pill" style="--c:${ov.cls.color}">${ov.cls.label}</span></dd></div><div><dt>Tendência (vs. 6 h antes)</dt><dd>${arrow(d)} ${dirTxt(d)} (${d >= 0 ? '+' : ''}${fmt1(d)} pontos)</dd></div>
        <div><dt>Pico previsto (72 h)</dt><dd>${fmt0(pk.s)} pontos · ${hLabel(pk.h)} (${fmtDMHM(tAt(pk.h))})</dd></div><div><dt>Grau de confiança</dt><dd>${fmt0(cf * 100)}% <small class="dim">teto baixo: 0 de ${SOURCES.length} fontes reais conectadas</small></dd></div>
        <div><dt>Calculado em</dt><dd>${fmtDMHM(T0)} · fontes: cenário simulado</dd></div></dl>`, { right: badge('sim') })}
      ${card('Por que este índice?', `<ul class="plain why">${explain.map(t => `<li>${esc(t)}</li>`).join('')}</ul><div id="fbars"></div>`, { right: `<span class="dim sm">${esc(ov.max.r.name)}</span>` })}
    </div>
    ${card('Evolução prevista do índice (setor de maior risco)', '<div id="evo"></div>', { right: badge('sim') })}
    <div class="cols-2">
      ${card('Regiões prioritárias', `<div id="rk"></div>`, { right: badge('sim') })}
      ${card('Parâmetros do índice', `<p class="sm">Pesos relativos (normalizados) e limites de classe. Alterações recalculam todo o sistema em tempo real.</p><div id="prm"></div><div class="row-end"><button class="btn ghost" id="prst">Restaurar padrão</button></div>`)}
    </div>
    ${card('Fatores e método', `<div class="tbl-w"><table class="tbl"><thead><tr><th>Fator</th><th>Como entra</th><th>Peso</th></tr></thead><tbody>${Object.keys(FACTOR_META).map(k => `<tr><td><b>${esc(FACTOR_META[k].label)}</b></td><td>${esc(FACTOR_META[k].hint)}</td><td class="num" id="w-${k}">${fmt0(PARAMS.w[k] / Object.values(PARAMS.w).reduce((a, b) => a + b, 0) * 100)}%</td></tr>`).join('')}</tbody></table></div><p class="sm dim">Índice = 100 × Σ(fator × peso normalizado). Cada fator vai de 0 a 1. Limites padrão: baixo &lt; 25, moderado &lt; 45, alto &lt; 65, crítico a partir de 65.</p>`)}`;
  chartBars(root.querySelector('#fbars'), { cats: top.map(t => t.label.split(' ')[0]), series: [{ name: 'Pontos', color: C.cyan, vals: top.map(t => t.pts) }], h: 180, tipfmt: v => fmt1(v) + ' pts', yfmt: fmt0, label: 'Contribuição por fator' });
  const xs = []; for (let h = -12; h <= 72; h++) xs.push(h);
  chartLine(root.querySelector('#evo'), { xs, xfmt: x => (x === 0 ? 'agora' : (x > 0 ? '+' : '−') + Math.abs(x) + 'h'), tipx: x => hLabel(x) + ' · ' + fmtDMHM(tAt(x)), xstep: 12, series: [{ name: 'Índice (máx. setores)', vals: xs.map(h => overallAt(h).score), color: C.cyan, area: true }, { name: 'Índice médio', vals: xs.map(h => overallAt(h).mean), color: C.blue, dash: '4 3' }], ymin: 0, ymax: 100, bands: [{ x0: -12, x1: 72, color: 'transparent' }], hlines: [{ y: PARAMS.th.mod, color: C.yel, label: 'moderado' }, { y: PARAMS.th.high, color: C.crit, label: 'crítico' }], vlines: [{ x: 0, label: 'agora', color: C.fg }], tipfmt: v => fmt0(v), label: 'Evolução do índice' });
  root.querySelector('#rk').innerHTML = ov.top.map(t => `<div class="rk"><span>${esc(t.r.name)}</span><div class="rk-bar"><i style="width:${t.c.score}%;background:${t.c.cls.color}"></i></div><b>${fmt0(t.c.score)}</b></div>`).join('');
  const prm = root.querySelector('#prm');
  const drawPrm = () => {
    prm.innerHTML = `<div class="sl-g">${Object.keys(PARAMS.w).map(k => `<label class="sl"><span>${esc(FACTOR_META[k].label)}</span><input type="range" min="0" max="40" step="1" value="${Math.round(PARAMS.w[k] * 100)}" data-w="${k}"><b>${Math.round(PARAMS.w[k] * 100)}</b></label>`).join('')}</div>
    <div class="sl-g th">${[['low', 'Limite baixo → moderado'], ['mod', 'Limite moderado → alto'], ['high', 'Limite alto → crítico']].map(([k, l]) => `<label class="sl"><span>${l}</span><input type="range" min="5" max="95" step="1" value="${PARAMS.th[k]}" data-t="${k}"><b>${PARAMS.th[k]}</b></label>`).join('')}</div>`;
  };
  drawPrm();
  prm.addEventListener('input', e => {
    const w = e.target.dataset.w, t = e.target.dataset.t, v = +e.target.value;
    if (w) PARAMS.w[w] = v / 100;
    if (t) { PARAMS.th[t] = v; const o = ['low', 'mod', 'high']; for (let i = 1; i < 3; i++) if (PARAMS.th[o[i]] <= PARAMS.th[o[i - 1]]) PARAMS.th[o[i]] = Math.min(98, PARAMS.th[o[i - 1]] + 1); }
    bumpParams(); clearTimeout(vRisco._t); vRisco._t = setTimeout(() => { const y = document.getElementById('main').scrollTop; refreshView(); document.getElementById('main').scrollTop = y; }, 180);
    e.target.nextElementSibling.textContent = e.target.value;
  });
  root.querySelector('#prst').addEventListener('click', () => { PARAMS.w = JSON.parse(JSON.stringify(DEFAULT_PARAMS.w)); PARAMS.th = JSON.parse(JSON.stringify(DEFAULT_PARAMS.th)); bumpParams(); refreshView(); toast('Parâmetros restaurados ao padrão.', 'ok'); });
}

/* ---------- 6. Previsão de risco ---------- */
function vPrevisao(root) {
  const H = CUR.horizon || 24;
  const xs = []; for (let h = 0; h <= H; h++) xs.push(h);
  const drop = tempAt(0) - Math.min(...xs.map(tempAt));
  // períodos críticos
  const per = []; let cur = null;
  xs.forEach(h => { const s = overallAt(h).score; if (s >= PARAMS.th.high) { if (!cur) cur = { a: h, b: h, m: s }; cur.b = h; cur.m = Math.max(cur.m, s); } else if (cur) { per.push(cur); cur = null; } });
  if (cur) per.push(cur);
  const pkh = xs.reduce((b, h) => overallAt(h).score > overallAt(b).score ? h : b, 0), pk = overallAt(pkh);
  const obsX = []; for (let h = -24; h <= 0; h++) obsX.push(h);
  const mae = obsX.reduce((a, h) => a + Math.abs(fcTempAt(h) - obsTempAt(h)), 0) / obsX.length;
  root.innerHTML = pageHead('Previsão de risco', 'Horizonte operacional', badge('sim') + badge('down', 'previsão oficial')) + `
    <div class="seg" role="group" aria-label="Horizonte">${[6, 12, 24, 48, 72].map(h => `<button class="seg-b${H === h ? ' on' : ''}" data-h="${h}">${h} h</button>`).join('')}</div>
    <div class="prov-row">${badge('sim')}<span>Origem: cenário de demonstração · emitida em ${fmtDMHM(T0)} · válida até ${fmtDMHM(tAt(H))}. Nenhum serviço meteorológico conectado.</span></div>
    ${drop >= 5 ? `<div class="warn-box crit"><b>Queda significativa de temperatura.</b> Previsão de queda de ${fmt1(drop)} °C nas próximas ${H} h, com mínima de ${fmt1(Math.min(...xs.map(tempAt)))} °C.</div>` : ''}
    ${card('Temperatura e sensação térmica prevista', '<div id="p1"></div>', { right: badge('sim') })}
    <div class="cols-2">${card('Vento e precipitação', '<div id="p2"></div>', { right: badge('sim') })}${card('Evolução do índice de risco', '<div id="p3"></div>', { right: badge('sim') })}</div>
    <div class="cols-2">
      ${card('Períodos críticos previstos', per.length ? per.map(p => `<div class="row-i"><b>${fmtDMHM(tAt(p.a))} a ${fmtHM(tAt(p.b + 1))}</b><span>${p.b - p.a + 1} h · pico ${fmt0(p.m)} pontos</span></div>`).join('') : '<p class="dim">Nenhum período acima do limite crítico neste horizonte.</p>')}
      ${card('Setores que podem precisar de mais atenção', pk.top.slice(0, 4).map(t => `<div class="rk"><span>${esc(t.r.name)}</span><div class="rk-bar"><i style="width:${t.c.score}%;background:${t.c.cls.color}"></i></div><b>${fmt0(t.c.score)}</b></div>`).join('') + `<p class="sm dim">Valores no pico previsto (${hLabel(pkh)}, ${fmtDMHM(tAt(pkh))}).</p>`, { right: badge('sim') })}
    </div>
    ${card('Previsão emitida 24 h antes × observação (últimas 24 h)', `<div id="p4"></div><p class="sm">Erro médio absoluto: <b>${fmt1(mae)} °C</b>. Ambas as séries são sintéticas e só demonstram o comparativo que será calculado com dados reais.</p>`, { right: badge('sim') })}`;
  const common = { xfmt: x => (x === 0 ? 'agora' : '+' + x + 'h'), tipx: x => hLabel(x) + ' · ' + fmtDMHM(tAt(x)), xstep: H <= 12 ? 2 : H <= 24 ? 4 : H <= 48 ? 6 : 12 };
  chartLine(root.querySelector('#p1'), Object.assign({ xs, series: [{ name: 'Temperatura do ar', vals: xs.map(tempAt), color: C.warn }, { name: 'Sensação térmica', vals: xs.map(feelsAt), color: C.cyan, area: true }], yfmt: v => fmt0(v) + '°', tipfmt: v => fmt1(v) + ' °C', hlines: [{ y: 10, color: C.crit, label: 'sensação 10 °C' }], label: 'Temperatura prevista' }, common));
  chartLine(root.querySelector('#p2'), Object.assign({ xs, series: [{ name: 'Vento (km/h)', vals: xs.map(windAt), color: C.blue }, { name: 'Precipitação (mm/h × 10)', vals: xs.map(h => precipAt(h) * 10), color: C.cyan, dash: '4 3' }], ymin: 0, tipfmt: v => fmt1(v), h: 220, label: 'Vento e precipitação' }, common));
  chartLine(root.querySelector('#p3'), Object.assign({ xs, series: [{ name: 'Índice (máx. setores)', vals: xs.map(h => overallAt(h).score), color: C.cyan, area: true }], ymin: 0, ymax: 100, hlines: [{ y: PARAMS.th.high, color: C.crit, label: 'crítico' }, { y: PARAMS.th.mod, color: C.yel, label: 'alto' }], tipfmt: v => fmt0(v), h: 220, label: 'Índice previsto' }, common));
  chartLine(root.querySelector('#p4'), { xs: obsX, xfmt: x => (x === 0 ? 'agora' : '−' + Math.abs(x) + 'h'), tipx: x => hLabel(x), xstep: 4, series: [{ name: 'Observado', vals: obsX.map(obsTempAt), color: C.fg }, { name: 'Previsto (emitido −24 h)', vals: obsX.map(fcTempAt), color: C.warn, dash: '5 3' }], yfmt: v => fmt0(v) + '°', tipfmt: v => fmt1(v) + ' °C', h: 220, label: 'Previsto versus observado' });
  root.querySelector('.seg').addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) { CUR.horizon = +b.dataset.h; refreshView(); } });
}
