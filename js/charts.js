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

// series: [{name, color, values:[number|null]}], labels: [string]
export function lineChart(el, { labels, series, unit = '€', height = 220 }) {
  const W = Math.max(280, el.clientWidth || 320);
  const pad = { t: 14, r: 16, b: 28, l: 48 };
  const w = W - pad.l - pad.r, h = height - pad.t - pad.b;
  const max = niceMax(Math.max(...series.flatMap((s) => s.values.filter((v) => v != null)), 1) * 1.08);
  const n = labels.length;
  const x = (i) => pad.l + (n === 1 ? w / 2 : (w * i) / (n - 1));
  const y = (v) => pad.t + h - (h * v) / max;

  let svg = yAxis(max, w, h, pad);
  labels.forEach((l, i) => { svg += `<text x="${x(i)}" y="${height - 8}" text-anchor="middle" class="axis">${esc(l)}</text>`; });

  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    if (!pts.length) return;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    if (si === 0 && pts.length > 1) {
      svg += `<path d="${d}L${pts[pts.length - 1][0]},${pad.t + h}L${pts[0][0]},${pad.t + h}Z" fill="${s.color}" opacity=".1"/>`;
    }
    svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach((p) => { svg += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${s.color}" stroke="var(--card)" stroke-width="2"/>`; });
  });

  // Hover-Spalten
  const colW = n === 1 ? w : w / (n - 1);
  labels.forEach((l, i) => {
    const tip = `<b>${esc(l)}</b>` + series.map((s) => s.values[i] == null ? '' :
      `<br><span class="dot" style="background:${s.color}"></span>${esc(s.name)}: ${s.values[i].toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`).join('');
    svg += `<rect x="${x(i) - colW / 2}" y="${pad.t}" width="${colW}" height="${h}" fill="transparent" data-tip="${esc(tip)}" data-cross="${x(i)}"/>`;
  });
  svg += `<line class="crosshair" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + h}" style="display:none"/>`;
  el.innerHTML = `<svg width="${W}" height="${height}" role="img">${svg}</svg>`;
}

// bars: [{label, value, color?, tip?, marker?}] – marker = Vergleichswert (Strich)
export function barChart(el, { bars, unit = '', height = 200, color = 'var(--c1)', digits = 0 }) {
  const W = Math.max(260, el.clientWidth || 320);
  const pad = { t: 18, r: 12, b: 28, l: 48 };
  const w = W - pad.l - pad.r, h = height - pad.t - pad.b;
  const max = niceMax(Math.max(...bars.map((b) => Math.max(b.value || 0, b.marker || 0)), 1) * 1.1);
  const n = bars.length;
  const slot = w / Math.max(n, 1);
  const bw = Math.min(44, slot * 0.6);
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
    if (n <= 8) svg += `<text x="${cx}" y="${pad.t + h - bh - 6}" text-anchor="middle" class="val">${(b.value || 0).toLocaleString('de-DE', { maximumFractionDigits: digits })}</text>`;
    svg += `<text x="${cx}" y="${height - 8}" text-anchor="middle" class="axis">${esc(b.label)}</text>`;
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
