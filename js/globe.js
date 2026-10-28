'use strict';
/* =====================================================================
   COLDALERT · globo terrestre (canvas 2D, projeção ortográfica)
   Honestidade cartográfica: não há contornos de continentes nesta versão.
   O globo mostra esfera, atmosfera, iluminação solar aproximada (terminador),
   graticule e marcadores com coordenadas reais de cidades.
   ===================================================================== */
const D2R = Math.PI / 180;
const PLACES = {
  sbc: { name: 'São Bernardo do Campo', lat: -23.69, lon: -46.56, real: true },
  sp: { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  bsb: { name: 'Brasília', lat: -15.79, lon: -47.88 },
  rio: { name: 'Rio de Janeiro', lat: -22.91, lon: -43.17 },
  cwb: { name: 'Curitiba', lat: -25.43, lon: -49.27 },
  bh: { name: 'Belo Horizonte', lat: -19.92, lon: -43.94 },
  poa: { name: 'Porto Alegre', lat: -30.03, lon: -51.22 }
};
const GLOBE_STAGES = [
  { k: 'terra', label: 'Terra', lat: 10, lon: -35, z: 1, d: 'Visão global' },
  { k: 'amsul', label: 'América do Sul', lat: -15, lon: -58, z: 2.5, d: 'Continente' },
  { k: 'brasil', label: 'Brasil', lat: -14, lon: -52, z: 4.4, d: 'Escopo nacional (expansão prevista)' },
  { k: 'sp', label: 'Estado de São Paulo', lat: -22.6, lon: -48.5, z: 13, d: 'Escopo estadual (expansão prevista)' },
  { k: 'abc', label: 'ABC Paulista', lat: -23.66, lon: -46.55, z: 90, d: 'Escopo regional (expansão prevista)' },
  { k: 'sbc', label: 'São Bernardo do Campo', lat: -23.69, lon: -46.56, z: 380, d: 'Município monitorado' },
  { k: 'prio', label: 'Áreas prioritárias', lat: -23.69, lon: -46.56, z: 900, d: 'Setores de atenção (simulado)' }
];

class Globe {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.off = document.createElement('canvas'); this.octx = this.off.getContext('2d');
    this.cam = { lat: GLOBE_STAGES[0].lat, lon: GLOBE_STAGES[0].lon, z: 1 };
    this.stage = 0; this.tween = null; this.auto = true; this.running = false; this.t0 = performance.now();
    this.drag = null; this.hoverPlace = null; this.onStage = null; this.onDone = null;
    this.reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.stars = Array.from({ length: 220 }, (_, i) => ({ x: hash2(i, 1, 1), y: hash2(i, 2, 2), r: 0.3 + hash2(i, 3, 3) * 1.1, a: 0.25 + hash2(i, 4, 4) * 0.6 }));
    this.sun = this.sunDir(new Date());
    {
      canvas.addEventListener('pointerdown', e => { if (this.stage > 1) return; canvas.setPointerCapture(e.pointerId); this.drag = { x: e.clientX, y: e.clientY, lat: this.cam.lat, lon: this.cam.lon }; this.auto = false; });
      canvas.addEventListener('pointermove', e => {
        if (!this.drag) return;
        const k = 0.3 / this.cam.z;
        this.cam.lon = this.drag.lon - (e.clientX - this.drag.x) * k;
        this.cam.lat = clamp(this.drag.lat + (e.clientY - this.drag.y) * k, -80, 80);
        this.draw();
      });
      const up = () => { this.drag = null; };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    }
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas.parentElement);
    this.resize();
  }
  sunDir(d) {
    const doy = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000;
    const decl = 23.44 * Math.sin(2 * Math.PI * (doy - 81) / 365) * D2R;
    const hrs = d.getUTCHours() + d.getUTCMinutes() / 60;
    const lon = -(hrs - 12) * 15 * D2R;
    return [Math.cos(decl) * Math.cos(lon), Math.cos(decl) * Math.sin(lon), Math.sin(decl)];
  }
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    this.w = Math.max(10, r.width); this.h = Math.max(10, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr);
    this.q = Math.max(2, Math.round(Math.max(this.w, this.h) / 420));
    this.off.width = Math.ceil(this.w / this.q); this.off.height = Math.ceil(this.h / this.q);
    this.img = this.octx.createImageData(this.off.width, this.off.height);
    this.draw();
  }
  get R() { return Math.min(this.w, this.h) * 0.40 * this.cam.z * (this.w < 700 ? 0.92 : 1); }
  get cy() { return this.h * (this.w < 700 ? 0.33 : 0.5); }
  get cx() { return this.w * (this.w < 900 ? 0.5 : 0.66); }
  basis() {
    const la = this.cam.lat * D2R, lo = this.cam.lon * D2R;
    return {
      c: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)],
      e: [-Math.sin(lo), Math.cos(lo), 0],
      n: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)]
    };
  }
  proj(lat, lon, B) {
    const la = lat * D2R, lo = lon * D2R, v = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    const z = v[0] * B.c[0] + v[1] * B.c[1] + v[2] * B.c[2];
    const x = v[0] * B.e[0] + v[1] * B.e[1] + v[2] * B.e[2];
    const y = v[0] * B.n[0] + v[1] * B.n[1] + v[2] * B.n[2];
    const R = this.R;
    return { x: this.cx + x * R, y: this.cy - y * R, z };
  }
  /* ----- animação ----- */
  start() { if (this.running) return; this.running = true; this.last = performance.now(); const loop = t => { if (!this.running) return; this.step(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  stop() { this.running = false; }
  step(t) {
    const dt = Math.min(0.12, (t - this.last) / 1000); this.last = t;
    if (this.tween) {
      const tw = this.tween; tw.t += dt / tw.dur;
      const u = Math.min(1, tw.t), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      let dl = tw.to.lon - tw.from.lon; dl = ((dl + 540) % 360) - 180;
      this.cam.lon = tw.from.lon + dl * e; this.cam.lat = lerp(tw.from.lat, tw.to.lat, e);
      this.cam.z = Math.exp(lerp(Math.log(tw.from.z), Math.log(tw.to.z), e));
      if (u >= 1) { const cb = tw.cb; this.tween = null; if (cb) cb(); }
    } else if (this.auto && this.stage === 0 && !this.reduced) this.cam.lon += dt * 3.2;
    this.draw();
  }
  goStage(i, dur, cb) {
    i = clamp(i, 0, GLOBE_STAGES.length - 1);
    const s = GLOBE_STAGES[i]; this.stage = i; this.auto = false;
    if (this.onStage) this.onStage(i);
    if (this.reduced || dur === 0) { this.cam = { lat: s.lat, lon: s.lon, z: s.z }; this.tween = null; this.draw(); if (cb) cb(); return; }
    this.tween = { from: Object.assign({}, this.cam), to: { lat: s.lat, lon: s.lon, z: s.z }, t: 0, dur: dur || 2.2, cb };
  }
  flyTo(i, per, cb) { // percorre os estágios em sequência
    const go = k => { if (k > i) { if (cb) cb(); return; } this.goStage(k, per, () => go(k + 1)); };
    go(this.stage + (this.stage < i ? 1 : 0));
  }
  /* ----- desenho ----- */
  draw() {
    const ctx = this.ctx, W = this.w, H = this.h; if (!W) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#03060d'; ctx.fillRect(0, 0, W, H);
    const neb = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, Math.max(W, H) * 0.7);
    neb.addColorStop(0, 'rgba(22,139,255,.07)'); neb.addColorStop(1, 'rgba(5,9,18,0)');
    ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
    for (const s of this.stars) { ctx.fillStyle = `rgba(200,225,255,${s.a})`; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 6.283); ctx.fill(); }
    const B = this.basis(), R = this.R, cx = this.cx, cy = this.cy;
    // halo atmosférico
    if (R < Math.max(W, H) * 2) {
      const g = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.12);
      g.addColorStop(0, 'rgba(54,160,255,.55)'); g.addColorStop(0.35, 'rgba(22,139,255,.16)'); g.addColorStop(1, 'rgba(22,139,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, 6.283); ctx.fill();
    }
    this.shadeSphere(B);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.clip();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.off, 0, 0, this.off.width * this.q, this.off.height * this.q);
    ctx.restore();
    this.drawGraticule(ctx, B);
    this.drawPlaces(ctx, B);
  }
  shadeSphere(B) {
    const w = this.off.width, h = this.off.height, d = this.img.data, q = this.q, R = this.R, cx = this.cx, cy = this.cy, S = this.sun;
    const near = this.cam.z > 20;
    for (let j = 0; j < h; j++) {
      const py = (j + 0.5) * q;
      for (let i = 0; i < w; i++) {
        const px = (i + 0.5) * q, x = (px - cx) / R, y = -(py - cy) / R, r2 = x * x + y * y, o = (j * w + i) * 4;
        if (r2 >= 1) { d[o + 3] = 0; continue; }
        const z = Math.sqrt(1 - r2);
        const nx = x * B.e[0] + y * B.n[0] + z * B.c[0], ny = x * B.e[1] + y * B.n[1] + z * B.c[1], nz = x * B.e[2] + y * B.n[2] + z * B.c[2];
        const lit = nx * S[0] + ny * S[1] + nz * S[2];
        const day = clamp((lit + 0.12) / 0.34, 0, 1), twi = Math.exp(-Math.pow(lit / 0.09, 2));
        const rim = Math.pow(1 - z, 3);
        const lat = Math.asin(nz), shade = 0.78 + 0.22 * z;
        // oceano: azul profundo com leve variação latitudinal; sem continentes
        let r = lerp(5, 18, day) * shade, g = lerp(12, 56, day) * shade, b = lerp(26, 104, day) * shade;
        r += 190 * twi * 0.22 * (1 - Math.abs(lat) / 2); g += 70 * twi * 0.2; b += 20 * twi * 0.1;
        r += 30 * rim * (0.3 + day); g += 110 * rim * (0.3 + day); b += 200 * rim * (0.4 + day * 0.6);
        if (near) { r = lerp(r, 20, 0.5); g = lerp(g, 52, 0.5); b = lerp(b, 98, 0.5); }
        d[o] = clamp(r, 0, 255); d[o + 1] = clamp(g, 0, 255); d[o + 2] = clamp(b, 0, 255); d[o + 3] = 255;
      }
    }
    this.octx.putImageData(this.img, 0, 0);
  }
  drawGraticule(ctx, B) {
    const R = this.R, spanDeg = Math.min(180, (Math.max(this.w, this.h) / (R * D2R)) * 0.75);
    const steps = [30, 15, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
    let st = steps[steps.length - 1];
    for (const s of steps) { if (spanDeg / s <= 9) { st = s; break; } }
    const lat0 = this.cam.lat, lon0 = this.cam.lon, half = Math.min(90, spanDeg);
    const la0 = Math.max(-90, Math.floor((lat0 - half) / st) * st), la1 = Math.min(90, Math.ceil((lat0 + half) / st) * st);
    const lo0 = Math.floor((lon0 - half * 1.2) / st) * st, lo1 = Math.ceil((lon0 + half * 1.2) / st) * st;
    ctx.save(); ctx.lineWidth = 1;
    const line = (pts, major) => {
      ctx.strokeStyle = major ? (this.cam.z > 20 ? 'rgba(190,230,255,.7)' : 'rgba(120,200,255,.42)') : (this.cam.z > 20 ? 'rgba(170,215,255,.38)' : 'rgba(120,180,255,.18)'); ctx.beginPath(); let pen = false;
      for (const p of pts) { if (p.z <= 0.01) { pen = false; continue; } if (pen) ctx.lineTo(p.x, p.y); else { ctx.moveTo(p.x, p.y); pen = true; } }
      ctx.stroke();
    };
    const N = 28;
    for (let la = la0; la <= la1 + 1e-9; la += st) {
      const pts = []; for (let k = 0; k <= N; k++) pts.push(this.proj(la, lo0 + (lo1 - lo0) * k / N, B));
      line(pts, Math.abs(la) < 1e-6 || Math.abs(Math.abs(la) - 23.4365) < 1e-6);
    }
    for (let lo = lo0; lo <= lo1 + 1e-9; lo += st) {
      const pts = []; for (let k = 0; k <= N; k++) pts.push(this.proj(la0 + (la1 - la0) * k / N, lo, B));
      line(pts, Math.abs(((lo % 360) + 360) % 360) < 1e-6);
    }
    // trópico de Capricórnio (referência real: 23,4365° S)
    const trop = []; for (let k = 0; k <= 90; k++) trop.push(this.proj(-23.4365, lo0 + (lo1 - lo0) * k / 90, B));
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(54,217,255,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); let pen = false;
    for (const p of trop) { if (p.z <= 0.01) { pen = false; continue; } if (pen) ctx.lineTo(p.x, p.y); else { ctx.moveTo(p.x, p.y); pen = true; } }
    ctx.stroke(); ctx.restore();
  }
  arc(a, b, B, n) {
    const va = [Math.cos(a.lat * D2R) * Math.cos(a.lon * D2R), Math.cos(a.lat * D2R) * Math.sin(a.lon * D2R), Math.sin(a.lat * D2R)];
    const vb = [Math.cos(b.lat * D2R) * Math.cos(b.lon * D2R), Math.cos(b.lat * D2R) * Math.sin(b.lon * D2R), Math.sin(b.lat * D2R)];
    const om = Math.acos(clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1)), so = Math.sin(om) || 1, out = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, f1 = Math.sin((1 - t) * om) / so, f2 = Math.sin(t * om) / so;
      const v = [f1 * va[0] + f2 * vb[0], f1 * va[1] + f2 * vb[1], f1 * va[2] + f2 * vb[2]];
      const lat = Math.asin(v[2]) / D2R, lon = Math.atan2(v[1], v[0]) / D2R;
      out.push(this.proj(lat, lon, B));
    }
    return out;
  }
  drawPlaces(ctx, B) {
    const t = (performance.now() - this.t0) / 1000, z = this.cam.z;
    const sbc = PLACES.sbc;
    if (z < 60) {
      ctx.save(); ctx.lineWidth = 1.3; ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * 14;
      Object.keys(PLACES).filter(k => k !== 'sbc' && k !== 'sp').forEach(k => {
        const pts = this.arc(sbc, PLACES[k], B, 24); ctx.strokeStyle = 'rgba(54,217,255,.5)'; ctx.beginPath(); let pen = false;
        for (const p of pts) { if (p.z <= 0.02) { pen = false; continue; } if (pen) ctx.lineTo(p.x, p.y); else { ctx.moveTo(p.x, p.y); pen = true; } }
        ctx.stroke();
      });
      ctx.restore();
    }
    Object.keys(PLACES).forEach(k => {
      const pl = PLACES[k], p = this.proj(pl.lat, pl.lon, B); if (p.z <= 0.02) return;
      if (k === 'sp' && z > 30) return;
      const main = k === 'sbc';
      const col = main ? '#FF9F43' : '#36D9FF';
      ctx.save();
      if (main) { const pr = (t * 0.8) % 1; ctx.strokeStyle = `rgba(255,159,67,${1 - pr})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + pr * 26, 0, 6.283); ctx.stroke(); }
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, main ? 16 : 10); glow.addColorStop(0, main ? 'rgba(255,159,67,.9)' : 'rgba(54,217,255,.8)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, main ? 16 : 10, 0, 6.283); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, main ? 3.6 : 2.4, 0, 6.283); ctx.fill();
      const show = main || z > 2 || k === 'bsb';
      if (show && (main || z < 30)) {
        ctx.font = (main ? '600 12px' : '500 10px') + ' "IBM Plex Mono", monospace'; ctx.fillStyle = main ? '#FFD9B0' : 'rgba(180,225,255,.85)'; ctx.textBaseline = 'middle';
        const lab = main ? 'SÃO BERNARDO DO CAMPO' : pl.name.toUpperCase(); ctx.shadowColor = '#03060d'; ctx.shadowBlur = 4;
        ctx.fillText(lab, p.x + 12, p.y - (main ? 2 : 0));
        if (main && z < 30) { ctx.font = '500 9px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(180,200,225,.8)'; ctx.fillText('23,69° S · 46,56° W', p.x + 12, p.y + 12); }
      }
      ctx.restore();
    });
    // esquema operacional sobre o município (estágio final)
    if (z > 500 && typeof TERR !== 'undefined' && TERR) {
      const a = clamp((z - 500) / 350, 0, 1), p0 = this.proj(sbc.lat, sbc.lon, B), S = Math.min(this.w, this.h) / 2.9, hr = HEX_S * S * 0.985;
      ctx.save(); ctx.globalAlpha = a;
      for (const c of TERR.cells) {
        const sc = criAt(REGIONS[c.reg], 0).score + (c.n - 0.5) * 11, col = gradRGB(sc, RISK_STOPS), px = p0.x + c.x * S, py = p0.y + c.y * S;
        ctx.beginPath(); for (let j = 0; j < 6; j++) { const X = px + hr * HEXV[j][0], Y = py + hr * HEXV[j][1]; if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
        ctx.closePath(); ctx.fillStyle = rgbCss(col, 0.8); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(54,217,255,.9)'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (const sg of TERR.outlineSegs) { ctx.moveTo(p0.x + sg[0] * S, p0.y + sg[1] * S); ctx.lineTo(p0.x + sg[2] * S, p0.y + sg[3] * S); }
      ctx.stroke();
      ctx.font = '500 10px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(234,242,255,.85)'; ctx.textAlign = 'center';
      ctx.fillText('ESQUEMA OPERACIONAL · SEM GEORREFERÊNCIA · DADO SIMULADO', p0.x, p0.y + S * 1.0);
      ctx.restore();
    }
    // retículo de alvo no estágio final
    if (z > 150 && z < 700) {
      const p = this.proj(sbc.lat, sbc.lon, B); ctx.save(); ctx.strokeStyle = 'rgba(54,217,255,.7)'; ctx.lineWidth = 1.2;
      const r = 46 + 4 * Math.sin(t * 2);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.moveTo(p.x - r - 12, p.y); ctx.lineTo(p.x - r + 10, p.y); ctx.moveTo(p.x + r - 10, p.y); ctx.lineTo(p.x + r + 12, p.y); ctx.moveTo(p.x, p.y - r - 12); ctx.lineTo(p.x, p.y - r + 10); ctx.moveTo(p.x, p.y + r - 10); ctx.lineTo(p.x, p.y + r + 12); ctx.stroke(); ctx.restore();
    }
  }
  destroy() { this.stop(); try { this.ro.disconnect(); } catch (e) { /* noop */ } }
}
