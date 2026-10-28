'use strict';
/* =====================================================================
   COLDALERT · dados, cenário de demonstração e motor do índice (protótipo)
   Tudo aqui é SIMULADO, exceto os fatos de CONTEXT (históricos, com fonte).
   ===================================================================== */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sig = x => 1 / (1 + Math.exp(-x));
const pad2 = n => String(n).padStart(2, '0');

function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm2(x, y, s) {
  let t = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { t += a * vnoise(x * f, y * f, s + i * 17); f *= 2; a *= 0.5; }
  return t / 0.9375;
}

/* ---------- Tempo de referência do cenário ---------- */
const T0 = new Date();
const MS_H = 3600000;
function tAt(h) { return new Date(T0.getTime() + h * MS_H); }
function fmtHM(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function fmtDM(d) { return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1); }
function fmtDMY(d) { return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear(); }
function fmtDMHM(d) { return fmtDM(d) + ' ' + fmtHM(d); }
function hLabel(h) {
  if (h === 0) return 'agora';
  return (h > 0 ? '+' : '−') + Math.abs(h) + ' h';
}
function hodAt(h) { return (((T0.getHours() + T0.getMinutes() / 60 + h) % 24) + 24) % 24; }

/* ---------- Cenário meteorológico de DEMONSTRAÇÃO (frente fria sintética) ---------- */
function tempAt(h) {
  const diur = 3.4 * Math.cos(2 * Math.PI * (hodAt(h) - 15) / 24);
  const front = -6.8 * sig((h - 9) / 6) + 3.8 * sig((h - 58) / 7);
  return 13.6 + diur + front + 0.35 * Math.sin(h * 1.7) + 0.2 * Math.sin(h * 0.63 + 1);
}
function windAt(h) {
  return Math.max(2, 7 + 15 * sig((h - 8) / 5) - 6 * sig((h - 56) / 7) + 1.6 * Math.sin(h * 0.9 + 0.5));
}
function precipAt(h) {
  return Math.max(0, 1.9 * Math.exp(-Math.pow((h - 10) / 3.2, 2)) + 0.6 * Math.exp(-Math.pow((h - 34) / 4, 2)) - 0.05);
}
function humidAt(h) { return clamp(62 + 18 * sig((h - 8) / 5) + 8 * Math.sin(h * 0.5), 35, 98); }
function pressAt(h) { return 1016 + 5 * sig((h - 12) / 9) - 3 * Math.sin(h / 11); }
/* Sensação térmica: fórmula de wind chill (Environment Canada / NWS), T em °C e vento em km/h. */
function feelsFrom(t, v) {
  if (t <= 10 && v > 4.8) {
    const p = Math.pow(v, 0.16);
    return 13.12 + 0.6215 * t - 11.37 * p + 0.3965 * t * p;
  }
  return t;
}
function feelsAt(h) { return feelsFrom(tempAt(h), windAt(h)); }
/* "Previsão emitida 24 h antes" (com erro sintético) para comparar com a observação sintética. */
function obsTempAt(h) { return tempAt(h) + 0.55 * Math.sin(h * 2.3) + 0.35 * Math.cos(h * 1.1); }
function fcTempAt(h) { return tempAt(h) + 1.1 * Math.sin(h * 0.37 + 0.8) - 0.3; }

/* ---------- Setores esquemáticos (NÃO são bairros nem divisões administrativas) ---------- */
const REGIONS = [
  { id: 'A', name: 'Setor A', vuln: 0.82, expo: 0.55, deficit: 0.70, dT: -0.4, recur: 0.78 },
  { id: 'B', name: 'Setor B', vuln: 0.45, expo: 0.40, deficit: 0.30, dT: 0.2, recur: 0.35 },
  { id: 'C', name: 'Setor C', vuln: 0.60, expo: 0.35, deficit: 0.50, dT: 0.3, recur: 0.52 },
  { id: 'D', name: 'Setor D', vuln: 0.30, expo: 0.28, deficit: 0.20, dT: 0.6, recur: 0.22 },
  { id: 'E', name: 'Setor E', vuln: 0.74, expo: 0.80, deficit: 0.65, dT: -1.2, recur: 0.70 },
  { id: 'F', name: 'Setor F', vuln: 0.52, expo: 0.62, deficit: 0.45, dT: -0.8, recur: 0.48 },
  { id: 'G', name: 'Setor G', vuln: 0.38, expo: 0.30, deficit: 0.30, dT: 0.4, recur: 0.30 },
  { id: 'H', name: 'Setor H', vuln: 0.66, expo: 0.50, deficit: 0.55, dT: -0.5, recur: 0.60 }
];
const REG = Object.fromEntries(REGIONS.map((r, i) => (r.idx = i, [r.id, r])));
const OPS_GAP = 0.40; // lacuna de capacidade operacional (simulada)

/* ---------- Índice de Risco de Frio — PROTÓTIPO EXPERIMENTAL ---------- */
const FACTOR_META = {
  temp:    { label: 'Sensação térmica', hint: 'Quanto mais abaixo de 16 °C, maior a contribuição (0 °C = máximo).' },
  wind:    { label: 'Vento', hint: 'Normalizado de 0 a 40 km/h; agrava a sensação de frio.' },
  precip:  { label: 'Precipitação', hint: 'Chuva fria aumenta a exposição; normalizada de 0 a 3 mm/h.' },
  dur:     { label: 'Duração do frio', hint: 'Fração das próximas 24 h com sensação térmica abaixo de 10 °C.' },
  vuln:    { label: 'Vulnerabilidade territorial', hint: 'Indicador agregado por setor (simulado). Em produção: dados agregados e autorizados.' },
  expo:    { label: 'Exposição do território', hint: 'Exposição ao vento e ao relevo (simulada).' },
  deficit: { label: 'Déficit de acolhimento', hint: 'Lacuna entre demanda estimada e vagas conhecidas (simulada).' },
  ops:     { label: 'Capacidade operacional', hint: 'Lacuna de equipes disponíveis (simulada).' }
};
const PARAMS = {
  w: { temp: 0.26, wind: 0.08, precip: 0.06, dur: 0.14, vuln: 0.20, expo: 0.08, deficit: 0.12, ops: 0.06 },
  th: { low: 25, mod: 45, high: 65 }
};
const DEFAULT_PARAMS = JSON.parse(JSON.stringify(PARAMS));

const CLASSES = {
  baixo:    { key: 'baixo', label: 'BAIXO', color: '#36D9FF', rank: 0 },
  moderado: { key: 'moderado', label: 'MODERADO', color: '#F5D547', rank: 1 },
  alto:     { key: 'alto', label: 'ALTO', color: '#FF9F43', rank: 2 },
  critico:  { key: 'critico', label: 'CRÍTICO', color: '#FF4D5E', rank: 3 }
};
function classify(score) {
  const t = PARAMS.th;
  if (score < t.low) return CLASSES.baixo;
  if (score < t.mod) return CLASSES.moderado;
  if (score < t.high) return CLASSES.alto;
  return CLASSES.critico;
}
function regionWind(r, h) { return windAt(h) * (0.75 + 0.5 * r.expo); }
function regionTemp(r, h) { return tempAt(h) + r.dT; }
function regionFeels(r, h) { return feelsFrom(regionTemp(r, h), regionWind(r, h)); }
function factorsAt(r, h) {
  const fl = regionFeels(r, h);
  let dur = 0;
  for (let k = 0; k < 24; k++) if (regionFeels(r, h + k) < 10) dur++;
  return {
    temp: clamp((16 - fl) / 16, 0, 1),
    wind: clamp(regionWind(r, h) / 40, 0, 1),
    precip: clamp(precipAt(h) / 3, 0, 1),
    dur: dur / 24,
    vuln: r.vuln, expo: r.expo, deficit: r.deficit, ops: OPS_GAP
  };
}
const _criCache = new Map();
let _criVer = 0;
function bumpParams() { _criVer++; _criCache.clear(); }
function criAt(r, h) {
  const key = _criVer + '|' + r.id + '|' + h;
  if (_criCache.has(key)) return _criCache.get(key);
  const f = factorsAt(r, h);
  const w = PARAMS.w;
  const sw = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const contrib = Object.keys(w).map(k => ({ key: k, label: FACTOR_META[k].label, value: f[k], weight: w[k] / sw, pts: 100 * f[k] * w[k] / sw }));
  const score = contrib.reduce((a, c) => a + c.pts, 0);
  const out = { score, cls: classify(score), f, contrib };
  _criCache.set(key, out);
  return out;
}
function overallAt(h) {
  const all = REGIONS.map(r => ({ r, c: criAt(r, h) }));
  const max = all.reduce((a, b) => (b.c.score > a.c.score ? b : a));
  const min = all.reduce((a, b) => (b.c.score < a.c.score ? b : a));
  const mean = all.reduce((a, b) => a + b.c.score, 0) / all.length;
  return { all, max, min, mean, score: max.c.score, cls: max.c.cls, top: [...all].sort((a, b) => b.c.score - a.c.score) };
}
/* Fontes reais conectadas: nenhuma. O teto da confiança reflete isso. */
function confidenceAt(h) {
  const connected = SOURCES.filter(s => s.status === 'live').length;
  const base = 0.12 + 0.60 * (connected / SOURCES.length);
  return clamp(base - 0.0012 * Math.abs(h), 0.04, 0.9);
}

/* ---------- Fontes de dados (nenhuma integração está ativa neste protótipo) ---------- */
const SOURCES = [
  { id: 'inmet', name: 'INMET — estações e previsão', org: 'Instituto Nacional de Meteorologia', kind: 'Meteorologia', status: 'down', note: 'Integração prevista. Sem conexão neste protótipo.' },
  { id: 'defesa', name: 'Defesa Civil do Estado de SP', org: 'Defesa Civil SP', kind: 'Alertas oficiais', status: 'down', note: 'Sem integração: nenhum alerta oficial é lido ou emitido por este sistema.' },
  { id: 'pmsbc', name: 'Prefeitura de São Bernardo do Campo', org: 'Assistência social / acolhimento', kind: 'Equipamentos e vagas', status: 'down', note: 'Ocupação e vagas dependem de integração ou de operadores autorizados.' },
  { id: 'ibge', name: 'IBGE — malhas e cartografia', org: 'IBGE', kind: 'Cartografia', status: 'down', note: 'Limite municipal oficial (código 3548708) ainda não importado. Importe um GeoJSON em Configurações.' },
  { id: 'eo', name: 'Observação da Terra', org: 'Landsat, Sentinel-2, MODIS/VIIRS', kind: 'Sensoriamento remoto', status: 'down', note: 'Produtos candidatos. Nenhum conectado.' },
  { id: 'ops', name: 'Registros operacionais', org: 'Equipes autorizadas', kind: 'Ocorrências e tarefas', status: 'sim', note: 'Registros de demonstração. Em produção virão de formulários autenticados.' }
];

/* ---------- Contexto municipal (fatos verificáveis e datados; editável sem reconstruir a interface) ---------- */
let CONTEXT = [
  { k: 'Operação Aquece São Bernardo 2026', v: 'Lançada em 1º/06/2026, com abordagem 24 h por dia até 30/09/2026. Período já encerrado.', ref: '01/06/2026 a 30/09/2026', pub: '02/06/2026', src: 'DGABC', url: 'https://www.dgabc.com.br/Noticia/4322117/sao-bernardo-lanca-acao-24h-para-pessoas-em-situacao-de-rua', status: 'hist' },
  { k: 'Centro de Acolhimento (Baeta Neves) — vagas de pernoite', v: '180 vagas, 80 ocupadas e 100 livres na data da reportagem.', ref: 'data da publicação', pub: '02/06/2026', src: 'DGABC', url: 'https://www.dgabc.com.br/Noticia/4322117/sao-bernardo-lanca-acao-24h-para-pessoas-em-situacao-de-rua', status: 'hist' },
  { k: 'Pessoas em situação de rua no município', v: '1.051 registros no Cadastro Único.', ref: 'mês de referência não informado', pub: '02/06/2026', src: 'DGABC (dado do CadÚnico)', url: 'https://www.dgabc.com.br/Noticia/4322117/sao-bernardo-lanca-acao-24h-para-pessoas-em-situacao-de-rua', status: 'hist' },
  { k: 'Sete cidades do ABC — vagas de pernoite e desabrigados', v: '474 vagas (sem moradias provisórias) e 2.827 desabrigados: uma vaga para cada seis pessoas.', ref: 'maio de 2026', pub: '02/06/2026', src: 'DGABC (dado do CadÚnico)', url: 'https://www.dgabc.com.br/Noticia/4322117/sao-bernardo-lanca-acao-24h-para-pessoas-em-situacao-de-rua', status: 'hist' },
  { k: 'Albergue municipal e equipe de abordagem (referência antiga)', v: '150 vagas em regime diuturno, 50 vagas emergenciais de inverno e 16 educadores de abordagem. Estrutura provavelmente superada.', ref: 'inverno de 2013', pub: '02/08/2013', src: 'ABC do ABC', url: 'https://abcdoabc.com.br/sao-bernardo-intensifica-atendimento-a-pessoas-em-situacao-de-rua-no-inverno-2/', status: 'hist' }
];

/* ---------- Equipamentos de acolhimento ---------- */
const SHELTERS = [
  { id: 'EQ-HIST-01', name: 'Centro de Acolhimento (Baeta Neves)', addr: 'Rua Tapajós, 10 — Baeta Neves', coord: 'não informada (geocodificação pendente)', hours: 'não informado na fonte', cap: 180, occ: 80, asOf: new Date(2026, 5, 2, 7, 0), src: 'DGABC, 02/06/2026', kind: 'hist', services: ['Pernoite', 'Higiene pessoal', 'Refeições'], status: 'Operando (dado histórico)', contact: 'Centro POP / Sedesc (contato a confirmar)', pos: { x: -0.30, y: 0.16 } },
  { id: 'EQ-DEMO-01', name: 'Unidade demonstrativa 01', addr: 'Endereço fictício', coord: 'esquemática', hours: '18h–08h', cap: 60, occ: 41, asOf: tAt(-2), src: 'Simulação interna', kind: 'sim', services: ['Pernoite', 'Refeições'], status: 'Operando', contact: 'não se aplica', pos: { x: 0.42, y: -0.38 } },
  { id: 'EQ-DEMO-02', name: 'Unidade demonstrativa 02', addr: 'Endereço fictício', coord: 'esquemática', hours: '24 h', cap: 80, occ: 77, asOf: tAt(-1), src: 'Simulação interna', kind: 'sim', services: ['Pernoite', 'Higiene', 'Triagem de saúde'], status: 'Quase lotada', contact: 'não se aplica', pos: { x: -0.05, y: -0.52 } },
  { id: 'EQ-DEMO-03', name: 'Unidade demonstrativa 03', addr: 'Endereço fictício', coord: 'esquemática', hours: '19h–07h', cap: 40, occ: 12, asOf: tAt(-5), src: 'Simulação interna', kind: 'sim', services: ['Pernoite'], status: 'Operando', contact: 'não se aplica', pos: { x: 0.12, y: 0.44 } },
  { id: 'EQ-DEMO-04', name: 'Unidade demonstrativa 04', addr: 'Endereço fictício', coord: 'esquemática', hours: '—', cap: 50, occ: 0, asOf: tAt(-26), src: 'Simulação interna', kind: 'sim', services: ['Pernoite', 'Refeições'], status: 'Indisponível', contact: 'não se aplica', pos: { x: 0.55, y: 0.30 } }
];

/* ---------- Alertas internos de DEMONSTRAÇÃO (não são alertas oficiais) ---------- */
const OPERATOR = 'Operador Demo';
const ALERTS = [
  { id: 'ALR-DEMO-0001', sev: 'critico', reg: 'E', type: 'Sensação térmica muito baixa', at: tAt(-1.2), src: 'Motor ColdAlert (simulado)', ev: ['Sensação térmica regional abaixo de 3 °C na janela de previsão', 'Vento acima de 20 km/h', 'Déficit de acolhimento alto no setor'], status: 'novo', owner: 'Defesa Civil (demo)', hist: [{ at: tAt(-1.2), who: 'Sistema', txt: 'Alerta gerado pelo motor de análise (simulado).' }] },
  { id: 'ALR-DEMO-0002', sev: 'alto', reg: 'A', type: 'Queda brusca de temperatura', at: tAt(-2.5), src: 'Motor ColdAlert (simulado)', ev: ['Queda superior a 6 °C em 12 h prevista', 'Vulnerabilidade agregada alta'], status: 'em análise', owner: 'Assistência Social (demo)', hist: [{ at: tAt(-2.5), who: 'Sistema', txt: 'Alerta gerado pelo motor de análise (simulado).' }, { at: tAt(-2.0), who: OPERATOR, txt: 'Status alterado para em análise.' }] },
  { id: 'ALR-DEMO-0003', sev: 'alto', reg: 'F', type: 'Vento forte com frio', at: tAt(-3.1), src: 'Motor ColdAlert (simulado)', ev: ['Exposição ao vento acima da média do município', 'Rajadas simuladas acima de 25 km/h'], status: 'novo', owner: 'Defesa Civil (demo)', hist: [{ at: tAt(-3.1), who: 'Sistema', txt: 'Alerta gerado pelo motor de análise (simulado).' }] },
  { id: 'ALR-DEMO-0004', sev: 'moderado', reg: 'C', type: 'Lotação de acolhimento acima de 85%', at: tAt(-6), src: 'Registros operacionais (simulado)', ev: ['Unidade demonstrativa 02 com 77 de 80 vagas ocupadas'], status: 'em atendimento', owner: 'Gestão de abrigos (demo)', hist: [{ at: tAt(-6), who: 'Sistema', txt: 'Alerta gerado por regra de ocupação (simulado).' }, { at: tAt(-5.2), who: OPERATOR, txt: 'Confirmado. Equipe acionada para avaliar ampliação de vagas.' }] },
  { id: 'ALR-DEMO-0005', sev: 'moderado', reg: 'H', type: 'Chuva fria prevista', at: tAt(-8), src: 'Motor ColdAlert (simulado)', ev: ['Precipitação prevista acima de 1,5 mm/h entre +6 h e +14 h'], status: 'confirmado', owner: 'Defesa Civil (demo)', hist: [{ at: tAt(-8), who: 'Sistema', txt: 'Alerta gerado pelo motor de análise (simulado).' }, { at: tAt(-7.5), who: OPERATOR, txt: 'Confirmado por operador.' }] },
  { id: 'ALR-DEMO-0006', sev: 'baixo', reg: 'D', type: 'Monitoramento de rotina', at: tAt(-20), src: 'Motor ColdAlert (simulado)', ev: ['Índice abaixo do limite de atenção'], status: 'encerrado', owner: 'Sala de situação (demo)', hist: [{ at: tAt(-20), who: 'Sistema', txt: 'Alerta gerado (simulado).' }, { at: tAt(-18), who: OPERATOR, txt: 'Encerrado: sem providências necessárias.' }] },
  { id: 'ALR-DEMO-0007', sev: 'alto', reg: 'B', type: 'Duração prolongada de frio', at: tAt(-27), src: 'Motor ColdAlert (simulado)', ev: ['Mais de 12 h com sensação térmica abaixo de 10 °C previstas'], status: 'encerrado', owner: 'Defesa Civil (demo)', hist: [{ at: tAt(-27), who: 'Sistema', txt: 'Alerta gerado (simulado).' }, { at: tAt(-25), who: OPERATOR, txt: 'Encerrado após atualização da previsão.' }] }
];
const ALERT_STATUS = ['novo', 'em análise', 'confirmado', 'em atendimento', 'encerrado'];

/* ---------- Ocorrências de DEMONSTRAÇÃO (sem dados pessoais) ---------- */
const TEAM_NAMES = ['Equipe Demo 01', 'Equipe Demo 02', 'Equipe Demo 03', 'Equipe Demo 04'];
const INC_TYPES = ['Ponto de atenção identificado', 'Vistoria de local', 'Falta de insumos (cobertores)', 'Encaminhamento a acolhimento', 'Equipamento indisponível', 'Verificação de abrigo informal'];
const INC_STATUS = ['Aberta', 'Em andamento', 'Encaminhada', 'Concluída'];
const INCIDENTS = [
  { id: 'OCO-DEMO-001', reg: 'E', type: INC_TYPES[0], prio: 'alta', team: TEAM_NAMES[0], status: 'Em andamento', at: tAt(-3.4), act: 'Equipe a caminho.', note: 'Registro agregado, sem identificação.', enc: '', pos: { x: -0.52, y: -0.08 } },
  { id: 'OCO-DEMO-002', reg: 'A', type: INC_TYPES[3], prio: 'alta', team: TEAM_NAMES[1], status: 'Encaminhada', at: tAt(-5.0), act: 'Encaminhamento realizado.', note: '', enc: 'Unidade demonstrativa 03', pos: { x: 0.10, y: 0.30 } },
  { id: 'OCO-DEMO-003', reg: 'F', type: INC_TYPES[2], prio: 'média', team: TEAM_NAMES[2], status: 'Aberta', at: tAt(-1.0), act: '', note: 'Reposição de insumos solicitada.', enc: '', pos: { x: -0.05, y: 0.55 } },
  { id: 'OCO-DEMO-004', reg: 'C', type: INC_TYPES[1], prio: 'média', team: TEAM_NAMES[3], status: 'Em andamento', at: tAt(-7.2), act: 'Vistoria iniciada.', note: '', enc: '', pos: { x: 0.40, y: -0.20 } },
  { id: 'OCO-DEMO-005', reg: 'H', type: INC_TYPES[4], prio: 'baixa', team: TEAM_NAMES[0], status: 'Concluída', at: tAt(-14), act: 'Unidade reativada.', note: '', enc: '', pos: { x: 0.28, y: -0.55 } },
  { id: 'OCO-DEMO-006', reg: 'B', type: INC_TYPES[5], prio: 'baixa', team: TEAM_NAMES[1], status: 'Aberta', at: tAt(-0.6), act: '', note: '', enc: '', pos: { x: 0.62, y: 0.05 } }
];
const TEAMS = [
  { name: TEAM_NAMES[0], state: 'Em campo', reg: 'E', pos: { x: -0.46, y: -0.02 } },
  { name: TEAM_NAMES[1], state: 'Em campo', reg: 'A', pos: { x: 0.04, y: 0.24 } },
  { name: TEAM_NAMES[2], state: 'Disponível', reg: 'F', pos: { x: -0.10, y: 0.48 } },
  { name: TEAM_NAMES[3], state: 'Em campo', reg: 'C', pos: { x: 0.34, y: -0.26 } }
];
const TASKS = [
  { id: 'TAR-DEMO-01', title: 'Vistoria de ponto de atenção', reg: 'E', team: TEAM_NAMES[0], prio: 'alta', status: 'Em andamento' },
  { id: 'TAR-DEMO-02', title: 'Reposição de cobertores', reg: 'F', team: TEAM_NAMES[2], prio: 'média', status: 'A fazer' },
  { id: 'TAR-DEMO-03', title: 'Verificar vagas da unidade 02', reg: 'C', team: TEAM_NAMES[3], prio: 'alta', status: 'Em andamento' },
  { id: 'TAR-DEMO-04', title: 'Ronda noturna ampliada', reg: 'A', team: TEAM_NAMES[1], prio: 'alta', status: 'A fazer' },
  { id: 'TAR-DEMO-05', title: 'Confirmar reativação de unidade', reg: 'H', team: TEAM_NAMES[0], prio: 'baixa', status: 'Concluída' },
  { id: 'TAR-DEMO-06', title: 'Atualizar ocupação das unidades', reg: 'B', team: TEAM_NAMES[1], prio: 'média', status: 'A fazer' }
];
const TASK_STATUS = ['A fazer', 'Em andamento', 'Concluída'];

/* ---------- Funções derivadas ---------- */
function shelterAge(s) { return (T0.getTime() - s.asOf.getTime()) / MS_H; }
function shelterStale(s) { return shelterAge(s) > 24; }
function ageText(hours) {
  if (hours < 1) return 'há ' + Math.max(1, Math.round(hours * 60)) + ' min';
  if (hours < 48) return 'há ' + Math.round(hours) + ' h';
  return 'há ' + Math.round(hours / 24) + ' dias';
}
const RECSTATE = {};
const REC_STATUS = ['Proposta', 'Em avaliação', 'Aprovada pelo gestor', 'Executada', 'Descartada'];

function regionOfPoint(p) { return TERR ? TERR.regionAt(p.x, p.y) : null; }
let TERR = null; // território atual (definido em gis.js)

function buildRecommendations() {
  const peakH = 24;
  const ov = overallAt(0), pk = overallAt(12);
  const out = [];
  const top = pk.top.slice(0, 3);
  top.forEach((t, i) => {
    out.push({
      id: 'REC-' + (i + 1) + t.r.id, prio: t.c.cls.rank >= 2 ? 'alta' : 'média', title: 'Reforçar o monitoramento no ' + t.r.name,
      why: 'Índice projetado em ' + Math.round(t.c.score) + ' pontos (' + t.c.cls.label.toLowerCase() + ') em +12 h, com vulnerabilidade agregada ' + t.r.vuln.toFixed(2).replace('.', ',') + '.',
      data: ['Índice projetado +12 h', 'Vulnerabilidade agregada (simulada)', 'Sensação térmica prevista'], owner: 'Sala de situação (sugestão)', reg: t.r.id
    });
  });
  const def = [...REGIONS].sort((a, b) => b.deficit - a.deficit)[0];
  out.push({ id: 'REC-ACOL', prio: 'alta', title: 'Avaliar a ampliação da capacidade de acolhimento', why: 'O ' + def.name + ' tem o maior déficit de acolhimento (' + def.deficit.toFixed(2).replace('.', ',') + ') e a Unidade demonstrativa 02 opera acima de 95% da capacidade.', data: ['Déficit de acolhimento (simulado)', 'Ocupação das unidades (simulada)'], owner: 'Assistência Social (sugestão)', reg: def.id });
  const openInc = INCIDENTS.filter(i => i.status === 'Aberta').length;
  out.push({ id: 'REC-VIST', prio: 'média', title: 'Priorizar vistorias de campo', why: openInc + ' ocorrência(s) aberta(s) aguardam equipe. Priorizar as de prioridade alta.', data: ['Ocorrências registradas (demo)'], owner: 'Operações de campo (sugestão)', reg: null });
  out.push({ id: 'REC-EQUIP', prio: 'média', title: 'Verificar a disponibilidade de equipamentos públicos', why: 'Uma unidade demonstrativa consta como indisponível há mais de 24 h.', data: ['Status operacional das unidades'], owner: 'Gestão de abrigos (sugestão)', reg: null });
  out.push({ id: 'REC-CAMP', prio: 'baixa', title: 'Avaliar campanha de prevenção', why: 'O período frio previsto se estende por mais de 24 h abaixo de 10 °C de sensação térmica.', data: ['Duração prevista do frio'], owner: 'Comunicação (sugestão)', reg: null });
  out.push({ id: 'REC-COM', prio: 'média', title: 'Intensificar a comunicação entre órgãos', why: 'Há ' + ALERTS.filter(a => a.status !== 'encerrado' && (a.sev === 'alto' || a.sev === 'critico')).length + ' alerta(s) internos altos ou críticos em aberto.', data: ['Central de alertas (demo)'], owner: 'Coordenação (sugestão)', reg: null });
  out.forEach(r => { if (!RECSTATE[r.id]) RECSTATE[r.id] = 'Proposta'; });
  return out;
}

/* Série histórica de DEMONSTRAÇÃO (não corresponde a medições reais). */
function histTemp(d) { // d = dias antes de hoje (0..90)
  const season = Math.cos(2 * Math.PI * (d - 40) / 365);
  return 16 + 4.5 * season + 3.2 * (vnoise(d * 0.35, 3, 11) - 0.5) * 2;
}
function histAlerts(d) { return Math.max(0, Math.round(3.2 * (1 - sig((histTemp(d) - 13) / 1.6)) * (0.6 + vnoise(d * 0.5, 9, 5)))); }
function histOcc(d) { return clamp(0.38 + 0.4 * (1 - sig((histTemp(d) - 13) / 2)) + 0.05 * (vnoise(d * 0.4, 7, 3) - 0.5), 0.1, 0.99); }
function histResp(regIdx) { return Math.round(18 + 22 * hash2(regIdx, 3, 99)); }
