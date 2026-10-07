// Kleine SVG-Diagramme ohne Abhängigkeiten. Tooltips über data-tip.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtShort = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: n < 10 ? 1 : 0 });

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find((x) => f <= x) * p;
}

function yAxis(max, w, h, pad, ticks = 4) {
  let out = '';
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    const y = pad.t + h - (h * i) / ticks;
    out += `<line x1="${pad.l}" x2="${pad.l + w}" y1="${y}" y2="${y}" class="grid"/>`;
    out += `<text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" class="axis">${fmtShort(v)}</text>`;
  }
  return out;
}

// X-Achsen-Beschriftung, die sich nicht überlappt: bei wenig Platz „'24“ statt „2024“,
// bei noch weniger Platz nur jede n-te Beschriftung (die letzte immer).
const CHAR_W = 6.6; // ca. Breite eines Zeichens bei 11px
function xLabeler(labels, slot) {
  const maxLen = Math.max(...labels.map((l) => String(l).length));
  const isYear = labels.every((l) => /^\d{4}$/.test(l));
  const short = isYear && maxLen * CHAR_W + 6 > slot;
  const len = short ? 3 : maxLen;
  const step = Math.max(1, Math.ceil((len * CHAR_W + 6) / slot));
  const n = labels.length;
  return (i) => {
    const show = (n - 1 - i) % step === 0;
    if (!show) return '';
    return short ? "'" + String(labels[i]).slice(2) : String(labels[i]);
  };
}
const fits = (text, slot) => String(text).length * CHAR_W + 4 <= slot;

// series: [{name, color, values:[number|null]}], labels: [string]
// forecastFrom: Index ab dem die Werte Prognosen sind (gestrichelt, hohler Punkt)
export function lineChart(el, { labels, series, unit = '€', height = 220, forecastFrom = null }) {
  const W = Math.max(280, el.clientWidth || 320);
  const pad = { t: 14, r: 18, b: 28, l: 48 };
  const w = W - pad.l - pad.r, h = height - pad.t - pad.b;
  const max = niceMax(Math.max(...series.flatMap((s) => s.values.filter((v) => v != null)), 1) * 1.08);
  const n = labels.length;
  const x = (i) => pad.l + (n === 1 ? w / 2 : (w * i) / (n - 1));
  const y = (v) => pad.t + h - (h * v) / max;
  const colW = n === 1 ? w : w / (n - 1);
  const lab = xLabeler(labels, colW);
  const isF = (i) => forecastFrom != null && i >= forecastFrom;

  let svg = yAxis(max, w, h, pad);
  if (forecastFrom != null && forecastFrom < n) {
    const fx = x(forecastFrom) - (n > 1 ? colW / 2 : 0);
    svg += `<rect x="${Math.max(pad.l, fx)}" y="${pad.t}" width="${pad.l + w + pad.r - Math.max(pad.l, fx)}" height="${h}" class="fc-band"/>`;
  }
  labels.forEach((l, i) => { const t = lab(i); if (t) svg += `<text x="${x(i)}" y="${height - 8}" text-anchor="middle" class="axis${isF(i) ? ' fc' : ''}">${esc(t)}</text>`; });

  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => (v == null ? null : { i, p: [x(i), y(v)] })).filter(Boolean);
    if (!pts.length) return;
    const solid = pts.filter((q) => !isF(q.i));
    const path = (arr) => arr.map((q, k) => `${k ? 'L' : 'M'}${q.p[0].toFixed(1)},${q.p[1].toFixed(1)}`).join('');
    if (si === 0 && solid.length > 1) {
      svg += `<path d="${path(solid)}L${solid[solid.length - 1].p[0]},${pad.t + h}L${solid[0].p[0]},${pad.t + h}Z" fill="${s.color}" opacity=".1"/>`;
    }
    if (solid.length > 1) svg += `<path d="${path(solid)}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const fpts = pts.filter((q) => isF(q.i));
    if (fpts.length) {
      const seg = solid.length ? [solid[solid.length - 1], ...fpts] : fpts;
      if (seg.length > 1) svg += `<path d="${path(seg)}" fill="none" stroke="${s.color}" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"/>`;
    }
    pts.forEach((q) => {
      svg += isF(q.i)
        ? `<circle cx="${q.p[0]}" cy="${q.p[1]}" r="4" fill="var(--card)" stroke="${s.color}" stroke-width="2"/>`
        : `<circle cx="${q.p[0]}" cy="${q.p[1]}" r="4" fill="${s.color}" stroke="var(--card)" stroke-width="2"/>`;
    });
  });

  // Hover-Spalten
  labels.forEach((l, i) => {
    const tip = `<b>${esc(l)}${isF(i) ? ' · Prognose' : ''}</b>` + series.map((s) => s.values[i] == null ? '' :
      `<br><span class="dot" style="background:${s.color}"></span>${esc(s.name)}: ${s.values[i].toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`).join('');
    svg += `<rect x="${x(i) - colW / 2}" y="${pad.t}" width="${colW}" height="${h}" fill="transparent" data-tip="${esc(tip)}" data-cross="${x(i)}"/>`;
  });
  svg += `<line class="crosshair" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + h}" style="display:none"/>`;
  el.innerHTML = `<svg width="${W}" height="${height}" role="img">${svg}</svg>`;
}

// bars: [{label, value, color?, tip?, marker?, estimated?}] – marker = Vergleichswert (Strich)
export function barChart(el, { bars, unit = '', height = 200, color = 'var(--c1)', digits = 0 }) {
  const W = Math.max(260, el.clientWidth || 320);
  const pad = { t: 18, r: 12, b: 28, l: 48 };
  const w = W - pad.l - pad.r, h = height - pad.t - pad.b;
  const max = niceMax(Math.max(...bars.map((b) => Math.max(b.value || 0, b.marker || 0)), 1) * 1.1);
  const n = bars.length;
  const slot = w / Math.max(n, 1);
  const bw = Math.max(4, Math.min(44, slot * 0.6));
  const lab = xLabeler(bars.map((b) => b.label), slot);
  const valTxt = (b) => (b.value || 0).toLocaleString('de-DE', { maximumFractionDigits: digits });
  const showVals = bars.every((b) => fits(valTxt(b), slot));
  let svg = yAxis(max, w, h, pad);
  bars.forEach((b, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const bh = (h * (b.value || 0)) / max;
    const y0 = pad.t + h;
    const r = Math.min(4, bw / 2, bh);
    const x0 = cx - bw / 2;
    const path = bh > 0
      ? `M${x0},${y0}V${y0 - bh + r}Q${x0},${y0 - bh} ${x0 + r},${y0 - bh}H${x0 + bw - r}Q${x0 + bw},${y0 - bh} ${x0 + bw},${y0 - bh + r}V${y0}Z`
      : '';
    const tip = b.tip || `<b>${esc(b.label)}</b><br>${(b.value || 0).toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${unit}`;
    svg += b.estimated
      ? `<path d="${path}" fill="${b.color || color}" fill-opacity=".35" stroke="${b.color || color}" stroke-width="1.5" stroke-dasharray="4 3"/>`
      : `<path d="${path}" fill="${b.color || color}"/>`;
    if (b.marker != null) {
      const my = pad.t + h - (h * b.marker) / max;
      svg += `<line x1="${cx - bw / 2 - 5}" x2="${cx + bw / 2 + 5}" y1="${my}" y2="${my}" stroke="var(--text)" stroke-width="2" stroke-dasharray="4 3"/>`;
    }
    if (showVals) svg += `<text x="${cx}" y="${pad.t + h - bh - 6}" text-anchor="middle" class="val">${valTxt(b)}</text>`;
    const t = lab(i);
    if (t) svg += `<text x="${cx}" y="${height - 8}" text-anchor="middle" class="axis">${esc(t)}</text>`;
    svg += `<rect x="${cx - slot / 2}" y="${pad.t}" width="${slot}" height="${h}" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  el.innerHTML = `<svg width="${W}" height="${height}" role="img">${svg}</svg>`;
}

// slices: [{label, value, color}]
export function donut(el, { slices, center, sub, size = 168 }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const R = size / 2, r = R * 0.64, cx = R, cy = R;
  let a0 = -Math.PI / 2, svg = '';
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 0.012 : 0;
  slices.filter((s) => s.value > 0).forEach((s) => {
    const a1 = a0 + (s.value / total) * Math.PI * 2;
    const s0 = a0 + gap, s1 = Math.max(s0 + 0.001, a1 - gap);
    const large = s1 - s0 > Math.PI ? 1 : 0;
    const p = (ang, rad) => `${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`;
    const d = `M${p(s0, R)}A${R},${R} 0 ${large} 1 ${p(s1, R)}L${p(s1, r)}A${r},${r} 0 ${large} 0 ${p(s0, r)}Z`;
    const tip = `<b>${esc(s.label)}</b><br>${s.value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € · ${Math.round((s.value / total) * 100)} %`;
    svg += `<path d="${d}" fill="${s.color}" data-tip="${esc(tip)}"/>`;
    a0 = a1;
  });
  svg += `<text x="${cx}" y="${cy + 2}" text-anchor="middle" class="donut-c">${esc(center)}</text>`;
  if (sub) svg += `<text x="${cx}" y="${cy + 20}" text-anchor="middle" class="axis">${esc(sub)}</text>`;
  el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img">${svg}</svg>`;
}

export function sparkline(values, color) {
  const v = values.filter((x) => x != null);
  if (v.length < 2) return '';
  const W = 72, H = 28, min = Math.min(...v), max = Math.max(...v), rng = max - min || 1;
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${((W - 4) * i) / (v.length - 1) + 2},${H - 3 - ((H - 6) * (x - min)) / rng}`).join('');
  return `<svg class="spark" width="${W}" height="${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// Globaler Tooltip (Maus + Touch)
export function installTooltip() {
  const tt = document.createElement('div');
  tt.className = 'tooltip';
  document.body.appendChild(tt);
  let active = null;
  const hide = () => {
    tt.style.opacity = 0;
    if (active) { active.closest('svg')?.querySelector('.crosshair')?.setAttribute('style', 'display:none'); active = null; }
  };
  const show = (target, e) => {
    if (active && active !== target) hide();
    active = target;
    tt.innerHTML = target.dataset.tip;
    tt.style.opacity = 1;
    const cross = target.dataset.cross;
    if (cross) {
      const l = target.closest('svg').querySelector('.crosshair');
      l.setAttribute('x1', cross); l.setAttribute('x2', cross); l.style.display = '';
    }
    const r = tt.getBoundingClientRect();
    let x = e.clientX + 12, y = e.clientY - r.height - 12;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 12;
    if (y < 8) y = e.clientY + 16;
    tt.style.left = Math.max(8, x) + 'px';
    tt.style.top = y + 'px';
  };
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (t) show(t, e); else if (e.pointerType === 'mouse') hide();
  });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (t) show(t, e); else hide();
  });
  window.addEventListener('scroll', hide, { passive: true });
}
