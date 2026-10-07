import { APP_VERSION, CHANGELOG } from './version.js';
import { store } from './store.js';
import { GROUPS, CATEGORIES, CONTRACT_CATEGORIES, groupTotals, parseImport, normalizeContract, uid } from './model.js';
import { kpis, analyze, eur, pct, numf, dateDe, tax35a, contractYear, contractTimeline, rateContractYear, contractsYears, contractsTotal, contractsHasEstimate, noticeInfo } from './analysis.js';
import { lineChart, barChart, donut, sparkline, installTooltip } from './charts.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const main = $('#view');
const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  doc: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  contract: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 3 2 3 4 1-2 0-5 0-7z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  sqm: '<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  warn: '<path d="M12 4l9 16H3zM12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const statusIcon = { good: 'check', warning: 'warn', critical: 'warn', info: 'info' };

function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), ms);
}

function delta(p, invert = true, label = '') {
  if (p == null || !Number.isFinite(p)) return `<span class="delta muted">${label || 'kein Vorjahr'}</span>`;
  const up = p > 0.05, down = p < -0.05;
  // Bei Kosten ist "rauf" schlecht
  const cls = up ? (invert ? 'bad' : 'good') : down ? (invert ? 'good' : 'bad') : 'muted';
  return `<span class="delta ${cls}">${up ? '↑' : down ? '↓' : '→'} ${pct(p)}${label ? ` <span class="muted">${label}</span>` : ''}</span>`;
}

// ---------- Router ----------
const routes = [
  [/^#?\/?$/, viewDashboard, 'home'],
  [/^#\/abrechnungen$/, viewStatements, 'doc'],
  [/^#\/abrechnung\/(\d{4})$/, viewStatement, 'doc'],
  [/^#\/vertraege$/, viewContracts, 'contract'],
  [/^#\/vertrag\/neu$/, () => viewContractEdit(null), 'contract'],
  [/^#\/vertrag\/([\w-]+)\/bearbeiten$/, (id) => viewContractEdit(id), 'contract'],
  [/^#\/vertrag\/([\w-]+)$/, viewContract, 'contract'],
  [/^#\/statistik$/, viewStats, 'chart'],
  [/^#\/import$/, viewImport, 'import'],
  [/^#\/mehr$/, viewMore, 'more'],
];

let afterRender = [];
function render() {
  const h = location.hash || '#/';
  for (const [re, fn, tab] of routes) {
    const m = h.match(re);
    if (m) {
      afterRender = [];
      main.innerHTML = fn(...m.slice(1)) || '';
      document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
      afterRender.forEach((f) => f());
      renderSidebarYears();
      return;
    }
  }
  location.hash = '#/';
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
let rT, lastW = window.innerWidth;
window.addEventListener('resize', () => {
  if (window.innerWidth === lastW) return; // iOS feuert resize beim Scrollen (Adressleiste)
  lastW = window.innerWidth;
  clearTimeout(rT); rT = setTimeout(render, 150);
});

function renderSidebarYears() {
  const el = $('#side-years');
  const sel = currentYear();
  el.innerHTML = store.statements().slice().reverse().map((s) =>
    `<a href="#/abrechnung/${s.year}" class="${s.year === sel ? 'sel' : ''}">${icon('doc')} ${s.year}</a>`).join('') ||
    '<span class="muted small">Noch keine</span>';
}

function currentYear() {
  const sts = store.statements();
  const y = store.get().settings.selectedYear;
  if (sts.find((s) => s.year === y)) return y;
  return sts.length ? sts[sts.length - 1].year : null;
}

// ---------- Dashboard ----------
function viewDashboard() {
  const sts = store.statements();
  if (!sts.length) return emptyState();
  const year = currentYear();
  const st = store.statement(year);
  const prev = store.statement(year - 1);
  const k = kpis(st, prev);
  const a = analyze(st, prev, sts);
  const g = groupTotals(st);
  const pg = prev ? groupTotals(prev) : null;
  const upto = sts.filter((s) => s.year <= year);

  const spark = (fn, color) => sparkline(upto.map(fn), color);
  const kpiCard = (cls, ic, label, value, d, sp) => `
    <div class="card kpi ${cls}">
      <div class="kpi-ic">${icon(ic)}</div>
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-foot">${d}${sp}</div>
    </div>`;
  const vj = prev ? `zu ${prev.year}` : '';

  afterRender.push(() => {
    lineChart($('#ch-trend'), {
      labels: sts.map((s) => String(s.year)),
      series: [
        { name: 'Gesamtkosten', color: 'var(--c1)', values: sts.map((s) => s.totals.costs) },
        { name: 'Heizung + Warmwasser', color: 'var(--c2)', values: sts.map((s) => { const x = groupTotals(s); return x.heizung + x.warmwasser; }) },
      ],
    });
    const slices = GROUPS.map((x) => ({ label: x.label, value: g[x.key], color: x.color }));
    donut($('#ch-donut'), { slices, center: eur(st.totals.costs, 0), sub: 'Gesamt' });
    drawConsumption('heat');
    $('#cons-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $('#cons-tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      drawConsumption(b.dataset.k);
    });
    $('#year-sel').addEventListener('change', (e) => { store.setSetting('selectedYear', Number(e.target.value)); render(); });
  });

  function drawConsumption(kind) {
    const hist = consumptionSeries(st.year);
    const conf = {
      heat: { key: 'heatingKwh', unit: 'kWh', color: 'var(--c2)' },
      ww: { key: 'hotWaterKwh', unit: 'kWh', color: 'var(--c4)' },
      water: { key: 'waterTotalM3', unit: 'm³', color: 'var(--c1)' },
    }[kind];
    const rows = hist.filter((r) => r[conf.key] != null);
    const el = $('#ch-cons');
    if (!rows.length) { el.innerHTML = '<p class="muted center pad">Keine Verbrauchswerte vorhanden.</p>'; return; }
    barChart(el, { bars: rows.map((r) => ({ label: String(r.year), value: r[conf.key] })), unit: conf.unit, color: conf.color, digits: kind === 'water' ? 1 : 0 });
  }

  const rows = GROUPS.map((x) => ({ ...x, v: g[x.key], p: pg ? pg[x.key] : null })).filter((r) => r.v > 0 || (r.p ?? 0) > 0);
  const avg = sts.reduce((s, x) => s + x.totals.costs, 0) / sts.length;

  return `
  <header class="page-head">
    <div><h1>Dashboard</h1><p class="sub">Deine Nebenkosten auf einen Blick</p></div>
    <label class="year-pick">${icon('doc')}<select id="year-sel" aria-label="Jahr">${sts.slice().reverse().map((s) => `<option ${s.year === year ? 'selected' : ''}>${s.year}</option>`).join('')}</select></label>
  </header>
  ${st.unit.label ? `<p class="unit-line">${icon('home')} ${esc(st.unit.label)}${st.unit.livingArea ? ` · ${numf(st.unit.livingArea, 2)} m²` : ''}</p>` : ''}

  <section class="kpis">
    ${kpiCard('k1', 'coins', 'Gesamtkosten', eur(k.total), delta(k.d?.total, true, vj), spark((s) => s.totals.costs, 'var(--c7)'))}
    ${kpiCard('k2', 'flame', 'Heizung & Warmwasser', eur(k.heat), delta(k.d?.heat, true, vj), spark((s) => { const x = groupTotals(s); return x.heizung + x.warmwasser; }, 'var(--c2)'))}
    ${kpiCard('k3', 'drop', 'Wasser/Abwasser', eur(k.water), delta(k.d?.water, true, vj), spark((s) => groupTotals(s).wasser, 'var(--c1)'))}
    ${kpiCard('k4', 'sqm', 'Kosten pro m²', k.perM2 ? eur(k.perM2) : '–', delta(k.d?.perM2, true, vj), spark((s) => s.unit.livingArea ? s.totals.costs / s.unit.livingArea : null, 'var(--c3)'))}
  </section>

  <div class="grid">
    <section class="card span2">
      <div class="card-head"><h2>Analyse</h2><span class="pill">${st.year}</span></div>
      <h3>Was hat sich verändert?</h3>
      <p>${esc(a.summary)}</p>
      ${a.drivers.length ? `<p class="small muted">${prev ? 'Hauptgründe:' : 'Größte Posten:'}</p>
      <ul class="drivers">${a.drivers.map((d) => `<li><span class="dot" style="background:${d.color}"></span>${esc(d.label)}<b>${d.isShare ? eur(d.diff, 0) : (d.diff > 0 ? '+' : '−') + eur(Math.abs(d.diff), 0)}</b><span class="muted">${d.isShare ? Math.round(d.pct) + ' %' : '(' + pct(d.pct) + ')'}</span></li>`).join('')}</ul>` : ''}
      <div class="insights">${a.insights.map(insightHtml).join('')}</div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Auf einen Blick</h2></div>
      <ul class="glance">
        <li>${icon('sqm')}<span>Kosten pro m² / Monat</span><b>${k.perM2 ? eur(k.perM2 / 12) : '–'}</b></li>
        <li>${icon('coins')}<span>Kosten pro Monat</span><b>${eur(k.perMonth)}</b></li>
        <li>${icon('chart')}<span>Durchschnitt (${sts.length} ${sts.length === 1 ? 'Jahr' : 'Jahre'})</span><b>${eur(avg)}</b></li>
        <li>${icon(k.balance < 0 ? 'warn' : 'check')}<span>${k.balance < 0 ? 'Nachzahlung' : 'Guthaben'}</span><b class="${k.balance < 0 ? 'bad' : 'good'}">${eur(Math.abs(k.balance ?? 0))}</b></li>
        ${st.tax35a?.householdServices ? `<li>${icon('doc')}<span>Steuerersparnis § 35a</span><b>${eur(tax35a(st).reduction)}</b></li>` : ''}
        ${store.contracts().length ? `<li>${icon('contract')}<span>Verträge ${st.year}</span><b>${eur(contractsTotal(store.contracts(), st.year))}</b></li>` : ''}
      </ul>
    </section>

    <section class="card span2">
      <div class="card-head"><h2>Kostenentwicklung</h2>
        <div class="legend"><span><i style="background:var(--c1)"></i>Gesamtkosten</span><span><i style="background:var(--c2)"></i>Heizung + Warmwasser</span></div></div>
      <div id="ch-trend" class="chart"></div>
      ${sts.length < 2 ? '<p class="small muted">Sobald du weitere Jahre importierst, siehst du hier den Verlauf.</p>' : ''}
    </section>

    <section class="card">
      <div class="card-head"><h2>Kostenverteilung</h2></div>
      <div class="donut-wrap"><div id="ch-donut"></div>
        <ul class="donut-legend">${GROUPS.filter((x) => g[x.key] > 0).map((x) => `<li><span class="dot" style="background:${x.color}"></span>${x.label}<b>${Math.round((g[x.key] / st.totals.costs) * 100)} %</b></li>`).join('')}</ul>
      </div>
    </section>

    <section class="card span2">
      <div class="card-head"><h2>Verbrauch im Vergleich</h2>
        <div class="seg" id="cons-tabs"><button class="on" data-k="heat">Heizung</button><button data-k="ww">Warmwasser</button><button data-k="water">Wasser</button></div></div>
      <div id="ch-cons" class="chart"></div>
    </section>

    <section class="card span2">
      <div class="card-head"><h2>Detaillierte Kosten</h2><a class="link" href="#/abrechnung/${st.year}">Alle Positionen ${icon('chev')}</a></div>
      <table class="tbl">
        <thead><tr><th>Position</th><th class="r">Kosten</th><th class="r hide-s">Anteil</th><th class="r">Δ ${prev ? prev.year : 'Vorjahr'}</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td><span class="dot" style="background:${r.color}"></span>${r.label}</td><td class="r">${eur(r.v)}</td><td class="r hide-s">${Math.round((r.v / st.totals.costs) * 100)} %</td><td class="r">${r.p != null ? delta(r.p ? ((r.v - r.p) / r.p) * 100 : null) : '<span class="muted">–</span>'}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Gesamt</td><td class="r">${eur(st.totals.costs)}</td><td class="r hide-s">100 %</td><td class="r">${delta(k.d?.total)}</td></tr></tfoot>
      </table>
    </section>

    <section class="card">
      <div class="card-head"><h2>Letzte Abrechnungen</h2></div>
      <ul class="list">${sts.slice().reverse().map((s) => `<li><a href="#/abrechnung/${s.year}">${icon('doc')}<b>${s.year}</b><span>${eur(s.totals.costs)}</span><span class="muted small">${dateDe(s.issuedOn)}</span>${icon('chev')}</a></li>`).join('')}</ul>
      <a class="drop" href="#/import">${icon('upload')}<div><b>Neue Abrechnung hinzufügen</b><span class="small muted">JSON von Claude einfügen oder Datei wählen</span></div></a>
    </section>
  </div>`;
}

// Nebenkosten eines Jahres: Abrechnung, sonst (nach der letzten Abrechnung) laufende Vorauszahlung × 12.
function nebenkostenForYear(y) {
  const st = store.statement(y);
  if (st) return { value: st.totals.costs, kind: 'abrechnung' };
  const sts = store.statements();
  const last = sts[sts.length - 1];
  if (!last || y < last.year || y > new Date().getFullYear()) return null;
  const sched = last.prepaymentSchedule;
  const monthly = sched.length ? sched[sched.length - 1].monthly : (last.totals.prepayments || 0) / 12;
  return monthly ? { value: monthly * 12, monthly, kind: 'vorauszahlung' } : null;
}

function consumptionSeries(uptoYear) {
  const map = new Map();
  for (const s of store.statements()) {
    for (const h of s.consumptionHistory || []) if (!map.has(h.year)) map.set(h.year, { year: h.year, ...h });
  }
  for (const s of store.statements()) {
    map.set(s.year, { year: s.year, heatingKwh: s.consumption.heatingKwh ?? null, hotWaterKwh: s.consumption.hotWaterKwh ?? null, waterTotalM3: s.consumption.waterTotalM3 ?? null });
  }
  return [...map.values()].filter((r) => r.year <= uptoYear).sort((a, b) => a.year - b.year);
}

function insightHtml(i) {
  return `<div class="insight ${i.level}">${icon(statusIcon[i.level])}<div><b>${esc(i.title)}</b><p>${esc(i.text)}</p></div></div>`;
}

function emptyState() {
  afterRender.push(() => {
    $('#load-2024')?.addEventListener('click', async () => {
      try {
        const res = await fetch('data/abrechnung-2024.json');
        const parsed = parseImport(await res.text());
        parsed.statements.forEach((s) => store.upsertStatement(s, 'Abrechnung 2024 (mitgeliefert)'));
        toast('Abrechnung 2024 geladen');
        render();
      } catch (e) { toast('Laden fehlgeschlagen: ' + esc(e.message)); }
    });
  });
  return `
  <header class="page-head"><div><h1>Willkommen</h1><p class="sub">NebenkostenCheck – deine Mietkosten im Überblick</p></div></header>
  <section class="card hero">
    ${icon('spark', 'big')}
    <h2>Noch keine Abrechnung</h2>
    <p>Lade deine erste Nebenkostenabrechnung. Für 2024 liegt sie schon fertig aufbereitet bei.</p>
    <div class="btn-row">
      <button class="btn primary" id="load-2024">Abrechnung 2024 laden</button>
      <a class="btn" href="#/import">Eigene Datei importieren</a>
    </div>
    <p class="small muted">Alle Daten bleiben nur auf diesem Gerät. Unter „Mehr“ kannst du sie sichern.</p>
  </section>`;
}

// ---------- Abrechnungen ----------
function viewStatements() {
  const sts = store.statements().slice().reverse();
  return `
  <header class="page-head"><div><h1>Abrechnungen</h1><p class="sub">${sts.length} erfasst</p></div><a class="btn primary" href="#/import">${icon('plus')} Import</a></header>
  <section class="card"><ul class="list big">${sts.map((s) => `<li><a href="#/abrechnung/${s.year}">${icon('doc')}<div class="grow"><b>${s.year}</b><span class="small muted">${dateDe(s.periodFrom)} – ${dateDe(s.periodTo)}</span></div>
    <div class="r"><b>${eur(s.totals.costs)}</b><span class="small ${s.totals.balance < 0 ? 'bad' : 'good'}">${s.totals.balance < 0 ? 'Nachzahlung' : 'Guthaben'} ${eur(Math.abs(s.totals.balance ?? 0))}</span></div>${icon('chev')}</a></li>`).join('') || '<li class="muted pad">Noch keine Abrechnung. <a href="#/import">Jetzt importieren</a></li>'}</ul></section>`;
}

function viewStatement(yearStr) {
  const year = Number(yearStr);
  const st = store.statement(year);
  if (!st) return `<p class="pad">Keine Abrechnung für ${year}. <a href="#/abrechnungen">Zurück</a></p>`;
  const prev = store.statement(year - 1);
  const pcat = {};
  prev?.positions.forEach((p) => { pcat[p.label] = (pcat[p.label] || 0) + p.amount; });
  const t = tax35a(st);
  const c = st.consumption;
  afterRender.push(() => {
    $('#del-st').addEventListener('click', () => {
      if (confirm(`Abrechnung ${year} wirklich löschen?`)) { store.deleteStatement(year); location.hash = '#/abrechnungen'; }
    });
    $('#to-dash').addEventListener('click', () => { store.setSetting('selectedYear', year); location.hash = '#/'; });
  });
  const cRows = [
    ['Heizung', c.heatingKwh, 'kWh'], ['Warmwasser', c.hotWaterM3, 'm³'], ['Warmwasser (Energie)', c.hotWaterKwh, 'kWh'],
    ['Kaltwasser', c.coldWaterM3, 'm³'], ['Wasser gesamt', c.waterTotalM3, 'm³'],
    ['Heizung je m² (du / Haus)', c.heatingKwhPerM2 != null ? `${numf(c.heatingKwhPerM2, 2)} / ${numf(c.heatingKwhPerM2Building, 2)}` : null, 'kWh'],
    ['Warmwasser je m² (du / Haus)', c.hotWaterKwhPerM2 != null ? `${numf(c.hotWaterKwhPerM2, 2)} / ${numf(c.hotWaterKwhPerM2Building, 2)}` : null, 'kWh'],
    ['CO₂-Kosten (dein Anteil)', c.co2CostTenant != null ? eur(c.co2CostTenant) : null, ''],
    ['Energiepreis', c.energyPricePerKwh != null ? numf(c.energyPricePerKwh * 100, 2) + ' ct' : null, '/kWh'],
  ].filter((r) => r[1] != null);
  return `
  <header class="page-head"><div><a class="back" href="#/abrechnungen">${icon('back')} Abrechnungen</a><h1>Abrechnung ${year}</h1>
    <p class="sub">${dateDe(st.periodFrom)} – ${dateDe(st.periodTo)}${st.issuedOn ? ` · erstellt ${dateDe(st.issuedOn)}` : ''}</p></div>
    <button class="btn" id="to-dash">${icon('home')} Im Dashboard</button></header>
  <div class="grid">
  <section class="card span2">
    <div class="card-head"><h2>Positionen</h2><span class="pill">${st.positions.length}</span></div>
    <table class="tbl">
      <thead><tr><th>Position</th><th class="r hide-s">Haus gesamt</th><th class="hide-s">Schlüssel</th><th class="r">Dein Anteil</th>${prev ? `<th class="r">Δ ${prev.year}</th>` : ''}</tr></thead>
      <tbody>${st.positions.map((p) => {
        const grp = GROUPS.find((x) => x.key === (CATEGORIES[p.category]?.group || 'sonstiges'));
        return `<tr><td><span class="dot" style="background:${grp.color}"></span>${esc(p.label)}<div class="small muted">${esc(CATEGORIES[p.category]?.label || '')}${p.source ? ' · ' + esc(p.source) : ''}</div></td>
        <td class="r hide-s">${p.buildingTotal != null ? eur(p.buildingTotal) : '–'}</td>
        <td class="hide-s small">${esc(p.allocationKey)}${p.share ? '<br><span class="muted">' + esc(p.share) + '</span>' : ''}</td>
        <td class="r"><b>${eur(p.amount)}</b></td>
        ${prev ? `<td class="r">${pcat[p.label] != null ? delta(((p.amount - pcat[p.label]) / pcat[p.label]) * 100) : '<span class="muted small">neu</span>'}</td>` : ''}</tr>`;
      }).join('')}</tbody>
      <tfoot>
        <tr><td>Gesamtkosten</td><td class="hide-s"></td><td class="hide-s"></td><td class="r">${eur(st.totals.costs)}</td>${prev ? '<td></td>' : ''}</tr>
        <tr><td>Vorauszahlungen${st.prepaymentSchedule.length ? `<div class="small muted">${st.prepaymentSchedule.map((r) => `${r.months} × ${eur(r.monthly, 0)}`).join(' + ')}</div>` : ''}</td><td class="hide-s"></td><td class="hide-s"></td><td class="r">− ${eur(st.totals.prepayments)}</td>${prev ? '<td></td>' : ''}</tr>
        <tr class="${st.totals.balance < 0 ? 'bad' : 'good'}"><td>${st.totals.balance < 0 ? 'Nachzahlung' : 'Guthaben'}</td><td class="hide-s"></td><td class="hide-s"></td><td class="r">${eur(Math.abs(st.totals.balance ?? 0))}</td>${prev ? '<td></td>' : ''}</tr>
      </tfoot>
    </table>
  </section>
  <section class="card">
    <div class="card-head"><h2>Verbrauch</h2></div>
    ${cRows.length ? `<ul class="kv">${cRows.map((r) => `<li><span>${r[0]}</span><b>${typeof r[1] === 'number' ? numf(r[1], r[1] % 1 ? 2 : 0) : r[1]} ${r[2]}</b></li>`).join('')}</ul>` : '<p class="muted">Keine Verbrauchswerte.</p>'}
  </section>
  ${t.household || t.craftsmen ? `<section class="card">
    <div class="card-head"><h2>Steuer § 35a EStG</h2></div>
    <ul class="kv"><li><span>Haushaltsnahe Dienstleistungen</span><b>${eur(t.household)}</b></li>
    <li><span>Handwerkerleistungen</span><b>${eur(t.craftsmen)}</b></li>
    <li><span>Steuerermäßigung (20 %)</span><b class="good">${eur(t.reduction)}</b></li></ul>
    <p class="small muted">Nur umlagefähige Anteile. In der Steuererklärung ${year} bzw. im Jahr der Zahlung angeben.</p>
  </section>` : ''}
  <section class="card">
    <div class="card-head"><h2>Details</h2></div>
    <ul class="kv">
      ${st.unit.label ? `<li><span>Einheit</span><b>${esc(st.unit.label)}</b></li>` : ''}
      ${st.unit.livingArea ? `<li><span>Wohnfläche</span><b>${numf(st.unit.livingArea, 2)} m²</b></li>` : ''}
      ${st.unit.meaShare ? `<li><span>MEA</span><b>${numf(st.unit.meaShare, 2)} / ${numf(st.unit.meaTotal, 0)}</b></li>` : ''}
      ${st.issuer ? `<li><span>Aussteller</span><b>${esc(st.issuer)}</b></li>` : ''}
      ${st.dueOn ? `<li><span>Fällig am</span><b>${dateDe(st.dueOn)}</b></li>` : ''}
      <li><span>Importiert</span><b>${st.importedAt ? new Date(st.importedAt).toLocaleString('de-DE') : '–'}</b></li>
    </ul>
    ${st.notes.length ? `<ul class="notes">${st.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${st.revisions?.length ? `<details><summary>Frühere Versionen (${st.revisions.length})</summary><ul class="kv">${st.revisions.map((r) => `<li><span>${r.importedAt ? new Date(r.importedAt).toLocaleString('de-DE') : '–'} · ${esc(r.source || '')}</span><b>${eur(r.totals?.costs)}</b></li>`).join('')}</ul></details>` : ''}
    <button class="btn danger small-btn" id="del-st">Abrechnung löschen</button>
  </section>
  </div>`;
}

// ---------- Verträge ----------
function viewContracts() {
  const cs = store.contracts();
  const years = contractsYears(cs);
  const now = new Date().getFullYear();
  const year = years.includes(now) ? now : years[years.length - 1] ?? now;
  const prevYear = year - 1;
  const total = contractsTotal(cs, year), prevTotal = contractsTotal(cs, prevYear);
  const overpay = cs.reduce((a, c) => a + c.years.reduce((s, y) => s + (y.benchmark != null ? y.cost - y.benchmark : 0), 0), 0);
  const notices = cs.map((c) => ({ c, n: noticeInfo(c) })).filter((x) => x.n && x.n.days >= 0 && x.n.days <= 90).sort((a, b) => a.n.days - b.n.days);

  afterRender.push(() => {
    if (years.length && $('#ch-ct')) {
      barChart($('#ch-ct'), { bars: years.map((y) => ({ label: String(y), value: contractsTotal(cs, y), estimated: contractsHasEstimate(cs, y),
        tip: `<b>${y}</b><br>${eur(contractsTotal(cs, y))}${contractsHasEstimate(cs, y) ? '<br>enthält geschätzte Werte' : ''}` })), unit: '€', color: 'var(--c7)' });
    }
  });

  const byCat = CONTRACT_CATEGORIES.map((cat) => ({ cat, items: cs.filter((c) => c.category === cat) })).filter((x) => x.items.length);

  return `
  <header class="page-head"><div><h1>Verträge</h1><p class="sub">Laufende Kosten über die Jahre</p></div><a class="btn primary" href="#/vertrag/neu">${icon('plus')} Vertrag</a></header>
  ${cs.length ? `
  <section class="kpis three">
    <div class="card kpi k1"><div class="kpi-ic">${icon('contract')}</div><div class="kpi-label">Summe ${year}</div><div class="kpi-value">${eur(total)}</div><div class="kpi-foot">${delta(prevTotal ? ((total - prevTotal) / prevTotal) * 100 : null, true, prevTotal ? 'zu ' + prevYear : '')}</div></div>
    <div class="card kpi k4"><div class="kpi-ic">${icon('coins')}</div><div class="kpi-label">Pro Monat</div><div class="kpi-value">${eur(total / 12)}</div><div class="kpi-foot"><span class="muted">${cs.filter((c) => c.active).length} aktive Verträge</span></div></div>
    <div class="card kpi k2"><div class="kpi-ic">${icon(overpay > 0 ? 'warn' : 'check')}</div><div class="kpi-label">Mehr bezahlt als nötig</div><div class="kpi-value">${eur(Math.max(0, overpay))}</div><div class="kpi-foot"><span class="muted">vs. günstigstes Angebot, alle Jahre</span></div></div>
  </section>
  ${notices.length ? `<section class="card"><div class="card-head"><h2>Kündigung bald möglich</h2></div>${notices.map(({ c, n }) => `<div class="insight warning">${icon('warn')}<div><b>${esc(c.name)}</b><p>Spätestens kündigen bis ${n.lastNotice.toLocaleDateString('de-DE')} (${n.days} Tage) – Laufzeitende ${n.end.toLocaleDateString('de-DE')}.</p></div></div>`).join('')}</section>` : ''}
  <div class="grid">
    <section class="card span2"><div class="card-head"><h2>Vertragskosten pro Jahr</h2>${years.some((y) => contractsHasEstimate(cs, y)) ? '<div class="legend"><span><i style="background:var(--c7)"></i>Erfasst</span><span><i class="est"></i>Enthält Schätzung</span></div>' : ''}</div><div id="ch-ct" class="chart"></div>
      ${years.some((y) => contractsHasEstimate(cs, y)) ? '<p class="small muted">Für Jahre ohne Eintrag wird ab Vertragsbeginn mit dem Monatsbetrag des nächstgelegenen erfassten Jahres geschätzt.</p>' : ''}</section>
    <section class="card"><div class="card-head"><h2>Nach Kategorie ${year}</h2></div>
      <ul class="kv">${byCat.map((x) => `<li><span>${x.cat}</span><b>${eur(contractsTotal(x.items, year))}</b></li>`).join('')}</ul></section>
  </div>
  ${byCat.map((x) => `<section class="card"><div class="card-head"><h2>${x.cat}</h2></div><ul class="list big">${x.items.map((c) => {
    const y = contractYear(c, year) || contractTimeline(c).pop();
    const py = y ? contractYear(c, y.year - 1) : null;
    const r = rateContractYear(y);
    return `<li><a href="#/vertrag/${c.id}"><div class="grow"><b>${esc(c.name)}</b>${c.active ? '' : ' <span class="pill muted">beendet</span>'}<span class="small muted">${esc(y?.provider || c.provider)}${y?.tariff ? ' · ' + esc(y.tariff) : ''}</span></div>
      <div class="r"><b>${y ? eur(y.cost) : '–'}</b><span class="small">${y ? y.year + (y.estimated ? ' (geschätzt) ' : ' ') : ''}${py ? delta(((y.cost - py.cost) / py.cost) * 100) : ''}</span>${r ? `<span class="badge ${r.level}">${icon(statusIcon[r.level])}${r.label}</span>` : ''}</div>${icon('chev')}</a></li>`;
  }).join('')}</ul></section>`).join('')}
  ` : `<section class="card hero">${icon('contract', 'big')}<h2>Noch keine Verträge</h2>
    <p>Erfasse Versicherungen, Handy, Strom, Internet & Co. mit den Kosten pro Jahr. Trage optional das günstigste Vergleichsangebot ein – dann siehst du, wie gut deine Wahl war.</p>
    <div class="btn-row"><a class="btn primary" href="#/vertrag/neu">Ersten Vertrag anlegen</a><a class="btn" href="#/import">Per Claude-Datei importieren</a></div></section>`}`;
}

function viewContract(id) {
  const c = store.contract(id);
  if (!c) return `<p class="pad">Vertrag nicht gefunden. <a href="#/vertraege">Zurück</a></p>`;
  const n = noticeInfo(c);
  const totalOver = c.years.reduce((s, y) => s + (y.benchmark != null ? y.cost - y.benchmark : 0), 0);
  const tl = contractTimeline(c);
  const hasEst = tl.some((y) => y.estimated);
  afterRender.push(() => {
    if (tl.length) {
      barChart($('#ch-c'), { bars: tl.map((y) => {
        const r = rateContractYear(y);
        return { label: String(y.year), value: y.cost, marker: y.benchmark, estimated: y.estimated,
          tip: `<b>${y.year}</b>${y.estimated ? ' (geschätzt)' : ''}<br>${y.estimated ? 'Geschätzt' : 'Bezahlt'}: ${eur(y.cost)}${y.benchmark != null ? `<br>Günstigstes Angebot: ${eur(y.benchmark)}<br>${r.label} (${pct(r.p)})` : ''}` };
      }), unit: '€', color: 'var(--c7)' });
    }
    $('#take-est')?.addEventListener('click', () => {
      const est = tl.filter((y) => y.estimated).map(({ estimated, months, note, ...y }) => ({ ...y, note: 'aus Schätzung übernommen' }));
      store.replaceContract({ ...c, years: [...c.years, ...est].sort((a, b) => a.year - b.year) });
      toast(`${est.length} Jahr(e) übernommen`); render();
    });
    $('#del-c').addEventListener('click', () => {
      if (confirm(`Vertrag „${c.name}“ löschen?`)) { store.deleteContract(id); location.hash = '#/vertraege'; }
    });
  });
  return `
  <header class="page-head"><div><a class="back" href="#/vertraege">${icon('back')} Verträge</a><h1>${esc(c.name)}</h1><p class="sub">${esc(c.category)}${c.provider ? ' · ' + esc(c.provider) : ''}</p></div>
    <a class="btn" href="#/vertrag/${c.id}/bearbeiten">Bearbeiten</a></header>
  <div class="grid">
    <section class="card span2"><div class="card-head"><h2>Kosten pro Jahr</h2>${c.years.some((y) => y.benchmark != null) || hasEst ? `<div class="legend"><span><i style="background:var(--c7)"></i>Bezahlt</span>${hasEst ? '<span><i class="est"></i>Geschätzt</span>' : ''}${c.years.some((y) => y.benchmark != null) ? '<span><i class="dash"></i>Günstigstes Angebot</span>' : ''}</div>` : ''}</div>
      ${tl.length ? '<div id="ch-c" class="chart"></div>' : '<p class="muted">Noch keine Jahreswerte. Unter „Bearbeiten“ hinzufügen.</p>'}</section>
    <section class="card"><div class="card-head"><h2>Bewertung</h2></div>
      ${c.years.some((y) => y.benchmark != null)
        ? `<p>${totalOver > 0 ? `Über alle Jahre hast du <b class="bad">${eur(totalOver)}</b> mehr bezahlt als beim jeweils günstigsten Angebot.` : `Über alle Jahre lagst du <b class="good">${eur(-totalOver)}</b> unter dem Vergleichsangebot. Gut gewählt!`}</p>`
        : '<p class="muted">Trage pro Jahr ein Vergleichsangebot ein (z. B. von Check24/Verivox), um deine Wahl zu bewerten.</p>'}
      <ul class="kv">
        ${c.contractNo ? `<li><span>Vertragsnummer</span><b>${esc(c.contractNo)}</b></li>` : ''}
        ${c.startDate ? `<li><span>Beginn</span><b>${dateDe(c.startDate)}</b></li>` : ''}
        ${c.endDate ? `<li><span>Laufzeitende</span><b>${dateDe(c.endDate)}</b></li>` : ''}
        ${c.noticePeriodMonths != null ? `<li><span>Kündigungsfrist</span><b>${c.noticePeriodMonths} Monat(e)</b></li>` : ''}
        ${n ? `<li><span>Nächste Kündigung bis</span><b>${n.lastNotice.toLocaleDateString('de-DE')}</b></li>` : ''}
        <li><span>Status</span><b>${c.active ? 'aktiv' : 'beendet'}</b></li>
      </ul>
      ${c.notes ? `<p class="small">${esc(c.notes)}</p>` : ''}
    </section>
    <section class="card span3"><div class="card-head"><h2>Verlauf</h2>${hasEst ? '<button class="btn small-btn" id="take-est" style="margin:0">Schätzungen als erfasst übernehmen</button>' : ''}</div>
      ${hasEst ? '<p class="small muted">Jahre ohne Eintrag werden ab Vertragsbeginn geschätzt. Übernimm sie oder trage die echten Beträge unter „Bearbeiten“ ein.</p>' : ''}
      <table class="tbl"><thead><tr><th>Jahr</th><th class="hide-s">Anbieter / Tarif</th><th class="r">Kosten</th><th class="r">Δ Vorjahr</th><th class="r">Vergleich</th></tr></thead>
      <tbody>${tl.slice().reverse().map((y) => {
        const py = contractYear(c, y.year - 1), r = rateContractYear(y);
        return `<tr class="${y.estimated ? 'est-row' : ''}"><td><b>${y.year}</b>${y.estimated ? ' <span class="pill muted">geschätzt</span>' : ''}${y.note ? `<div class="small muted">${esc(y.note)}</div>` : ''}</td><td class="hide-s">${esc(y.provider || c.provider)}${y.tariff ? '<div class="small muted">' + esc(y.tariff) + '</div>' : ''}</td>
          <td class="r">${eur(y.cost)}<div class="small muted">${eur(y.cost / (y.months || 12))}/Monat</div></td><td class="r">${py ? delta(((y.cost - py.cost) / py.cost) * 100) : '–'}</td>
          <td class="r">${r ? `<span class="badge ${r.level}">${icon(statusIcon[r.level])}${r.label}</span><div class="small muted">${eur(y.benchmark)}${y.benchmarkNote ? ' · ' + esc(y.benchmarkNote) : ''}</div>` : '–'}</td></tr>`;
      }).join('')}</tbody></table>
      <button class="btn danger small-btn" id="del-c">Vertrag löschen</button>
    </section>
  </div>`;
}

function viewContractEdit(id) {
  const c = id ? store.contract(id) : { id: uid(), name: '', category: 'Versicherung', provider: '', contractNo: '', startDate: '', endDate: '', noticePeriodMonths: null, autoRenewMonths: 12, active: true, notes: '', years: [] };
  if (!c) return '<p class="pad">Vertrag nicht gefunden.</p>';
  const yearRow = (y) => `<div class="yrow">
      <label>Jahr<input name="year" type="number" inputmode="numeric" value="${y.year ?? new Date().getFullYear()}"></label>
      <label>Kosten / Jahr €<input name="cost" type="text" inputmode="decimal" value="${y.cost != null ? String(y.cost).replace('.', ',') : ''}" placeholder="z. B. 239,88"></label>
      <label>oder / Monat €<input name="monthly" type="text" inputmode="decimal" placeholder="19,99"></label>
      <label>Tarif<input name="tariff" value="${esc(y.tariff || '')}"></label>
      <label>Anbieter (falls gewechselt)<input name="provider" value="${esc(y.provider || '')}"></label>
      <label>Günstigstes Angebot / Jahr €<input name="benchmark" type="text" inputmode="decimal" value="${y.benchmark != null ? String(y.benchmark).replace('.', ',') : ''}"></label>
      <label>Quelle Vergleich<input name="benchmarkNote" value="${esc(y.benchmarkNote || '')}" placeholder="z. B. Check24 03/2025"></label>
      <button type="button" class="btn danger small-btn rm">${icon('x')} Jahr entfernen</button>
    </div>`;
  afterRender.push(() => {
    const f = $('#cform');
    $('#add-year').addEventListener('click', () => {
      const ys = [...f.querySelectorAll('.yrow input[name=year]')].map((i) => Number(i.value));
      const next = ys.length ? Math.max(...ys) + 1 : new Date().getFullYear();
      const prevRow = f.querySelectorAll('.yrow');
      const last = prevRow[prevRow.length - 1];
      $('#years').insertAdjacentHTML('beforeend', yearRow({ year: next, tariff: last?.querySelector('[name=tariff]').value }));
    });
    f.addEventListener('click', (e) => { if (e.target.closest('.rm')) e.target.closest('.yrow').remove(); });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const years = [...f.querySelectorAll('.yrow')].map((row) => {
        const v = (n) => row.querySelector(`[name=${n}]`).value.trim();
        return { year: v('year'), cost: v('cost') || null, monthly: v('monthly') || null, tariff: v('tariff'), provider: v('provider'), benchmark: v('benchmark') || null, benchmarkNote: v('benchmarkNote') };
      }).map((y) => (y.cost ? { ...y, monthly: null } : y));
      try {
        const nc = normalizeContract({
          id: c.id, name: fd.get('name'), category: fd.get('category'), provider: fd.get('provider'), contractNo: fd.get('contractNo'),
          startDate: fd.get('startDate'), endDate: fd.get('endDate'), noticePeriodMonths: fd.get('noticePeriodMonths'),
          autoRenewMonths: fd.get('autoRenewMonths'), active: fd.get('active') === 'on', notes: fd.get('notes'), years,
        });
        store.replaceContract(nc);
        toast('Gespeichert');
        location.hash = '#/vertrag/' + nc.id;
      } catch (err) { toast(esc(err.message)); }
    });
  });
  return `
  <header class="page-head"><div><a class="back" href="${id ? '#/vertrag/' + id : '#/vertraege'}">${icon('back')} Zurück</a><h1>${id ? 'Vertrag bearbeiten' : 'Neuer Vertrag'}</h1></div></header>
  <form id="cform" class="card form">
    <div class="fgrid">
      <label>Name *<input name="name" required value="${esc(c.name)}" placeholder="z. B. Haftpflicht"></label>
      <label>Kategorie<select name="category">${CONTRACT_CATEGORIES.map((k) => `<option ${k === c.category ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label>Anbieter<input name="provider" value="${esc(c.provider)}" placeholder="z. B. HUK-Coburg"></label>
      <label>Vertragsnummer<input name="contractNo" value="${esc(c.contractNo)}"></label>
      <label>Beginn<input name="startDate" type="date" value="${esc(c.startDate)}"></label>
      <label>Laufzeitende<input name="endDate" type="date" value="${esc(c.endDate)}"></label>
      <label>Kündigungsfrist (Monate)<input name="noticePeriodMonths" type="number" inputmode="numeric" value="${c.noticePeriodMonths ?? ''}"></label>
      <label>Verlängerung (Monate)<input name="autoRenewMonths" type="number" inputmode="numeric" value="${c.autoRenewMonths ?? 12}"></label>
      <label class="span-all">Notizen<textarea name="notes" rows="2">${esc(c.notes)}</textarea></label>
      <label class="check"><input type="checkbox" name="active" ${c.active ? 'checked' : ''}> Vertrag läuft noch</label>
    </div>
    <h2>Kosten pro Jahr</h2>
    <p class="small muted">Entweder Jahreskosten oder Monatsbetrag (wird ×12 gerechnet). Jahre ohne Eintrag schätzt die App ab „Beginn“ automatisch. „Günstigstes Angebot“ = was du im selben Jahr woanders bezahlt hättest.</p>
    <div id="years">${(c.years.length ? c.years : [{}]).map(yearRow).join('')}</div>
    <button type="button" class="btn" id="add-year">${icon('plus')} Jahr hinzufügen</button>
    <div class="btn-row end"><a class="btn" href="${id ? '#/vertrag/' + id : '#/vertraege'}">Abbrechen</a><button class="btn primary">Speichern</button></div>
  </form>`;
}

// ---------- Statistik ----------
function viewStats() {
  const sts = store.statements();
  if (!sts.length) return emptyState();
  const cats = Object.keys(CATEGORIES).filter((k) => sts.some((s) => s.positions.some((p) => p.category === k)));
  const catSum = (s, k) => s.positions.filter((p) => p.category === k).reduce((a, p) => a + p.amount, 0);
  const cs = store.contracts();
  const ys = [...sts.map((s) => s.year), ...contractsYears(cs), ...(sts.length ? [new Date().getFullYear()] : [])];
  const fixYears = ys.length ? Array.from({ length: Math.max(...ys) - Math.min(...ys) + 1 }, (_, i) => Math.min(...ys) + i) : [];
  afterRender.push(() => {
    lineChart($('#ch-s1'), { labels: sts.map((s) => String(s.year)), unit: '€/m²', series: [
      { name: 'Kosten pro m²', color: 'var(--c3)', values: sts.map((s) => (s.unit.livingArea ? s.totals.costs / s.unit.livingArea : null)) },
    ] });
    barChart($('#ch-s2'), { bars: sts.map((s) => ({ label: String(s.year), value: s.totals.balance ?? 0, color: (s.totals.balance ?? 0) < 0 ? 'var(--critical)' : 'var(--good)',
      tip: `<b>${s.year}</b><br>${(s.totals.balance ?? 0) < 0 ? 'Nachzahlung' : 'Guthaben'} ${eur(Math.abs(s.totals.balance ?? 0))}` })).map((b) => ({ ...b, value: Math.abs(b.value) })), unit: '€' });
  });
  return `
  <header class="page-head"><div><h1>Statistik</h1><p class="sub">Alle Jahre im Vergleich</p></div></header>
  <div class="grid">
    <section class="card span2"><div class="card-head"><h2>Kosten pro m²</h2></div><div id="ch-s1" class="chart"></div></section>
    <section class="card"><div class="card-head"><h2>Nachzahlung / Guthaben</h2></div><div id="ch-s2" class="chart"></div>
      <p class="small muted"><span class="dot" style="background:var(--critical)"></span>Nachzahlung <span class="dot" style="background:var(--good)"></span>Guthaben</p></section>
    <section class="card span3"><div class="card-head"><h2>Kategorien je Jahr</h2></div>
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th>Kategorie</th>${sts.map((s) => `<th class="r">${s.year}</th>`).join('')}${sts.length > 1 ? '<th class="r">Δ</th>' : ''}</tr></thead>
        <tbody>${cats.map((k) => {
          const vals = sts.map((s) => catSum(s, k));
          const a = vals[vals.length - 2], b = vals[vals.length - 1];
          return `<tr><td>${CATEGORIES[k].label}</td>${vals.map((v) => `<td class="r">${v ? eur(v) : '–'}</td>`).join('')}${sts.length > 1 ? `<td class="r">${a ? delta(((b - a) / a) * 100) : '–'}</td>` : ''}</tr>`;
        }).join('')}</tbody>
        <tfoot><tr><td>Gesamt</td>${sts.map((s) => `<td class="r">${eur(s.totals.costs)}</td>`).join('')}${sts.length > 1 ? `<td class="r">${delta(((sts[sts.length - 1].totals.costs - sts[sts.length - 2].totals.costs) / sts[sts.length - 2].totals.costs) * 100)}</td>` : ''}</tr>
        <tr><td>Vorauszahlungen</td>${sts.map((s) => `<td class="r">${eur(s.totals.prepayments)}</td>`).join('')}${sts.length > 1 ? '<td></td>' : ''}</tr></tfoot>
      </table></div></section>
    ${cs.length ? `<section class="card span3"><div class="card-head"><h2>Gesamte Fixkosten</h2><span class="small muted">Nebenkosten + Verträge</span></div>
      <table class="tbl fix"><thead><tr><th>Jahr</th><th class="r">Nebenkosten</th><th class="r">Verträge</th><th class="r">Summe</th></tr></thead><tbody>
      ${fixYears.slice().reverse().map((y) => {
        const nk = nebenkostenForYear(y), ct = contractsTotal(cs, y), est = contractsHasEstimate(cs, y);
        return `<tr><td><b>${y}</b></td>
          <td class="r">${nk ? eur(nk.value) + (nk.kind === 'vorauszahlung' ? '¹' : '') : '–'}<div class="small muted">${nk ? (nk.kind === 'abrechnung' ? 'Abrechnung' : eur(nk.monthly, 0) + ' mtl.') : 'keine Abrechnung'}</div></td>
          <td class="r">${eur(ct)}${est ? '*' : ''}<div class="small muted">${eur(ct / 12, 0)} mtl.</div></td>
          <td class="r"><b>${eur((nk?.value || 0) + ct)}</b><div class="small muted">${eur(((nk?.value || 0) + ct) / 12, 0)} mtl.</div></td></tr>`;
      }).join('')}</tbody></table>
      <p class="small muted">${fixYears.some((y) => nebenkostenForYear(y)?.kind === 'vorauszahlung') ? '¹ noch keine Abrechnung – laufende Vorauszahlung laut letzter Abrechnung × 12.<br>' : ''}${fixYears.some((y) => contractsHasEstimate(cs, y)) ? '* enthält geschätzte Vertragskosten (ab Vertragsbeginn).<br>' : ''}${fixYears.some((y) => !nebenkostenForYear(y)) ? '„keine Abrechnung“: Für diese Jahre liegt keine Nebenkostenabrechnung vor – einfach über „Import“ nachtragen.' : ''}</p></section>` : ''}
  </div>`;
}

// ---------- Import ----------
let pending = null;
function viewImport() {
  afterRender.push(() => {
    const preview = $('#preview');
    const handle = (text, src) => {
      try {
        pending = { ...parseImport(text), src };
        const p = pending;
        preview.innerHTML = `<div class="card">
          <h2>Vorschau</h2>
          ${p.isBackup ? '<div class="insight warning">' + icon('warn') + '<div><b>Vollständige Sicherung</b><p>Beim Übernehmen werden alle aktuellen Daten ersetzt.</p></div></div>' : ''}
          ${p.statements.map((s) => `<div class="insight ${store.statement(s.year) ? 'warning' : 'good'}">${icon('doc')}<div><b>Abrechnung ${s.year}: ${eur(s.totals.costs)}</b><p>${s.positions.length} Positionen · Saldo ${eur(s.totals.balance)}${store.statement(s.year) ? ' · ersetzt vorhandene Abrechnung (alte Version bleibt im Verlauf)' : ''}</p></div></div>`).join('')}
          ${p.contracts.map((c) => `<div class="insight good">${icon('contract')}<div><b>Vertrag: ${esc(c.name)}</b><p>${esc(c.category)} · ${c.years.length} Jahr(e)</p></div></div>`).join('')}
          ${p.warnings.map((w) => `<div class="insight warning">${icon('warn')}<div><p>${esc(w)}</p></div></div>`).join('')}
          <div class="btn-row end"><button class="btn" id="imp-cancel">Abbrechen</button><button class="btn primary" id="imp-ok">Übernehmen</button></div></div>`;
        $('#imp-cancel').onclick = () => { pending = null; preview.innerHTML = ''; };
        $('#imp-ok').onclick = () => {
          if (p.isBackup) store.restore(p.raw);
          else {
            p.statements.forEach((s) => store.upsertStatement(s, src));
            p.contracts.forEach((c) => store.upsertContract(c));
          }
          if (p.statements.length) store.setSetting('selectedYear', Math.max(...p.statements.map((s) => s.year)));
          toast('Import erfolgreich');
          location.hash = p.statements.length ? '#/' : '#/vertraege';
        };
        preview.scrollIntoView({ behavior: 'smooth' });
      } catch (e) {
        preview.innerHTML = `<div class="insight critical">${icon('warn')}<div><b>Import nicht möglich</b><p>${esc(e.message)}</p></div></div>`;
      }
    };
    $('#file').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      handle(await f.text(), 'Datei ' + f.name);
      e.target.value = '';
    });
    $('#paste-btn').addEventListener('click', () => handle($('#paste').value, 'Eingefügter Text'));
    $('#clip-btn')?.addEventListener('click', async () => {
      try { const t = await navigator.clipboard.readText(); $('#paste').value = t; handle(t, 'Zwischenablage'); }
      catch { toast('Zugriff auf Zwischenablage nicht erlaubt – bitte manuell einfügen'); }
    });
  });
  return `
  <header class="page-head"><div><h1>Import</h1><p class="sub">Neue Abrechnung oder Verträge hinzufügen</p></div></header>
  <section class="card steps">
    <h2>So geht’s mit Claude</h2>
    <ol>
      <li>Öffne <a href="#/mehr" data-open-prompt>„Mehr → Claude-Anleitung“</a> und kopiere den Prompt.</li>
      <li>Schicke Claude den Prompt zusammen mit den Fotos/PDFs deiner Abrechnung.</li>
      <li>Claude antwortet mit einer JSON-Datei – lade sie hier hoch oder kopiere den Text und füge ihn unten ein.</li>
    </ol>
  </section>
  <div class="grid">
    <section class="card"><h2>Datei wählen</h2>
      <label class="drop file">${icon('upload')}<div><b>JSON-Datei auswählen</b><span class="small muted">.json aus „Dateien“, Mail oder Claude</span></div>
      <input type="file" id="file" accept=".json,application/json,text/plain" hidden></label></section>
    <section class="card span2"><h2>Text einfügen</h2>
      <textarea id="paste" rows="7" placeholder='{"format":"nebenkostencheck", "statements":[ ... ]}'></textarea>
      <div class="btn-row"><button class="btn" id="clip-btn">Aus Zwischenablage</button><button class="btn primary" id="paste-btn">Prüfen</button></div></section>
  </div>
  <div id="preview"></div>`;
}

// ---------- Mehr ----------
const logItem = (a) => `<li><span class="muted small">${new Date(a.ts).toLocaleString('de-DE')}</span><b>${esc(a.action)}</b><span class="small">${esc(a.detail)}</span></li>`;

function viewMore() {
  const s = store.get();
  afterRender.push(() => {
    $('#exp').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(store.backup(), null, 2)], { type: 'application/json' });
      const name = `nebenkostencheck-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([blob], name, { type: 'application/json' });
      store.logExport();
      if (navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file], title: name }).catch(() => {});
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    });
    $('#reset').addEventListener('click', () => {
      if (confirm('Wirklich ALLE Daten auf diesem Gerät löschen? Vorher besser eine Sicherung exportieren.')) { store.reset(); toast('Alle Daten gelöscht'); location.hash = '#/'; }
    });
    $('#copy-prompt').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#prompt').textContent); toast('Prompt kopiert'); }
      catch { toast('Kopieren nicht möglich – Text markieren und kopieren'); }
    });
    fetch('docs/CLAUDE_PROMPT.md').then((r) => r.text()).then((t) => {
      const m = t.match(/<!-- PROMPT START -->([\s\S]*?)<!-- PROMPT END -->/);
      $('#prompt').textContent = (m ? m[1] : t).trim();
    }).catch(() => { $('#prompt').textContent = 'Anleitung konnte nicht geladen werden (offline?).'; });
    $('#upd').addEventListener('click', async () => {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) { await reg.update(); toast('Nach Updates gesucht'); } else location.reload();
    });
    if (location.hash === '#/mehr' && sessionStorage.getItem('openPrompt')) {
      sessionStorage.removeItem('openPrompt');
      $('#prompt-card').open = true; $('#prompt-card').scrollIntoView();
    }
  });
  return `
  <header class="page-head"><div><h1>Mehr</h1><p class="sub">Version ${APP_VERSION}</p></div></header>
  <div class="grid">
    <section class="card span3">
      <details id="prompt-card"><summary><h2>${icon('spark')} Claude-Anleitung (Prompt)</h2></summary>
        <p class="small muted">Kopieren, in Claude einfügen und Fotos/PDF der neuen Abrechnung anhängen. Claude liefert die Importdatei.</p>
        <pre id="prompt" class="prompt">Lädt…</pre>
        <button class="btn primary" id="copy-prompt">Prompt kopieren</button>
      </details>
    </section>
    <section class="card"><h2>Daten</h2>
      <ul class="kv"><li><span>Abrechnungen</span><b>${s.statements.length}</b></li><li><span>Verträge</span><b>${s.contracts.length}</b></li></ul>
      <p class="small muted">Daten liegen nur auf diesem Gerät. Exportiere regelmäßig eine Sicherung (z. B. in iCloud Drive).</p>
      <div class="btn-row"><button class="btn primary" id="exp">Sicherung exportieren</button><a class="btn" href="#/import">Sicherung importieren</a></div>
      <button class="btn danger small-btn" id="reset">Alle Daten löschen</button>
    </section>
    <section class="card"><h2>Auf dem iPhone installieren</h2>
      <ol class="small"><li>Diese Seite in <b>Safari</b> öffnen</li><li>Teilen-Symbol <b>⎋</b> antippen</li><li><b>„Zum Home-Bildschirm“</b> wählen</li></ol>
      <p class="small muted">Danach startet die App im Vollbild und funktioniert offline.</p>
      <button class="btn" id="upd">Nach Update suchen</button>
    </section>
    <section class="card"><details class="fold"><summary><h2>Versionen & Änderungen</h2><span class="small muted">v${APP_VERSION} · ${CHANGELOG.length} ${CHANGELOG.length === 1 ? 'Version' : 'Versionen'}</span>${icon('chev', 'fold-ic')}</summary>
      ${CHANGELOG.map((v, i) => `<details class="ver" ${i === 0 ? 'open' : ''}><summary><b>v${v.version}</b> <span class="muted small">${dateDe(v.date)}</span>${v.version === APP_VERSION ? ' <span class="pill">aktuell</span>' : ''}<span class="small grow"> ${esc(v.title)}</span>${icon('chev', 'fold-ic')}</summary><ul class="small">${v.changes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>`).join('')}
    </details></section>
    <section class="card span3"><details class="fold"><summary><h2>Änderungsprotokoll deiner Daten</h2><span class="small muted">${s.activity.length} ${s.activity.length === 1 ? 'Eintrag' : 'Einträge'}${s.activity[0] ? ' · zuletzt ' + new Date(s.activity[0].ts).toLocaleDateString('de-DE') : ''}</span>${icon('chev', 'fold-ic')}</summary>
      ${s.activity.length ? `<ul class="log">${s.activity.slice(0, 10).map(logItem).join('')}</ul>
        ${s.activity.length > 10 ? `<details class="more-log"><summary class="link">Ältere anzeigen (${s.activity.length - 10})</summary><ul class="log">${s.activity.slice(10).map(logItem).join('')}</ul></details>` : ''}` : '<p class="muted">Noch keine Änderungen.</p>'}
    </details>
    </section>
  </div>`;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-open-prompt]')) sessionStorage.setItem('openPrompt', '1');
});

// ---------- Start ----------
installTooltip();
render();

// Was-ist-neu-Hinweis nach Update
const seen = store.get().settings.lastSeenVersion;
if (seen && seen !== APP_VERSION) {
  const v = CHANGELOG.find((x) => x.version === APP_VERSION);
  toast(`<b>Neu in v${APP_VERSION}:</b> ${esc(v?.title || '')} – Details unter „Mehr“`, 6000);
}
if (seen !== APP_VERSION) store.setSetting('lastSeenVersion', APP_VERSION);
$('#app-version').textContent = 'v' + APP_VERSION;

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Neue Version verfügbar – <a href="#" onclick="location.reload();return false">jetzt laden</a>', 10000);
        }
      });
    });
  }).catch(() => {});
}
