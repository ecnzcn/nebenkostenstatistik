// Regelbasierte Analyse: Vorjahresvergleich, Prüfhinweise, Prognose, Vertragsbewertung.
import { GROUPS, groupTotals, categoryTotals } from './model.js';

// Orientierungswerte €/m²/Monat (gerundet, angelehnt an den DMB-Betriebskostenspiegel Deutschland).
// Nur grober Richtwert – regionale Unterschiede sind groß.
export const BENCHMARK_M2_MONTH = {
  heizung: 1.2, warmwasser: 0.35, wasser: 0.36, hausmeister: 0.44, grundsteuer: 0.2,
  muell: 0.18, versicherung: 0.24,
};

export const eur = (n, digits = 2) =>
  n === null || n === undefined || Number.isNaN(n) ? '–'
    : n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + ' €';
export const pct = (n, digits = 1) =>
  n === null || !Number.isFinite(n) ? '–' : (n > 0 ? '+' : '') + n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + ' %';
export const numf = (n, digits = 0) =>
  n === null || n === undefined ? '–' : n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const dateDe = (iso) => (iso ? new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('de-DE') : '–');

const change = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null);

export function kpis(st, prev) {
  const g = groupTotals(st);
  const area = st.unit.livingArea;
  const heat = g.heizung + g.warmwasser;
  const water = g.wasser;
  const total = st.totals.costs;
  const res = {
    total, heat, water,
    perM2: area ? total / area : null,
    perMonth: total / 12,
    balance: st.totals.balance,
  };
  if (prev) {
    const pg = groupTotals(prev);
    res.d = {
      total: change(total, prev.totals.costs),
      heat: change(heat, pg.heizung + pg.warmwasser),
      water: change(water, pg.wasser),
      perM2: area && prev.unit.livingArea ? change(total / area, prev.totals.costs / prev.unit.livingArea) : null,
    };
  }
  return res;
}

// Ergebnis: { summary, drivers[], insights[] }
export function analyze(st, prev, all) {
  const insights = [];
  const drivers = [];
  const g = groupTotals(st);
  const area = st.unit.livingArea;
  let summary;

  if (prev) {
    const pg = groupTotals(prev);
    const diff = st.totals.costs - prev.totals.costs;
    summary = `Deine Nebenkosten sind gegenüber ${prev.year} um ${eur(Math.abs(diff))} (${pct(change(st.totals.costs, prev.totals.costs))}) ${diff >= 0 ? 'gestiegen' : 'gesunken'}.`;
    for (const grp of GROUPS) {
      const d = g[grp.key] - pg[grp.key];
      if (Math.abs(d) >= 1) drivers.push({ ...grp, diff: d, pct: change(g[grp.key], pg[grp.key]) });
    }
    drivers.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    drivers.splice(4);

    const ch = st.consumption.heatingKwh, ph = prev.consumption?.heatingKwh;
    if (ch && ph) {
      const cPct = change(ch, ph);
      const kPct = change(g.heizung, pg.heizung);
      if (kPct !== null && Math.abs(kPct - cPct) > 5) {
        insights.push({ level: 'info', title: 'Preis vs. Verbrauch',
          text: `Dein Heizverbrauch hat sich um ${pct(cPct)} verändert, die Heizkosten um ${pct(kPct)}. ` +
            (kPct > cPct ? 'Der Anstieg kommt also eher aus höheren Preisen als aus mehr Verbrauch.' : 'Die Kosten sind schwächer gestiegen als der Verbrauch – günstigere Preise.') });
      }
    }
  } else {
    summary = `Erste erfasste Abrechnung: ${eur(st.totals.costs)} für ${st.year}` + (area ? ` (${eur(st.totals.costs / area / 12)} pro m² und Monat).` : '.');
    const top = GROUPS.map((x) => ({ ...x, diff: g[x.key] })).filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 4);
    drivers.push(...top.map((x) => ({ ...x, pct: (x.diff / st.totals.costs) * 100, isShare: true })));
  }

  // --- Prüfhinweise ---
  const cat = categoryTotals(st);

  // Kabel-TV: Umlagefähigkeit endete am 30.06.2024 (TKG-Novelle, § 2 Nr. 15 BetrKV)
  if (cat.kabel > 0 && st.year >= 2024) {
    const day = (s) => Math.floor(Date.parse(s) / 864e5);
    const f = day(st.usageFrom), t = day(st.usageTo), cut = day('2024-06-30');
    const days = t - f + 1;
    const allowedDays = Math.max(0, Math.min(t, cut) - f + 1);
    const allowed = (cat.kabel * allowedDays) / days;
    const over = cat.kabel - allowed;
    if (over > 1) {
      insights.push({ level: 'warning', title: 'Kabelgebühren prüfen',
        text: `Seit 01.07.2024 dürfen Kabel-TV-Gebühren nicht mehr über die Nebenkosten abgerechnet werden. ` +
          `Von ${eur(cat.kabel)} wären nur ca. ${eur(allowed)} zulässig – mögliche Erstattung ca. ${eur(over)}.` });
    }
  }

  // Abrechnungsfrist (§ 556 Abs. 3 BGB): 12 Monate nach Ende des Abrechnungszeitraums
  if (st.issuedOn) {
    const end = new Date(st.periodTo); const deadline = new Date(end); deadline.setFullYear(end.getFullYear() + 1);
    if (new Date(st.issuedOn) > deadline && (st.totals.balance ?? 0) < 0) {
      insights.push({ level: 'critical', title: 'Abrechnung zu spät',
        text: `Die Abrechnung kam nach dem ${dateDe(deadline.toISOString().slice(0, 10))}. Eine Nachzahlung muss dann in der Regel nicht geleistet werden.` });
    }
  }

  // Einwendungsfrist: 12 Monate nach Zugang
  if (st.receivedOn) {
    const r = new Date(st.receivedOn); const dl = new Date(r); dl.setFullYear(r.getFullYear() + 1);
    const daysLeft = Math.ceil((dl - new Date()) / 864e5);
    insights.push(daysLeft > 0
      ? { level: daysLeft < 60 ? 'warning' : 'info', title: 'Einwendungsfrist',
          text: `Einwände gegen diese Abrechnung sind noch bis ${dateDe(dl.toISOString().slice(0, 10))} möglich (${daysLeft} Tage).` }
      : { level: 'info', title: 'Einwendungsfrist abgelaufen',
          text: `Die 12-Monats-Frist für Einwände endete am ${dateDe(dl.toISOString().slice(0, 10))}. Hinweise gelten für künftige Abrechnungen.` });
  }

  // Summenprüfung
  const posSum = st.positions.reduce((a, p) => a + p.amount, 0);
  if (Math.abs(posSum - st.totals.costs) > 0.05) {
    insights.push({ level: 'warning', title: 'Summe stimmt nicht', text: `Positionen ergeben ${eur(posSum)}, ausgewiesen sind ${eur(st.totals.costs)}.` });
  }

  // Warmwasser / Heizung vs. Gebäudedurchschnitt
  const c = st.consumption;
  if (c.hotWaterKwhPerM2 && c.hotWaterKwhPerM2Building && c.hotWaterKwhPerM2 > c.hotWaterKwhPerM2Building * 1.3) {
    insights.push({ level: 'info', title: 'Warmwasser über Hausdurchschnitt',
      text: `Dein Warmwasser-Verbrauch liegt bei ${numf(c.hotWaterKwhPerM2, 1)} kWh/m², der Hausdurchschnitt bei ${numf(c.hotWaterKwhPerM2Building, 1)} kWh/m² (${numf(c.hotWaterKwhPerM2 / c.hotWaterKwhPerM2Building, 1)}×). Warmwasser kostete dich ${eur(g.warmwasser)} – der größte Hebel zum Sparen.` });
  }
  if (c.waterTotalM3) {
    const lpd = (c.waterTotalM3 * 1000) / 365;
    insights.push({ level: 'info', title: 'Wasserverbrauch',
      text: `${numf(c.waterTotalM3, 1)} m³ im Jahr ≈ ${numf(lpd)} Liter pro Tag für den Haushalt (Ø in Deutschland ca. 125 l pro Person und Tag).` });
  }

  // Richtwerte €/m²/Monat
  if (area) {
    const high = [];
    for (const [k, bench] of Object.entries(BENCHMARK_M2_MONTH)) {
      const v = g[k] / area / 12;
      if (v > bench * 1.5) high.push(`${GROUPS.find((x) => x.key === k).label} ${numf(v, 2)} €/m² (Richtwert ca. ${numf(bench, 2)})`);
    }
    if (high.length) insights.push({ level: 'info', title: 'Über bundesweitem Richtwert', text: high.join(' · ') + ' pro Monat.' });
  }

  // Vorauszahlungs-Prognose
  const sched = st.prepaymentSchedule;
  if (sched.length) {
    const current = sched[sched.length - 1].monthly;
    // Kabel-TV entfällt ab 2025 vollständig
    const expected = st.totals.costs - (st.year >= 2024 ? cat.kabel || 0 : 0);
    const yearly = current * 12;
    const diff = yearly - expected;
    const suggest = Math.ceil(expected / 12 / 5) * 5;
    insights.push({ level: diff < -50 ? 'warning' : diff < 0 ? 'info' : 'good', title: `Prognose ${st.year + 1}`,
      text: `Bei aktuell ${eur(current, 0)} Vorauszahlung im Monat (${eur(yearly, 0)}/Jahr) und gleichen Kosten ` +
        (diff >= 0 ? `ergibt sich voraussichtlich ein Guthaben von ca. ${eur(diff, 0)}.`
          : `droht eine Nachzahlung von ca. ${eur(-diff, 0)}. Passend wären ca. ${eur(suggest, 0)} im Monat.`) });
  }

  return { summary, drivers, insights };
}

export function tax35a(st) {
  const h = st.tax35a?.householdServices || 0, c = st.tax35a?.craftsmenServices || 0;
  return { household: h, craftsmen: c, reduction: Math.round((h + c) * 0.2 * 100) / 100 };
}

// --- Verträge ---
const r2 = (n) => Math.round(n * 100) / 100;

// Aktive Monate eines Vertrags im Jahr (1–12), anhand Beginn und – bei beendeten Verträgen – Ende.
function monthsActive(c, year) {
  const start = c.startDate ? new Date(c.startDate + 'T12:00:00') : null;
  const end = !c.active && c.endDate ? new Date(c.endDate + 'T12:00:00') : null;
  let from = 0, to = 11;
  if (start) { if (start.getFullYear() > year) return 0; if (start.getFullYear() === year) from = start.getMonth(); }
  if (end) { if (end.getFullYear() < year) return 0; if (end.getFullYear() === year) to = end.getMonth(); }
  return Math.max(0, to - from + 1);
}

// Erfasste Jahre + geschätzte Jahre seit Vertragsbeginn (Monatsbetrag aus dem nächstgelegenen erfassten Jahr).
export function contractTimeline(c) {
  const explicit = c.years.map((y) => ({ ...y, estimated: false }));
  if (!c.startDate || !explicit.length) return explicit;
  const startY = new Date(c.startDate + 'T12:00:00').getFullYear();
  const curY = new Date().getFullYear();
  const endY = !c.active && c.endDate ? Math.min(curY, new Date(c.endDate + 'T12:00:00').getFullYear()) : curY;
  const have = new Set(explicit.map((y) => y.year));
  const out = [...explicit];
  for (let y = startY; y <= endY; y++) {
    if (have.has(y)) continue;
    const months = monthsActive(c, y);
    if (!months) continue;
    const earlier = explicit.filter((e) => e.year < y).pop();
    const ref = earlier || explicit.find((e) => e.year > y);
    const refMonths = monthsActive(c, ref.year) || 12;
    const monthly = ref.cost / refMonths;
    out.push({ year: y, cost: r2(monthly * months), tariff: ref.tariff, provider: ref.provider, benchmark: null,
      benchmarkNote: '', note: months < 12 ? `${months} Monate` : '', estimated: true, months });
  }
  return out.sort((a, b) => a.year - b.year);
}

export function contractYear(c, year) { return contractTimeline(c).find((y) => y.year === year); }

export function rateContractYear(y) {
  if (!y || y.benchmark == null || !y.cost) return null;
  const over = y.cost - y.benchmark;
  const p = (over / y.benchmark) * 100;
  if (p <= 5) return { level: 'good', label: 'Gut gewählt', over, p };
  if (p <= 20) return { level: 'warning', label: 'Okay', over, p };
  return { level: 'critical', label: 'Zu teuer', over, p };
}

export function contractsYears(contracts) {
  const s = new Set();
  contracts.forEach((c) => contractTimeline(c).forEach((y) => s.add(y.year)));
  return [...s].sort((a, b) => a - b);
}

export function contractsTotal(contracts, year) {
  return contracts.reduce((a, c) => a + (contractYear(c, year)?.cost || 0), 0);
}

export function contractsHasEstimate(contracts, year) {
  return contracts.some((c) => contractYear(c, year)?.estimated);
}

// Nächstmöglicher Kündigungstermin
export function noticeInfo(c) {
  if (!c.endDate || !c.active) return null;
  let end = new Date(c.endDate + 'T12:00:00');
  const now = new Date();
  const renew = c.autoRenewMonths || 12;
  let guard = 0;
  while (end < now && guard++ < 50) end.setMonth(end.getMonth() + renew);
  const last = new Date(end);
  last.setMonth(last.getMonth() - (c.noticePeriodMonths || 0));
  const days = Math.ceil((last - now) / 864e5);
  return { end, lastNotice: last, days };
}
