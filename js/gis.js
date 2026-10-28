'use strict';
/* =====================================================================
   COLDALERT · motor GIS do protótipo
   - Território ESQUEMÁTICO (grade hexagonal, sem georreferência) ou
     malha GeoJSON importada pelo operador (ex.: IBGE 3548708).
   - Camadas operacionais e de Observação da Terra, tudo SIMULADO.
   ===================================================================== */

const HEX_S = 0.047, SQ3 = Math.sqrt(3);
const HEXV = [0, 1, 2, 3, 4, 5].map(j => [Math.cos((60 * j - 30) * Math.PI / 180), Math.sin((60 * j - 30) * Math.PI / 180)]);

const RISK_STOPS = [[0, [22, 139, 255]], [25, [54, 217, 255]], [45, [245, 213, 71]], [65, [255, 159, 67]], [85, [255, 77, 94]], [100, [255, 77, 94]]];
const TEMP_STOPS = [[2, [22, 110, 255]], [8, [54, 217, 255]], [13, [245, 213, 71]], [18, [255, 159, 67]], [24, [255, 77, 94]]];
const NDVI_STOPS = [[0, [38, 44, 52]], [0.35, [70, 100, 60]], [0.65, [48, 168, 102]], [1, [150, 240, 150]]];
const URB_STOPS = [[0, [24, 40, 62]], [0.5, [92, 112, 150]], [1, [214, 226, 245]]];
const DIV_STOPS = [[-6, [22, 139, 255]], [0, [28, 40, 58]], [6, [255, 77, 94]]];
function gradRGB(v, stops) {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (v - a) / (b - a || 1);
      return [lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t)];
    }
  }
  return stops[stops.length - 1][1];
}
const rgbCss = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? 1 : a})`;
const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function cssGradient(stops, min, max) {
  return 'linear-gradient(90deg,' + stops.map(s => rgbCss(s[1]) + ' ' + Math.round((s[0] - min) / (max - min) * 100) + '%').join(',') + ')';
}

/* ---------- Território ---------- */
function pip(x, y, ring) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
  }
  return ins;
}
function insidePoly(x, y, polys) {
  for (const p of polys) {
    if (pip(x, y, p[0])) {
      let hole = false;
      for (let k = 1; k < p.length; k++) if (pip(x, y, p[k])) { hole = true; break; }
      if (!hole) return true;
    }
  }
  return false;
}
function blobR(th) { return 0.80 + 0.10 * Math.cos(2 * th + 0.6) + 0.07 * Math.sin(3 * th + 1.1) + 0.04 * Math.cos(5 * th + 0.3); }
const cellKey = (x, y) => Math.round(x / (0.5 * SQ3 * HEX_S)) + ',' + Math.round(y / (1.5 * HEX_S));

function buildTerritory(inside, meta) {
  const s = HEX_S, cells = [], byKey = new Map();
  for (let row = -34; row <= 34; row++) {
    for (let col = -34; col <= 34; col++) {
      const x = (col + (row & 1 ? 0.5 : 0)) * SQ3 * s, y = row * 1.5 * s;
      if (!inside(x, y)) continue;
      const c = { x, y, key: cellKey(x, y), reg: 0 };
      c.n = fbm2(x * 3.3, y * 3.3, 5); c.n2 = fbm2(x * 2.4, y * 2.4, 101); c.n3 = fbm2(x * 3.7 + 5, y * 3.7 - 2, 202); c.el = fbm2(x * 2, y * 2, 77);
      cells.push(c); byKey.set(c.key, c);
    }
  }
  if (!cells.length) throw new Error('A malha não gerou nenhuma célula. Verifique as coordenadas do arquivo.');
  const n = REGIONS.length;
  const cen = { x: cells.reduce((a, c) => a + c.x, 0) / cells.length, y: cells.reduce((a, c) => a + c.y, 0) / cells.length };
  const maxR = Math.max(...cells.map(c => Math.hypot(c.x - cen.x, c.y - cen.y)));
  let seeds = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2 * Math.PI / n - Math.PI / 2, tx = cen.x + Math.cos(a) * maxR * 0.55, ty = cen.y + Math.sin(a) * maxR * 0.55;
    let best = cells[0], bd = Infinity;
    cells.forEach(c => { const d = (c.x - tx) ** 2 + (c.y - ty) ** 2; if (d < bd) { bd = d; best = c; } });
    seeds.push({ x: best.x, y: best.y });
  }
  for (let it = 0; it < 9; it++) {
    const acc = seeds.map(() => ({ x: 0, y: 0, n: 0 }));
    cells.forEach(c => {
      let bi = 0, bd = Infinity;
      seeds.forEach((sd, i) => { const d = (c.x - sd.x) ** 2 + (c.y - sd.y) ** 2; if (d < bd) { bd = d; bi = i; } });
      c.reg = bi; acc[bi].x += c.x; acc[bi].y += c.y; acc[bi].n++;
    });
    seeds = seeds.map((sd, i) => acc[i].n ? { x: acc[i].x / acc[i].n, y: acc[i].y / acc[i].n } : sd);
  }
  const order = seeds.map((sd, i) => ({ i, a: (Math.atan2(sd.y - cen.y, sd.x - cen.x) + Math.PI / 2 + 4 * Math.PI) % (2 * Math.PI) })).sort((p, q) => p.a - q.a);
  const remap = []; order.forEach((o, ni) => { remap[o.i] = ni; });
  cells.forEach(c => { c.reg = remap[c.reg]; });
  cells.forEach((c, i) => { c.i = i; });
  const byReg = REGIONS.map(() => []);
  cells.forEach(c => byReg[c.reg].push(c));
  const centers = byReg.map(list => {
    if (!list.length) return { x: cen.x, y: cen.y };
    const mx = list.reduce((a, c) => a + c.x, 0) / list.length, my = list.reduce((a, c) => a + c.y, 0) / list.length;
    let best = list[0], bd = Infinity;
    list.forEach(c => { const d = (c.x - mx) ** 2 + (c.y - my) ** 2; if (d < bd) { bd = d; best = c; } });
    return { x: best.x, y: best.y };
  });
  const regionEdges = REGIONS.map(() => []), borderSegs = [], outlineSegs = [];
  cells.forEach(c => {
    for (let k = 0; k < 6; k++) {
      const ang = k * Math.PI / 3;
      const nb = byKey.get(cellKey(c.x + SQ3 * s * Math.cos(ang), c.y + SQ3 * s * Math.sin(ang)));
      const v0 = HEXV[k], v1 = HEXV[(k + 1) % 6], rr = s * 0.985;
      const seg = [c.x + v0[0] * rr, c.y + v0[1] * rr, c.x + v1[0] * rr, c.y + v1[1] * rr];
      if (!nb) { outlineSegs.push(seg); regionEdges[c.reg].push(seg); }
      else if (nb.reg !== c.reg) { regionEdges[c.reg].push(seg); if (c.i < nb.i) borderSegs.push(seg); }
    }
  });
  const T = Object.assign({ cells, byKey, byReg, centers, regionEdges, borderSegs, outlineSegs, mode: 'schematic', rings: null }, meta || {});
  T.regionAt = (x, y) => {
    let best = cells[0], bd = Infinity;
    for (let i = 0; i < cells.length; i++) { const c = cells[i], d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = c; } }
    return best.reg;
  };
  T.nearestCell = (x, y, maxD) => {
    let best = null, bd = (maxD || Infinity) ** 2;
    for (let i = 0; i < cells.length; i++) { const c = cells[i], d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = c; } }
    return best;
  };
  return T;
}
function buildSchematicTerritory() {
  return buildTerritory((x, y) => Math.hypot(x, y) < blobR(Math.atan2(y, x)) * 0.98, { mode: 'schematic', name: 'Esquema operacional (sem georreferência)' });
}
function placeEntities() {
  const T = TERR;
  INCIDENTS.forEach((o, i) => {
    const ri = REG[o.reg].idx, list = T.byReg[ri];
    if (!list.length) return;
    const c = list[Math.floor(hash2(i, ri, 7) * list.length) % list.length];
    o.pos = { x: c.x + (hash2(i, 3, 1) - 0.5) * HEX_S, y: c.y + (hash2(i, 4, 2) - 0.5) * HEX_S };
  });
  TEAMS.forEach((t, i) => {
    const ri = REG[t.reg].idx, ce = T.centers[ri];
    t.pos = { x: ce.x + (hash2(i, 9, 3) - 0.5) * HEX_S * 2, y: ce.y + (hash2(i, 8, 4) - 0.5) * HEX_S * 2 };
  });
  SHELTERS.forEach(s => {
    const c = T.nearestCell(s.pos.x, s.pos.y);
    if (c) { s.pos = { x: c.x, y: c.y }; s.regIdx = c.reg; s.reg = REGIONS[c.reg].id; }
  });
}
function setSchematic() { TERR = buildSchematicTerritory(); placeEntities(); }

/* ---------- Importação de malha GeoJSON ---------- */
function geoPolys(obj) {
  const out = [];
  const add = g => {
    if (!g) return;
    if (g.type === 'Polygon') out.push(g.coordinates);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(c => out.push(c));
    else if (g.type === 'GeometryCollection') (g.geometries || []).forEach(add);
  };
  if (obj.type === 'FeatureCollection') (obj.features || []).forEach(f => add(f.geometry));
  else if (obj.type === 'Feature') add(obj.geometry);
  else add(obj);
  return out;
}
function importGeoJSON(text, fileName) {
  const obj = JSON.parse(text);
  const polys = geoPolys(obj);
  if (!polys.length) throw new Error('Nenhum polígono (Polygon ou MultiPolygon) encontrado no arquivo.');
  let minLon = 1e9, maxLon = -1e9, minLat = 1e9, maxLat = -1e9;
  polys.forEach(p => p[0].forEach(pt => {
    if (!isFinite(pt[0]) || !isFinite(pt[1])) return;
    minLon = Math.min(minLon, pt[0]); maxLon = Math.max(maxLon, pt[0]); minLat = Math.min(minLat, pt[1]); maxLat = Math.max(maxLat, pt[1]);
  }));
  if (Math.abs(minLon) > 180 || Math.abs(maxLon) > 180 || Math.abs(minLat) > 90 || Math.abs(maxLat) > 90) throw new Error('As coordenadas precisam estar em graus (longitude, latitude), como no padrão GeoJSON.');
  const lonC = (minLon + maxLon) / 2, latC = (minLat + maxLat) / 2, kx = Math.cos(latC * Math.PI / 180);
  const sc = 1.9 / Math.max((maxLon - minLon) * kx, maxLat - minLat, 1e-6);
  const conv = ring => {
    const stride = Math.max(1, Math.ceil(ring.length / 2500));
    const r = [];
    for (let i = 0; i < ring.length; i += stride) r.push([(ring[i][0] - lonC) * kx * sc, -(ring[i][1] - latC) * sc]);
    return r;
  };
  const up = polys.map(p => p.map(conv));
  const T = buildTerritory((x, y) => insidePoly(x, y, up), { mode: 'geo', name: fileName || 'GeoJSON importado' });
  T.rings = up;
  T.toLL = (x, y) => ({ lon: lonC + x / (kx * sc), lat: latC - y / sc });
  T.kmPerUnit = 111.195 / sc;
  T.bbox = { minLon, maxLon, minLat, maxLat };
  TERR = T;
  placeEntities();
  const src = SOURCES.find(s => s.id === 'ibge');
  if (src) { src.status = 'manual'; src.note = 'Malha importada manualmente de arquivo local (' + (fileName || 'GeoJSON') + '). Setores continuam esquemáticos.'; }
  MAPSTATE.sel = null;
  GIS_LIST.forEach(m => m.onTerritory());
  return T;
}
function resetTerritory() {
  setSchematic();
  const src = SOURCES.find(s => s.id === 'ibge');
  if (src) { src.status = 'down'; src.note = 'Limite municipal oficial (código 3548708) ainda não importado. Importe um GeoJSON em Configurações.'; }
  MAPSTATE.sel = null;
  GIS_LIST.forEach(m => m.onTerritory());
}

/* ---------- Observação da Terra (valores simulados) ---------- */
const EO_DAYS = [-150, -120, -90, -60, -30, 0];
function eoDate(i) { return new Date(T0.getTime() + EO_DAYS[i] * 24 * MS_H); }
const EO_LAYERS = {
  cover: { label: 'Cobertura do solo' },
  green: { label: 'Áreas verdes (índice de vegetação)' },
  urban: { label: 'Densidade de ocupação urbana' },
  lst: { label: 'Temperatura da superfície terrestre' },
  evol: { label: 'Evolução (data selecionada − mais recente)' }
};
const COVER = [
  { k: 'urb', label: 'Área urbanizada', rgb: [126, 143, 168] },
  { k: 'veg', label: 'Vegetação', rgb: [47, 168, 102] },
  { k: 'agua', label: 'Água', rgb: [22, 139, 255] },
  { k: 'solo', label: 'Solo exposto', rgb: [181, 138, 74] }
];
function eoSeason(di) { return Math.cos(2 * Math.PI * ((EO_DAYS[di] - 40) / 365)); }
function eoGreen(c, di) { return clamp(c.n2 * 0.95 + 0.10 * eoSeason(di) - 0.04, 0, 1); }
function eoUrban(c) { return clamp(1.02 - c.n2 * 0.92 + 0.12 * (c.n3 - 0.5), 0, 1); }
function eoLST(c, di) { return 12.5 + 9.5 * eoUrban(c) - 3.5 * eoGreen(c, di) + 4.2 * eoSeason(di) * -1 + 1.5 * (c.n - 0.5); }
function eoCover(c, di) {
  if (c.n3 > 0.80) return 2;
  if (eoGreen(c, di) > 0.58) return 1;
  if (c.n2 < 0.30 && c.n < 0.45) return 3;
  return 0;
}
function eoRegionStats(ri, di) {
  const list = TERR.byReg[ri];
  const n = list.length || 1;
  const lst = list.reduce((a, c) => a + eoLST(c, di), 0) / n;
  const gr = list.reduce((a, c) => a + eoGreen(c, di), 0) / n;
  const ur = list.reduce((a, c) => a + eoUrban(c), 0) / n;
  return { lst, green: gr, urban: ur };
}
function eoMeanLST(di) { return TERR.cells.reduce((a, c) => a + eoLST(c, di), 0) / TERR.cells.length; }

/* ---------- Mapa ---------- */
let GIS_ID = 0;
const GIS_LIST = new Set();
const MAPSTATE = { base: 'esquema', data: 'cri', ov: { shelters: true, incidents: true, teams: true, priority: true }, hour: 0, sel: null };

const BASES = [
  { k: 'esquema', label: 'Esquema operacional', tag: '' },
  { k: 'cartografico', label: 'Mapa cartográfico', tag: 'IND' },
  { k: 'satelite', label: 'Imagem de satélite', tag: 'SIM' },
  { k: 'relevo', label: 'Relevo e topografia', tag: 'SIM' }
];
const DATALAYERS = [
  { k: 'none', label: 'Somente base' },
  { k: 'temp', label: 'Temperatura observada' },
  { k: 'feels', label: 'Sensação térmica' },
  { k: 'expo', label: 'Áreas de maior exposição' },
  { k: 'cri', label: 'Índice territorial de risco de frio' },
  { k: 'hist', label: 'Dados históricos (recorrência)' }
];
const OVLAYERS = [
  { k: 'shelters', label: 'Abrigos e equipamentos públicos' },
  { k: 'incidents', label: 'Ocorrências registradas' },
  { k: 'teams', label: 'Equipes de campo' },
  { k: 'priority', label: 'Áreas prioritárias de atendimento' }
];

class GisMap {
  constructor(host, o) {
    this.id = ++GIS_ID;
    this.host = host;
    this.o = Object.assign({ kind: 'ops', layers: true, controls: true, slider: true, legend: true, panel: true, mini: false, ov: null, data: null }, o || {});
    this.st = this.o.mini ? { base: 'esquema', data: this.o.data || 'cri', ov: Object.assign({ shelters: false, incidents: false, teams: false, priority: false }, this.o.ov || {}), hour: 0, sel: null } : MAPSTATE;
    this.eo = { layer: 'cover', da: 0, d: 5, compare: false, swipe: 0.5, sel: null };
    this.v = { x: 0, y: 0, k: 1 };
    this.pointers = new Map();
    this.drag = null; this.hits = []; this.hover = null; this.pinned = null; this.alive = true;
    this.build();
    GIS_LIST.add(this);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.refreshUI();
  }
  destroy() { this.alive = false; GIS_LIST.delete(this); try { this.ro.disconnect(); } catch (e) { /* noop */ } }
  get isEO() { return this.o.kind === 'eo'; }
  get sel() { return this.isEO ? this.eo.sel : this.st.sel; }
  set sel(v) { if (this.isEO) this.eo.sel = v; else this.st.sel = v; }
  get hour() { return this.st.hour; }

  /* ----- DOM ----- */
  build() {
    const id = this.id, o = this.o, isEO = this.isEO;
    const layersHTML = !o.layers ? '' : isEO ? `
      <div class="gis-layers" hidden>
        <h4>Camada de observação</h4>
        ${Object.keys(EO_LAYERS).map(k => `<label class="rad"><input type="radio" name="g${id}-eo" value="${k}" data-g="eolayer"> ${esc(EO_LAYERS[k].label)}</label>`).join('')}
        <h4>Comparação de datas</h4>
        <label class="chk"><input type="checkbox" data-g="compare"> Comparar duas datas (cortina)</label>
        <label class="sel-row">Data anterior <select data-g="da">${EO_DAYS.map((_, i) => `<option value="${i}">${fmtDMY(eoDate(i))}</option>`).join('')}</select></label>
      </div>` : `
      <div class="gis-layers" hidden>
        <h4>Base</h4>
        ${BASES.map(b => `<label class="rad"><input type="radio" name="g${id}-base" value="${b.k}" data-g="base"> ${esc(b.label)} ${b.tag ? `<span class="mini-tag ${b.tag === 'SIM' ? 'sim' : 'down'}">${b.tag === 'SIM' ? 'SIMULADO' : 'INDISPONÍVEL'}</span>` : ''}</label>`).join('')}
        <h4>Camada de dados</h4>
        ${DATALAYERS.map(b => `<label class="rad"><input type="radio" name="g${id}-data" value="${b.k}" data-g="data"> ${esc(b.label)}</label>`).join('')}
        <h4>Sobreposições</h4>
        ${OVLAYERS.map(b => `<label class="chk"><input type="checkbox" value="${b.k}" data-g="ov"> ${esc(b.label)}</label>`).join('')}
      </div>`;
    const timeHTML = !o.slider ? '' : isEO ? `
      <div class="gis-time eo"><span class="gt-l">Linha do tempo</span><div class="gt-dates">${EO_DAYS.map((_, i) => `<button class="gt-d" data-g="eodate" data-i="${i}">${fmtDM(eoDate(i))}<small>${eoDate(i).getFullYear()}</small></button>`).join('')}</div></div>` : `
      <div class="gis-time"><button class="gt-now" data-g="now">Agora</button>
        <input type="range" min="-24" max="72" step="1" value="0" data-g="hour" aria-label="Horizonte temporal do mapa">
        <span class="gt-l" data-r="hlabel"></span></div>`;
    this.host.innerHTML = `
      <canvas class="gis-cv" tabindex="0" aria-label="Mapa interativo"></canvas>
      <div class="gis-top">
        ${o.layers ? `<button class="gis-btn" data-g="layers" aria-expanded="false">${ICON.layers}<span>Camadas</span></button>` : ''}
        <div class="gis-status" data-r="status"></div>
      </div>
      ${layersHTML}
      ${o.controls ? `<div class="gis-zoom"><button class="gis-btn sq" data-g="zin" aria-label="Aproximar">${ICON.plus}</button><button class="gis-btn sq" data-g="zout" aria-label="Afastar">${ICON.minus}</button><button class="gis-btn sq" data-g="reset" aria-label="Recentralizar">${ICON.home}</button><button class="gis-btn sq" data-g="full" aria-label="Tela cheia">${ICON.expand}</button></div>` : ''}
      ${o.legend ? '<div class="gis-legend" data-r="legend"></div>' : ''}
      ${timeHTML}
      <div class="gis-readout" data-r="readout"></div>
      <div class="gis-notice" data-r="notice" hidden></div>
      <div class="gis-tip" data-r="tip" hidden></div>
      ${o.panel ? '<aside class="gis-rp" data-r="panel" hidden></aside>' : ''}`;
    this.cv = this.host.querySelector('canvas');
    this.ctx = this.cv.getContext('2d');
    this.el = k => this.host.querySelector(`[data-r="${k}"]`);
    this.host.addEventListener('click', e => this.onUI(e));
    this.host.addEventListener('change', e => this.onUI(e));
    this.host.addEventListener('input', e => { if (e.target.matches('[data-g="hour"]')) this.onUI(e); });
    const cv = this.cv;
    cv.addEventListener('pointerdown', e => this.onDown(e));
    cv.addEventListener('pointermove', e => this.onMove(e));
    cv.addEventListener('pointerup', e => this.onUp(e));
    cv.addEventListener('pointercancel', e => this.onUp(e, true));
    cv.addEventListener('pointerleave', () => { if (!this.drag) { this.hover = null; this.hideTip(); this.draw(); } });
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); this.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.18 : 1 / 1.18); }, { passive: false });
    cv.addEventListener('dblclick', e => { const r = cv.getBoundingClientRect(); this.zoomAt(e.clientX - r.left, e.clientY - r.top, 1.6); });
    cv.addEventListener('keydown', e => {
      const st = 0.12 / this.v.k;
      if (e.key === '+' || e.key === '=') this.zoomAt(this.w / 2, this.h / 2, 1.2);
      else if (e.key === '-') this.zoomAt(this.w / 2, this.h / 2, 1 / 1.2);
      else if (e.key === 'ArrowLeft') { this.v.x -= st; this.draw(); } else if (e.key === 'ArrowRight') { this.v.x += st; this.draw(); }
      else if (e.key === 'ArrowUp') { this.v.y -= st; this.draw(); } else if (e.key === 'ArrowDown') { this.v.y += st; this.draw(); }
    });
  }
  onTerritory() { this.v = { x: 0, y: 0, k: 1 }; this.hits = []; this.refreshUI(); this.refreshPanel(); this.draw(); }
  redraw() { if (!this.alive) return; this.refreshUI(); this.draw(); }

  /* ----- geometria da vista ----- */
  get S() { return Math.min(this.w, this.h) / 2.3 * this.v.k; }
  P(x, y) { const S = this.S; return [this.w / 2 + (x - this.v.x) * S, this.h / 2 + (y - this.v.y) * S]; }
  inv(px, py) { const S = this.S; return { x: (px - this.w / 2) / S + this.v.x, y: (py - this.h / 2) / S + this.v.y }; }
  resize() {
    if (!this.alive) return;
    const r = this.host.getBoundingClientRect();
    this.w = Math.max(10, r.width); this.h = Math.max(10, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr);
    this.draw();
  }
  zoomAt(px, py, f) {
    const before = this.inv(px, py);
    this.v.k = clamp(this.v.k * f, 0.6, 9);
    const S = this.S;
    this.v.x = before.x - (px - this.w / 2) / S; this.v.y = before.y - (py - this.h / 2) / S;
    this.draw();
  }

  /* ----- eventos ----- */
  onUI(e) {
    const t = e.target.closest('[data-g]');
    if (!t) return;
    const g = t.dataset.g, st = this.st;
    if (e.type === 'click') {
      if (g === 'layers') { const p = this.host.querySelector('.gis-layers'); p.hidden = !p.hidden; t.setAttribute('aria-expanded', String(!p.hidden)); }
      else if (g === 'zin') this.zoomAt(this.w / 2, this.h / 2, 1.4);
      else if (g === 'zout') this.zoomAt(this.w / 2, this.h / 2, 1 / 1.4);
      else if (g === 'reset') { this.v = { x: 0, y: 0, k: 1 }; this.draw(); }
      else if (g === 'full') this.toggleFull();
      else if (g === 'now') { st.hour = 0; this.syncAll(); }
      else if (g === 'closepanel') { this.sel = null; this.refreshPanel(); this.draw(); }
      else if (g === 'eodate') { this.eo.d = +t.dataset.i; this.refreshUI(); this.refreshPanel(); this.draw(); }
      else if (g === 'import') pickGeoFile();
      else if (g === 'goalerts') { ALERT_FILTER.reg = REGIONS[this.sel].id; navigate('alertas'); }
      else if (g === 'goterr') navigate('territorial');
    } else {
      if (g === 'base') { st.base = t.value; this.syncAll(); }
      else if (g === 'data') { st.data = t.value; this.syncAll(); }
      else if (g === 'ov') { st.ov[t.value] = t.checked; this.syncAll(); }
      else if (g === 'hour') { st.hour = +t.value; this.syncAll(); }
      else if (g === 'eolayer') { this.eo.layer = t.value; this.refreshUI(); this.refreshPanel(); this.draw(); }
      else if (g === 'compare') { this.eo.compare = t.checked; this.refreshUI(); this.draw(); }
      else if (g === 'da') { this.eo.da = +t.value; this.refreshUI(); this.draw(); }
    }
  }
  syncAll() {
    if (this.o.mini) { this.refreshUI(); this.refreshPanel(); this.draw(); return; }
    GIS_LIST.forEach(m => { if (!m.o.mini && !m.isEO) { m.refreshUI(); m.refreshPanel(); m.draw(); } });
    if (typeof onMapChange === 'function') onMapChange();
  }
  toggleFull() {
    const h = this.host, on = !h.classList.contains('gis-full');
    h.classList.toggle('gis-full', on);
    if (on && h.requestFullscreen) { h.requestFullscreen().catch(() => { /* usa o modo expandido por CSS */ }); }
    else if (!on && document.fullscreenElement) { document.exitFullscreen().catch(() => { /* noop */ }); }
    setTimeout(() => this.resize(), 60);
  }
  onDown(e) {
    this.cv.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = this.cv.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (this.isEO && this.eo.compare && Math.abs(px - this.eo.swipe * this.w) < 14) { this.drag = { swipe: true }; return; }
    if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); this.drag = { pinch: true, moved: true }; return; }
    this.drag = { x: e.clientX, y: e.clientY, vx: this.v.x, vy: this.v.y, moved: false };
  }
  onMove(e) {
    const r = this.cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.drag && this.drag.swipe) { this.eo.swipe = clamp(px / this.w, 0.05, 0.95); this.draw(); return; }
    if (this.drag && this.drag.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch) this.zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, d / this.pinch);
      this.pinch = d; return;
    }
    if (this.drag && this.drag.x != null) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true;
      if (this.drag.moved) { const S = this.S; this.v.x = this.drag.vx - dx / S; this.v.y = this.drag.vy - dy / S; this.cv.style.cursor = 'grabbing'; this.draw(); return; }
    }
    this.updateHover(px, py);
  }
  onUp(e, cancel) {
    const wasDrag = this.drag; this.pointers.delete(e.pointerId);
    this.cv.style.cursor = '';
    this.drag = null; this.pinch = 0;
    if (cancel || !wasDrag || wasDrag.moved || wasDrag.swipe) return;
    const r = this.cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    const hit = this.hitAt(px, py);
    if (hit && !this.isEO && typeof onMapMarker === 'function') { onMapMarker(hit.type, hit.ref, this); return; }
    const p = this.inv(px, py), c = TERR.nearestCell(p.x, p.y, HEX_S * 1.2);
    this.sel = c ? c.reg : null;
    this.refreshPanel(); this.draw();
  }
  hitAt(px, py) {
    let best = null, bd = 1e9;
    this.hits.forEach(h => { const d = Math.hypot(h.x - px, h.y - py); if (d < h.r + 5 && d < bd) { bd = d; best = h; } });
    return best;
  }
  updateHover(px, py) {
    const hit = this.hitAt(px, py);
    const p = this.inv(px, py), c = TERR.nearestCell(p.x, p.y, HEX_S * 1.2);
    const prev = this.hover;
    this.hover = hit ? { hit } : c ? { reg: c.reg, cell: c } : null;
    this.cv.style.cursor = hit ? 'pointer' : c ? 'crosshair' : '';
    this.showTip(px, py, hit, c);
    const ro = this.el('readout');
    if (ro) ro.innerHTML = this.readoutHTML(p);
    if (!prev || !this.hover || prev.reg !== this.hover.reg || (prev.hit !== (this.hover && this.hover.hit))) this.draw();
  }
  hideTip() { const t = this.el('tip'); if (t) t.hidden = true; }
  showTip(px, py, hit, c) {
    const t = this.el('tip'); if (!t) return;
    let html = '';
    if (hit) {
      if (hit.type === 'shelter') { const s = hit.ref, stale = shelterStale(s); html = `<b>${esc(s.name)}</b><span>${s.occ}/${s.cap} ocupadas · ${stale ? 'DADO HISTÓRICO (' + ageText(shelterAge(s)) + ')' : 'DADO SIMULADO'}</span>`; }
      else if (hit.type === 'incident') { const i = hit.ref; html = `<b>${esc(i.id)}</b><span>${esc(i.type)} · prioridade ${i.prio} · ${esc(i.status)}</span>`; }
      else if (hit.type === 'team') { const m = hit.ref; html = `<b>${esc(m.name)}</b><span>${esc(m.state)} · posição de demonstração</span>`; }
    } else if (c) {
      const r = REGIONS[c.reg];
      if (this.isEO) { const st = eoRegionStats(c.reg, this.eo.d); html = `<b>${esc(r.name)}</b><span>Superfície ${fmt1(st.lst)} °C · vegetação ${fmt0(st.green * 100)}% · SIMULADO</span>`; }
      else { const cr = criAt(r, this.hour); html = `<b>${esc(r.name)}</b><span>Índice ${fmt0(cr.score)} (${cr.cls.label.toLowerCase()}) · SIMULADO</span>`; }
    }
    if (!html) { t.hidden = true; return; }
    t.innerHTML = html; t.hidden = false;
    t.style.left = clamp(px + 14, 6, this.w - 220) + 'px'; t.style.top = clamp(py + 14, 6, this.h - 64) + 'px';
  }
  readoutHTML(p) {
    if (TERR.mode === 'geo') {
      const ll = TERR.toLL(p.x, p.y);
      return `<span>lat ${ll.lat.toFixed(4)} · lon ${ll.lon.toFixed(4)}</span>`;
    }
    return `<span>u ${p.x.toFixed(2)} · v ${(-p.y).toFixed(2)}</span><span class="dim">coordenadas esquemáticas</span>`;
  }

  /* ----- UI dependente do estado ----- */
  refreshUI() {
    const st = this.st, h = this.host, isEO = this.isEO;
    const stat = this.el('status');
    if (stat) {
      stat.innerHTML = `${badge('sim')}<span class="gs-t">${TERR.mode === 'geo' ? 'MALHA IMPORTADA · ' + esc(TERR.name) : 'ESQUEMA · SEM GEORREFERÊNCIA'}</span>`;
    }
    h.querySelectorAll('[data-g="base"]').forEach(i => { i.checked = i.value === st.base; });
    h.querySelectorAll('[data-g="data"]').forEach(i => { i.checked = i.value === st.data; });
    h.querySelectorAll('[data-g="ov"]').forEach(i => { i.checked = !!st.ov[i.value]; });
    h.querySelectorAll('[data-g="eolayer"]').forEach(i => { i.checked = i.value === this.eo.layer; });
    const cmp = h.querySelector('[data-g="compare"]'); if (cmp) cmp.checked = this.eo.compare;
    const da = h.querySelector('select[data-g="da"]'); if (da) { da.value = this.eo.da; da.disabled = !this.eo.compare; }
    h.querySelectorAll('[data-g="eodate"]').forEach(b => b.classList.toggle('on', +b.dataset.i === this.eo.d));
    const hr = h.querySelector('[data-g="hour"]');
    if (hr) { hr.value = st.hour; hr.disabled = st.data === 'hist'; }
    const hl = this.el('hlabel');
    if (hl) {
      const d = tAt(st.hour);
      hl.innerHTML = st.data === 'hist' ? '<b>Série histórica</b> · independe do horário' : `<b>${hLabel(st.hour)}</b> · ${fmtDMHM(d)} · ${st.hour <= 0 ? 'observação simulada' : 'previsão simulada'}`;
    }
    const nt = this.el('notice');
    if (nt) {
      let msg = '';
      if (!isEO && st.base === 'cartografico' && TERR.mode !== 'geo') msg = `<b>FONTE INDISPONÍVEL</b> A malha municipal do IBGE não foi importada. Exibindo o esquema operacional. <button class="lnk" data-g="import">Importar GeoJSON</button>`;
      else if (!isEO && st.base === 'satelite') msg = '<b>PRÉ-VISUALIZAÇÃO SIMULADA</b> Nenhuma imagem de satélite está conectada.';
      else if (!isEO && st.base === 'relevo') msg = '<b>PRÉ-VISUALIZAÇÃO SIMULADA</b> Nenhum modelo digital de elevação está conectado.';
      else if (isEO) msg = '<b>PRODUTO DE DEMONSTRAÇÃO</b> Valores sintéticos sobre a grade esquemática. Nenhum produto de sensoriamento remoto conectado.';
      nt.hidden = !msg; nt.innerHTML = msg;
    }
    this.updateLegend();
  }
  updateLegend() {
    const lg = this.el('legend'); if (!lg) return;
    if (this.isEO) {
      const L = this.eo.layer;
      if (L === 'cover') lg.innerHTML = `<h5>${EO_LAYERS[L].label}</h5>` + COVER.map(c => `<div class="lg-sw"><i style="background:${rgbCss(c.rgb)}"></i>${c.label}</div>`).join('');
      else {
        const cfg = L === 'green' ? [NDVI_STOPS, 0, 1, 'índice 0–1'] : L === 'urban' ? [URB_STOPS, 0, 1, 'densidade 0–1'] : L === 'lst' ? [TEMP_STOPS, 8, 30, '°C'] : [DIV_STOPS, -6, 6, 'Δ °C'];
        lg.innerHTML = `<h5>${EO_LAYERS[L].label}</h5><div class="lg-bar" style="background:${cssGradient(cfg[0], cfg[1], cfg[2])}"></div><div class="lg-lab"><span>${cfg[1]}</span><span>${cfg[3]}</span><span>${cfg[2]}</span></div>`;
      }
      return;
    }
    const d = this.st.data;
    const cfg = { cri: [RISK_STOPS, 0, 100, 'pontos do índice'], temp: [TEMP_STOPS, 0, 24, '°C'], feels: [TEMP_STOPS, 0, 24, '°C (sensação)'], expo: [RISK_STOPS, 0, 100, 'exposição relativa'], hist: [RISK_STOPS, 0, 100, 'recorrência relativa'] }[d];
    if (!cfg) { lg.innerHTML = '<h5>Somente base</h5><div class="lg-lab"><span>Setores esquemáticos A–H</span></div>'; return; }
    const lab = DATALAYERS.find(x => x.k === d).label;
    lg.innerHTML = `<h5>${lab}</h5><div class="lg-bar" style="background:${cssGradient(cfg[0], cfg[1], cfg[2])}"></div><div class="lg-lab"><span>${cfg[1]}</span><span>${cfg[3]}</span><span>${cfg[2]}</span></div>
      ${d === 'cri' ? `<div class="lg-cls">${['baixo', 'moderado', 'alto', 'critico'].map(k => `<span><i style="background:${CLASSES[k].color}"></i>${CLASSES[k].label.toLowerCase()}</span>`).join('')}</div><div class="lg-note">Protótipo experimental</div>` : ''}`;
  }
  refreshPanel() {
    const p = this.el('panel'); if (!p) return;
    const sel = this.sel;
    if (sel == null) { p.hidden = true; p.innerHTML = ''; return; }
    p.innerHTML = this.isEO ? eoPanelHTML(sel, this.eo) : regionPanelHTML(sel, this.st.hour);
    p.hidden = false;
    p.querySelectorAll('.spark-host').forEach(el => { try { el.innerHTML = sparkSVG(JSON.parse(el.dataset.v), 150, 34, C.cyan); } catch (err) { /* noop */ } });
  }

  /* ----- desenho ----- */
  cellRGB(c) {
    const st = this.st, r = REGIONS[c.reg], h = st.hour;
    let base;
    if (st.base === 'satelite') { const n = c.n2, veg = c.n > 0.56; base = veg ? [20 + 22 * n, 50 + 44 * n, 28 + 14 * n] : [34 + 34 * n, 38 + 36 * n, 38 + 24 * n]; }
    else if (st.base === 'relevo') {
      const e = c.el, ramp = [[0, [14, 44, 86]], [0.35, [24, 86, 74]], [0.55, [96, 100, 58]], [0.75, [140, 120, 96]], [1, [205, 200, 190]]];
      const col = gradRGB(e, ramp), sh = (c.n - 0.5) * 36; base = [clamp(col[0] + sh, 0, 255), clamp(col[1] + sh, 0, 255), clamp(col[2] + sh, 0, 255)];
    } else base = [15, 27, 48];
    const d = st.data;
    if (d === 'none') return base;
    let col;
    if (d === 'cri') col = gradRGB(criAt(r, h).score + (c.n - 0.5) * 11, RISK_STOPS);
    else if (d === 'temp') col = gradRGB(regionTemp(r, h) + (c.n - 0.5) * 1.4, TEMP_STOPS);
    else if (d === 'feels') col = gradRGB(regionFeels(r, h) + (c.n - 0.5) * 1.4, TEMP_STOPS);
    else if (d === 'expo') col = gradRGB((r.expo + (c.n - 0.5) * 0.26) * 100, RISK_STOPS);
    else col = gradRGB((r.recur + (c.n - 0.5) * 0.26) * 100, RISK_STOPS);
    return mixRGB(base, col, st.base === 'esquema' ? 0.88 : 0.62);
  }
  eoRGB(c, di) {
    const L = this.eo.layer;
    if (L === 'cover') { const k = eoCover(c, di); return mixRGB([15, 27, 48], COVER[k].rgb, 0.85); }
    if (L === 'green') return gradRGB(eoGreen(c, di), NDVI_STOPS);
    if (L === 'urban') return gradRGB(eoUrban(c), URB_STOPS);
    if (L === 'lst') return gradRGB(eoLST(c, di), TEMP_STOPS.map(s => [s[0] + 6, s[1]]));
    return gradRGB(eoLST(c, di) - eoLST(c, 5), DIV_STOPS);
  }
  fillCells(ctx, fn) {
    const S = this.S, r = HEX_S * S * 0.985, w = this.w, h = this.h;
    for (const c of TERR.cells) {
      const [px, py] = this.P(c.x, c.y);
      if (px < -r || py < -r || px > w + r || py > h + r) continue;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) { const X = px + r * HEXV[j][0], Y = py + r * HEXV[j][1]; if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
      ctx.closePath(); ctx.fillStyle = rgbCss(fn(c)); ctx.fill();
    }
  }
  strokeSegs(ctx, segs, style, width, dash, glow) {
    if (!segs.length) return;
    ctx.save();
    ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 8; }
    ctx.beginPath();
    for (const s of segs) { const a = this.P(s[0], s[1]), b = this.P(s[2], s[3]); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke(); ctx.restore();
  }
  draw() {
    if (!this.alive || !this.ctx || !TERR) return;
    const ctx = this.ctx, W = this.w, H = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
    bg.addColorStop(0, '#0C1830'); bg.addColorStop(1, '#050912');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (TERR.mode === 'schematic') this.drawGrid(ctx);
    this.hits = [];
    if (this.isEO) this.drawEO(ctx); else this.drawOps(ctx);
    this.drawScale(ctx);
  }
  drawGrid(ctx) {
    ctx.save(); ctx.lineWidth = 1;
    for (let g = -2; g <= 2.001; g += 0.25) {
      ctx.strokeStyle = Math.abs(g) < 0.001 ? 'rgba(120,165,230,.16)' : 'rgba(120,165,230,.06)';
      const a = this.P(g, -2), b = this.P(g, 2), c = this.P(-2, g), d = this.P(2, g);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
    }
    ctx.restore();
  }
  drawRings(ctx, style, width) {
    if (TERR.mode !== 'geo') return;
    ctx.save(); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.shadowColor = 'rgba(54,217,255,.7)'; ctx.shadowBlur = 10;
    TERR.rings.forEach(poly => poly.forEach(ring => {
      ctx.beginPath();
      ring.forEach((pt, i) => { const q = this.P(pt[0], pt[1]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.closePath(); ctx.stroke();
    }));
    ctx.restore();
  }
  drawRegionLabels(ctx, textFn) {
    if (this.S < 120) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    REGIONS.forEach((r, i) => {
      const c = TERR.centers[i], [x, y] = this.P(c.x, c.y);
      if (x < -20 || y < -20 || x > this.w + 20 || y > this.h + 20) return;
      ctx.font = '700 13px "Chakra Petch", sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(5,9,18,.85)'; ctx.fillStyle = '#EAF2FF';
      ctx.strokeText(r.id, x, y - 7); ctx.fillText(r.id, x, y - 7);
      const t = textFn(i);
      if (t && this.S > 170) { ctx.font = '500 10px "IBM Plex Mono", monospace'; ctx.strokeText(t, x, y + 7); ctx.fillText(t, x, y + 7); }
    });
    ctx.restore();
  }
  drawOps(ctx) {
    const st = this.st, h = st.hour;
    this.fillCells(ctx, c => this.cellRGB(c));
    this.strokeSegs(ctx, TERR.borderSegs, 'rgba(160,200,255,.28)', 1);
    this.strokeSegs(ctx, TERR.outlineSegs, 'rgba(54,217,255,.85)', 1.6, null, 'rgba(54,217,255,.6)');
    this.drawRings(ctx, '#36D9FF', 2.2);
    if (st.ov.priority) {
      const ov = overallAt(h), top = ov.top.slice(0, 3);
      top.forEach((t, i) => {
        const col = t.c.cls.color;
        this.strokeSegs(ctx, TERR.regionEdges[t.r.idx], col, 2.4, [7, 4], col);
        if (this.S > 140) {
          const c = TERR.centers[t.r.idx], [x, y] = this.P(c.x, c.y);
          ctx.save(); ctx.font = '600 9px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; const label = 'PRIORIDADE ' + (i + 1), tw = ctx.measureText(label).width + 10;
          ctx.fillStyle = 'rgba(5,9,18,.88)'; ctx.fillRect(x - tw / 2, y + 20, tw, 15); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(x - tw / 2 + .5, y + 20.5, tw - 1, 14);
          ctx.fillStyle = col; ctx.fillText(label, x, y + 31); ctx.restore();
        }
      });
    }
    this.drawRegionLabels(ctx, i => st.data === 'cri' ? fmt0(criAt(REGIONS[i], h).score) : st.data === 'temp' ? fmt1(regionTemp(REGIONS[i], h)) + '°' : st.data === 'feels' ? fmt1(regionFeels(REGIONS[i], h)) + '°' : '');
    if (this.hover && this.hover.reg != null) this.strokeSegs(ctx, TERR.regionEdges[this.hover.reg], 'rgba(234,242,255,.7)', 1.6);
    if (this.sel != null) this.strokeSegs(ctx, TERR.regionEdges[this.sel], '#EAF2FF', 2.6, null, 'rgba(234,242,255,.8)');
    if (st.ov.shelters) this.drawShelters(ctx);
    if (st.ov.incidents) this.drawIncidents(ctx);
    if (st.ov.teams) this.drawTeams(ctx);
  }
  drawShelters(ctx) {
    SHELTERS.forEach(s => {
      const [x, y] = this.P(s.pos.x, s.pos.y), pct = s.cap ? s.occ / s.cap : 0, stale = shelterStale(s);
      const col = s.status === 'Indisponível' ? '#7F93B0' : pct >= 0.9 ? C.crit : pct >= 0.75 ? C.warn : C.ok;
      ctx.save();
      ctx.fillStyle = '#050912'; ctx.strokeStyle = col; ctx.lineWidth = 2; if (stale && s.kind === 'hist') ctx.setLineDash([3, 2]);
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 9, y - 9, 18, 18, 3); else ctx.rect(x - 9, y - 9, 18, 18);
      ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke();
      ctx.restore();
      this.hits.push({ x, y, r: 10, type: 'shelter', ref: s });
    });
  }
  drawIncidents(ctx) {
    INCIDENTS.forEach(o => {
      const [x, y] = this.P(o.pos.x, o.pos.y), done = o.status === 'Concluída';
      const col = done ? '#7F93B0' : o.prio === 'alta' ? C.crit : o.prio === 'média' ? C.warn : C.cyan;
      ctx.save(); ctx.globalAlpha = done ? 0.6 : 1;
      ctx.fillStyle = col; ctx.strokeStyle = '#050912'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (o.status === 'Em andamento') { ctx.strokeStyle = col; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(x, y, 12, 0, 6.283); ctx.stroke(); }
      ctx.restore();
      this.hits.push({ x, y, r: 9, type: 'incident', ref: o });
    });
  }
  drawTeams(ctx) {
    TEAMS.forEach(t => {
      const [x, y] = this.P(t.pos.x, t.pos.y), col = t.state === 'Em campo' ? C.ok : C.cyan;
      ctx.save(); ctx.fillStyle = '#050912'; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.font = '700 9px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('E' + t.name.slice(-1), x, y + 0.5);
      ctx.restore();
      this.hits.push({ x, y, r: 9, type: 'team', ref: t });
    });
  }
  drawEO(ctx) {
    const eo = this.eo, W = this.w, H = this.h;
    if (eo.compare) {
      const sx = eo.swipe * W;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sx, H); ctx.clip(); this.fillCells(ctx, c => this.eoRGB(c, eo.da)); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, W - sx, H); ctx.clip(); this.fillCells(ctx, c => this.eoRGB(c, eo.d)); ctx.restore();
      ctx.save(); ctx.strokeStyle = '#EAF2FF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
      ctx.fillStyle = '#050912'; ctx.beginPath(); ctx.arc(sx, H / 2, 14, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#EAF2FF'; ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('↔', sx, H / 2 + 0.5);
      ctx.textAlign = 'left'; ctx.fillText(fmtDMY(eoDate(eo.da)), 14, 78); ctx.textAlign = 'right'; ctx.fillText(fmtDMY(eoDate(eo.d)), W - 14, 78);
      ctx.restore();
    } else this.fillCells(ctx, c => this.eoRGB(c, eo.d));
    this.strokeSegs(ctx, TERR.borderSegs, 'rgba(160,200,255,.16)', 1);
    this.strokeSegs(ctx, TERR.outlineSegs, 'rgba(54,217,255,.8)', 1.5, null, 'rgba(54,217,255,.5)');
    this.drawRings(ctx, '#36D9FF', 2);
    eoInvestigate(eo.d).forEach((it, i) => this.strokeSegs(ctx, TERR.regionEdges[it.ri], C.warn, 2.2, [6, 4], C.warn));
    this.drawRegionLabels(ctx, i => { const s = eoRegionStats(i, eo.d); return eo.layer === 'lst' ? fmt1(s.lst) + '°' : eo.layer === 'green' ? fmt0(s.green * 100) + '%' : eo.layer === 'urban' ? fmt0(s.urban * 100) + '%' : ''; });
    if (this.hover && this.hover.reg != null) this.strokeSegs(ctx, TERR.regionEdges[this.hover.reg], 'rgba(234,242,255,.7)', 1.6);
    if (eo.sel != null) this.strokeSegs(ctx, TERR.regionEdges[eo.sel], '#EAF2FF', 2.6, null, 'rgba(234,242,255,.8)');
  }
  drawScale(ctx) {
    ctx.save(); ctx.font = '500 10px "IBM Plex Mono", monospace'; ctx.fillStyle = '#B9C8DE'; ctx.strokeStyle = '#B9C8DE'; ctx.lineWidth = 1.5;
    const x0 = 16, y0 = this.h - (this.o.slider ? 58 : 20) - (this.o.legend ? 0 : 0);
    if (TERR.mode === 'geo') {
      const kmPx = this.S / TERR.kmPerUnit, nice = [0.5, 1, 2, 5, 10, 20, 50, 100], km = nice.find(n => n * kmPx >= 70) || 100, L = km * kmPx;
      if (this.w > 520) { ctx.beginPath(); ctx.moveTo(this.w - 24 - L, this.h - 96); ctx.lineTo(this.w - 24 - L, this.h - 90); ctx.lineTo(this.w - 24, this.h - 90); ctx.lineTo(this.w - 24, this.h - 96); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(km + ' km', this.w - 24, this.h - 100); }
    } else if (this.w > 520 && this.o.slider) { ctx.textAlign = 'right'; ctx.fillStyle = '#7F93B0'; ctx.fillText('SEM ESCALA · ESQUEMA', this.w - 16, this.h - 82); }
    ctx.restore();
  }
}

/* ---------- áreas a investigar (Observação da Terra, simulado) ---------- */
function eoInvestigate(di) {
  const mean = eoMeanLST(di);
  return REGIONS.map((r, i) => { const s = eoRegionStats(i, di); return { ri: i, anom: s.lst - mean, green: s.green, urban: s.urban, lst: s.lst }; })
    .filter(x => x.anom > 0.6 && x.green < 0.5).sort((a, b) => b.anom - a.anom).slice(0, 3);
}

/* ---------- Painéis laterais ---------- */
function recommendationFor(ri, h) {
  const r = REGIONS[ri], c = criAt(r, h), dom = [...c.contrib].sort((a, b) => b.pts - a.pts)[0];
  const parts = [];
  if (c.cls.rank >= 2) parts.push('Reforçar o monitoramento e priorizar vistoria de campo neste setor.');
  else parts.push('Manter o monitoramento de rotina e acompanhar a evolução da previsão.');
  if (r.deficit >= 0.55) parts.push('Verificar capacidade de acolhimento próxima.');
  if (dom.key === 'wind' || dom.key === 'expo') parts.push('Avaliar pontos expostos ao vento.');
  return parts.join(' ') + ' Apoio à decisão: a avaliação é humana.';
}
function regionPanelHTML(ri, h) {
  const r = REGIONS[ri], c = criAt(r, h), d = tAt(h);
  const series = []; for (let k = 0; k <= 12; k++) series.push(regionTemp(r, h + k));
  const inc = INCIDENTS.filter(o => o.reg === r.id);
  const open = inc.filter(o => o.status !== 'Concluída').length;
  const sh = SHELTERS.filter(s => s.reg === r.id);
  const cap = sh.reduce((a, s) => a + s.cap, 0), occ = sh.reduce((a, s) => a + s.occ, 0);
  const al = ALERTS.filter(a => a.reg === r.id);
  const top = [...c.contrib].sort((a, b) => b.pts - a.pts).slice(0, 3);
  return `<header><div><span class="eyebrow">SETOR ESQUEMÁTICO</span><h3>${esc(r.name)}</h3></div><button class="gis-btn sq" data-g="closepanel" aria-label="Fechar painel">${ICON.x}</button></header>
  <div class="rp-body">
    <div class="rp-cls" style="--c:${c.cls.color}"><b>${fmt0(c.score)}</b><span>${c.cls.label}</span><small>Índice de risco de frio · protótipo</small></div>
    <dl class="rp-dl">
      <div><dt>Temperatura (${h <= 0 ? 'observada' : 'prevista'})</dt><dd>${fmt1(regionTemp(r, h))} °C <small>${fmtHM(d)}</small></dd></div>
      <div><dt>Sensação térmica</dt><dd>${fmt1(regionFeels(r, h))} °C</dd></div>
      <div><dt>Vento · chuva</dt><dd>${fmt0(regionWind(r, h))} km/h · ${fmt1(precipAt(h))} mm/h</dd></div>
    </dl>
    <div class="rp-sec"><h5>Próximas 12 h</h5><div class="spark-host" data-v='${JSON.stringify(series.map(v => +v.toFixed(2)))}'></div><small class="dim">${fmt1(Math.min(...series))} a ${fmt1(Math.max(...series))} °C</small></div>
    <div class="rp-sec"><h5>Fatores principais</h5>${top.map(t => `<div class="rp-f"><span>${esc(t.label)}</span><b>${fmt1(t.pts)} pts</b></div>`).join('')}</div>
    <div class="rp-sec"><h5>Ocorrências registradas</h5><p>${inc.length} no total · ${open} em aberto <span class="dim">(demonstração)</span></p></div>
    <div class="rp-sec"><h5>Infraestrutura pública próxima</h5>${sh.length ? sh.map(s => `<p>${esc(s.name)}<br><span class="dim">${s.occ}/${s.cap} · ${shelterStale(s) ? 'dado histórico, ' + ageText(shelterAge(s)) : 'dado simulado'}</span></p>`).join('') : '<p class="dim">Nenhuma unidade conhecida neste setor.</p>'}
      <p class="dim">Capacidade de acolhimento conhecida: ${cap ? cap + ' vagas, ' + occ + ' ocupadas' : 'sem unidades registradas'}</p></div>
    <div class="rp-sec"><h5>Histórico de alertas</h5>${al.length ? al.slice(0, 3).map(a => `<p><span class="sev s-${a.sev}"></span>${esc(a.id)} · ${esc(a.type)}<br><span class="dim">${fmtDMHM(a.at)} · ${esc(a.status)}</span></p>`).join('') : '<p class="dim">Sem alertas neste setor.</p>'}</div>
    <div class="rp-sec rec"><h5>Recomendação operacional</h5><p>${esc(recommendationFor(ri, h))}</p></div>
    <div class="prov">${badge('sim')}<span>Fonte: simulação interna · referência ${fmtDMHM(d)}</span></div>
    <button class="btn sm" data-g="goalerts">Ver alertas do setor</button>
  </div>`;
}
function eoPanelHTML(ri, eo) {
  const r = REGIONS[ri], s = eoRegionStats(ri, eo.d), s0 = eoRegionStats(ri, 5), mean = eoMeanLST(eo.d);
  return `<header><div><span class="eyebrow">OBSERVAÇÃO DA TERRA</span><h3>${esc(r.name)}</h3></div><button class="gis-btn sq" data-g="closepanel" aria-label="Fechar painel">${ICON.x}</button></header>
  <div class="rp-body"><dl class="rp-dl">
    <div><dt>Temperatura da superfície</dt><dd>${fmt1(s.lst)} °C <small>${s.lst - mean >= 0 ? '+' : ''}${fmt1(s.lst - mean)} vs. média</small></dd></div>
    <div><dt>Cobertura vegetal</dt><dd>${fmt0(s.green * 100)}%</dd></div>
    <div><dt>Ocupação urbana</dt><dd>${fmt0(s.urban * 100)}%</dd></div>
    <div><dt>Variação até a data mais recente</dt><dd>${(s0.lst - s.lst) >= 0 ? '+' : ''}${fmt1(s0.lst - s.lst)} °C</dd></div>
  </dl>
  <div class="rp-sec"><h5>Data de aquisição</h5><p>${fmtDMY(eoDate(eo.d))} <span class="dim">(simulada)</span></p></div>
  <div class="prov">${badge('sim')}<span>Produto de demonstração. Sem fonte conectada.</span></div></div>`;
}

/* ---------- arquivo GeoJSON ---------- */
function pickGeoFile() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.geojson,.json,application/geo+json,application/json';
  inp.addEventListener('change', () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { importGeoJSON(String(rd.result), f.name); toast('Malha importada: ' + f.name, 'ok'); if (typeof refreshView === 'function') refreshView(); }
      catch (err) { toast('Não foi possível importar: ' + err.message, 'err'); }
    };
    rd.onerror = () => toast('Falha ao ler o arquivo.', 'err');
    rd.readAsText(f);
  });
  inp.click();
}

setSchematic();
