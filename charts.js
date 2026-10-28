'use strict';
/* =====================================================================
   COLDALERT · componentes de gráfico (SVG puro, sem bibliotecas)
   ===================================================================== */
const C = { blue: '#168BFF', cyan: '#36D9FF', warn: '#FF9F43', crit: '#FF4D5E', ok: '#35D08A', yel: '#F5D547', mut: '#7F93B0', fg: '#EAF2FF', line: 'rgba(120,165,230,.16)' };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const fmt1 = v => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
const fmt0 = v => String(Math.round(v));

function sparkSVG(vals, w, h, color) {
  w = w || 120; h = h || 28; color = color || C.cyan;
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const sx = i => 1 + i / (vals.length - 1) * (w - 2);
  const sy = v => h - 2 - (v - mn) / (mx - mn || 1) * (h - 4);
  const d = vals.map((v, i) => (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(v).toFixed(1)).join('');
  const last = vals.length - 1;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Série curta"><path d="${d} L${sx(last).toFixed(1)} ${h} L1 ${h} Z" fill="${color}" opacity=".12"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${sx(last).toFixed(1)}" cy="${sy(vals[last]).toFixed(1)}" r="2.4" fill="${color}"/></svg>`;
}

function gaugeSVG(score, cls) {
  const cx = 130, cy = 124, r = 100;
  const pt = (v, rr) => { const a = Math.PI * (1 - clamp(v, 0, 100) / 100); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
  const arc = (v0, v1, rr) => { const [x0, y0] = pt(v0, rr), [x1, y1] = pt(v1, rr); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${rr} ${rr} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const t = PARAMS.th;
  const segs = [[0, t.low, CLASSES.baixo.color], [t.low, t.mod, CLASSES.moderado.color], [t.mod, t.high, CLASSES.alto.color], [t.high, 100, CLASSES.critico.color]];
  const [nx, ny] = pt(score, r);
  const ticks = [0, t.low, t.mod, t.high, 100].map(v => { const [x, y] = pt(v, r + 14); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${v}</text>`; }).join('');
  return `<svg class="gauge" viewBox="0 0 260 150" role="img" aria-label="Índice ${fmt0(score)} de 100, classificação ${cls.label}">
    ${segs.map(s => `<path d="${arc(s[0], s[1], r)}" stroke="${s[2]}" stroke-width="12" fill="none" opacity=".28"/>`).join('')}
    <path d="${arc(0, Math.max(score, 0.5), r)}" stroke="${cls.color}" stroke-width="12" fill="none" stroke-linecap="butt"/>
    <circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="8" fill="#050912" stroke="${cls.color}" stroke-width="3"/>
    <g class="gt">${ticks}</g>
    <text x="${cx}" y="${cy - 10}" text-anchor="middle" class="g-num">${fmt0(score)}</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" class="g-cls" fill="${cls.color}">${cls.label}</text>
  </svg>`;
}


function watchChart(el, fn, o, W) {
  if (el._ro || !window.ResizeObserver) { el._W = W; return; }
  el._W = W; el._fn = fn; el._o = o;
  let t = 0;
  el._ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { if (!el.isConnected) { el._ro.disconnect(); return; } const w = Math.round(el.clientWidth); if (w > 0 && Math.abs(w - el._W) > 10) el._fn(el, el._o); }, 120); });
  el._ro.observe(el);
}

/* ---------- Gráfico de linhas com cruzamento interativo ---------- */
function chartLine(el, o) {
  const W = o.w || Math.max(300, Math.round(el.clientWidth || 640)), H = o.h || 260, m = { l: 42, r: o.rightPad || 16, t: 16, b: 30 };
  const xs = o.xs, x0 = xs[0], x1 = xs[xs.length - 1];
  const vals = o.series.flatMap(s => s.vals.filter(v => v != null));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const rawStep = (Math.max(hi - lo, 1e-6) * 1.12) / 5, mag = Math.pow(10, Math.floor(Math.log10(rawStep))), nstep = [1, 2, 2.5, 5, 10].map(m => m * mag).find(v => v >= rawStep) || 10 * mag;
  let y0 = o.ymin != null ? o.ymin : Math.floor(lo / nstep) * nstep;
  let y1 = o.ymax != null ? o.ymax : Math.ceil(hi / nstep) * nstep;
  if (y1 - y0 < nstep) y1 = y0 + nstep;
  if (o.ymin == null && o.ymax == null) o.yticks = Math.round((y1 - y0) / nstep);
  const X = x => m.l + (x - x0) / (x1 - x0 || 1) * (W - m.l - m.r);
  const Y = y => H - m.b - (y - y0) / (y1 - y0 || 1) * (H - m.t - m.b);
  const yt = o.yticks || 5;
  let g = '';
  for (let i = 0; i <= yt; i++) {
    const v = y0 + (y1 - y0) * i / yt;
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="grid"/><text x="${m.l - 6}" y="${Y(v).toFixed(1)}" text-anchor="end" dominant-baseline="middle">${o.yfmt ? o.yfmt(v) : fmt0(v)}</text>`;
  }
  const xstep = o.xstep || Math.max(1, Math.round((x1 - x0) / 6));
  for (let x = Math.ceil(x0 / xstep) * xstep; x <= x1 + 1e-6; x += xstep) {
    g += `<line x1="${X(x).toFixed(1)}" x2="${X(x).toFixed(1)}" y1="${m.t}" y2="${H - m.b}" class="grid v"/><text x="${X(x).toFixed(1)}" y="${H - 9}" text-anchor="middle">${o.xfmt ? o.xfmt(x) : x}</text>`;
  }
  let bands = '';
  (o.bands || []).forEach(b => {
    const bx0 = X(clamp(b.x0, x0, x1)), bx1 = X(clamp(b.x1, x0, x1));
    if (bx1 - bx0 < 1) return;
    bands += `<rect x="${bx0.toFixed(1)}" y="${m.t}" width="${(bx1 - bx0).toFixed(1)}" height="${H - m.t - m.b}" fill="${b.color}" opacity="${b.op || 0.12}"/>`;
    if (b.label) bands += `<text x="${(bx0 + 4).toFixed(1)}" y="${m.t + 11}" class="blabel" fill="${b.color}" text-anchor="start">${esc(b.label)}</text>`;
  });
  let hl = '';
  (o.hlines || []).forEach(l => {
    hl += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(l.y).toFixed(1)}" y2="${Y(l.y).toFixed(1)}" stroke="${l.color}" stroke-dasharray="4 4" opacity=".85"/><text x="${W - m.r - 4}" y="${(Y(l.y) - 5).toFixed(1)}" text-anchor="end" class="blabel" fill="${l.color}">${esc(l.label)}</text>`;
  });
  let vl = '';
  (o.vlines || []).forEach(l => {
    vl += `<line x1="${X(l.x).toFixed(1)}" x2="${X(l.x).toFixed(1)}" y1="${m.t}" y2="${H - m.b}" stroke="${l.color || C.fg}" stroke-dasharray="2 3" opacity=".8"/><text x="${(X(l.x) + 4).toFixed(1)}" y="${H - m.b - 6}" class="blabel" fill="${l.color || C.fg}">${esc(l.label)}</text>`;
  });
  let paths = '';
  o.series.forEach((s, si) => {
    let d = '', pen = false;
    s.vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; });
    if (s.area) {
      const first = s.vals.findIndex(v => v != null);
      paths += `<path d="${d} L${X(xs[xs.length - 1]).toFixed(1)} ${Y(y0)} L${X(xs[first]).toFixed(1)} ${Y(y0)} Z" fill="${s.color}" opacity=".10"/>`;
    }
    paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  el.innerHTML = `<svg class="ch" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(o.label || 'Gráfico de linhas')}">${bands}${g}${hl}${vl}${paths}<g class="xh" hidden><line y1="${m.t}" y2="${H - m.b}" stroke="${C.fg}" opacity=".5"/>${o.series.map(s => `<circle r="3.6" fill="${s.color}" stroke="#050912" stroke-width="1.5"/>`).join('')}</g><rect class="hit" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/></svg>
  <div class="ch-tip" hidden></div>
  ${o.series.length > 1 || o.legend ? `<div class="ch-leg">${o.series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}`;
  watchChart(el, chartLine, o, W);
  const svg = el.querySelector('svg'), hit = el.querySelector('.hit'), xh = el.querySelector('.xh'), tip = el.querySelector('.ch-tip');
  const move = ev => {
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width * W;
    const xv = x0 + (px - m.l) / (W - m.l - m.r) * (x1 - x0);
    let bi = 0, bd = Infinity;
    xs.forEach((x, i) => { const d = Math.abs(x - xv); if (d < bd) { bd = d; bi = i; } });
    const cx = X(xs[bi]);
    xh.hidden = false;
    xh.querySelector('line').setAttribute('x1', cx); xh.querySelector('line').setAttribute('x2', cx);
    xh.querySelectorAll('circle').forEach((c, si) => { const v = o.series[si].vals[bi]; if (v == null) { c.setAttribute('opacity', 0); } else { c.setAttribute('opacity', 1); c.setAttribute('cx', cx); c.setAttribute('cy', Y(v)); } });
    tip.hidden = false;
    tip.innerHTML = `<b>${o.tipx ? o.tipx(xs[bi]) : (o.xfmt ? o.xfmt(xs[bi]) : xs[bi])}</b>` + o.series.map(s => s.vals[bi] == null ? '' : `<span><i style="background:${s.color}"></i>${esc(s.name)}: ${o.tipfmt ? o.tipfmt(s.vals[bi]) : fmt1(s.vals[bi])}</span>`).join('');
    const left = cx / W * r.width;
    tip.style.left = clamp(left + 12, 4, r.width - 150) + 'px';
  };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', () => { xh.hidden = true; tip.hidden = true; });
}

/* ---------- Gráfico de barras (agrupado ou empilhado) ---------- */
function chartBars(el, o) {
  const W = o.w || Math.max(300, Math.round(el.clientWidth || 600)), H = o.h || 240, m = { l: 40, r: 12, t: 14, b: 34 };
  const n = o.cats.length, ns = o.series.length;
  const tot = o.cats.map((_, i) => o.series.reduce((a, s) => a + (s.vals[i] || 0), 0));
  const ymax = o.ymax != null ? o.ymax : Math.max(1, Math.ceil(o.stack ? Math.max(...tot) : Math.max(...o.series.flatMap(s => s.vals))) * 1.1);
  const Y = v => H - m.b - v / ymax * (H - m.t - m.b);
  const bw = (W - m.l - m.r) / n;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = ymax * i / 4;
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="grid"/><text x="${m.l - 6}" y="${Y(v).toFixed(1)}" text-anchor="end" dominant-baseline="middle">${o.yfmt ? o.yfmt(v) : fmt0(v)}</text>`;
  }
  let bars = '';
  o.cats.forEach((c, i) => {
    const gx = m.l + i * bw;
    if (o.stack) {
      let acc = 0;
      o.series.forEach(s => {
        const v = s.vals[i] || 0;
        bars += `<rect x="${(gx + bw * 0.18).toFixed(1)}" y="${Y(acc + v).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(0, Y(acc) - Y(acc + v)).toFixed(1)}" fill="${s.color}"><title>${esc(c)} · ${esc(s.name)}: ${o.tipfmt ? o.tipfmt(v) : fmt1(v)}</title></rect>`;
        acc += v;
      });
    } else {
      const w = bw * 0.72 / ns;
      o.series.forEach((s, si) => {
        const v = s.vals[i] || 0;
        bars += `<rect x="${(gx + bw * 0.14 + si * w).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${(w - 1).toFixed(1)}" height="${Math.max(0, Y(0) - Y(v)).toFixed(1)}" fill="${(o.colors && o.colors[i]) || s.color}"><title>${esc(c)} · ${esc(s.name)}: ${o.tipfmt ? o.tipfmt(v) : fmt1(v)}</title></rect>`;
      });
    }
    bars += `<text x="${(gx + bw / 2).toFixed(1)}" y="${H - 14}" text-anchor="middle">${esc(c)}</text>`;
  });
  el.innerHTML = `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Gráfico de barras')}">${g}${bars}</svg>${o.series.length > 1 ? `<div class="ch-leg">${o.series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}`;
  watchChart(el, chartBars, o, W);
}
