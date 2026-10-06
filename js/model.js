// Kategorien, Validierung und Normalisierung des Import-Formats.

export const CATEGORIES = {
  heizung:     { label: 'Heizung',              group: 'heizung' },
  warmwasser:  { label: 'Warmwasser',           group: 'warmwasser' },
  wasser:      { label: 'Wasser/Abwasser',      group: 'wasser' },
  hausmeister: { label: 'Hausmeister',          group: 'hausmeister' },
  reinigung:   { label: 'Hausreinigung',        group: 'hausmeister' },
  garten:      { label: 'Gartenpflege',         group: 'hausmeister' },
  grundsteuer: { label: 'Grundsteuer',          group: 'grundsteuer' },
  muell:       { label: 'Müll',                 group: 'muell' },
  versicherung:{ label: 'Gebäudeversicherung',  group: 'versicherung' },
  strom:       { label: 'Allgemeinstrom',       group: 'sonstiges' },
  aufzug:      { label: 'Aufzug',               group: 'sonstiges' },
  kabel:       { label: 'Kabel/TV',             group: 'sonstiges' },
  wartung:     { label: 'Wartung',              group: 'sonstiges' },
  stellplatz:  { label: 'Stellplatz',           group: 'sonstiges' },
  sonstiges:   { label: 'Sonstiges',            group: 'sonstiges' },
};

// Feste Reihenfolge = feste Farbe je Gruppe (Farbe folgt der Gruppe, nie dem Rang).
export const GROUPS = [
  { key: 'wasser',       label: 'Wasser/Abwasser', color: 'var(--c1)' },
  { key: 'heizung',      label: 'Heizung',         color: 'var(--c2)' },
  { key: 'hausmeister',  label: 'Hausmeister',     color: 'var(--c3)' },
  { key: 'warmwasser',   label: 'Warmwasser',      color: 'var(--c4)' },
  { key: 'grundsteuer',  label: 'Grundsteuer',     color: 'var(--c5)' },
  { key: 'muell',        label: 'Müll',            color: 'var(--c6)' },
  { key: 'versicherung', label: 'Versicherung',    color: 'var(--c7)' },
  { key: 'sonstiges',    label: 'Sonstiges',       color: 'var(--c-other)' },
];

export const CONTRACT_CATEGORIES = [
  'Versicherung', 'Handy', 'Internet', 'Strom', 'Gas', 'Streaming', 'Rundfunk',
  'Fitness', 'Auto', 'Bank', 'Software', 'Sonstiges',
];

const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  // "1.234,56" oder "1234.56"
  let s = String(v).replace(/[€\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function sumPositions(st) {
  return round2(st.positions.reduce((a, p) => a + (p.amount || 0), 0));
}

export function groupTotals(st) {
  const out = Object.fromEntries(GROUPS.map((g) => [g.key, 0]));
  for (const p of st.positions) {
    const g = (CATEGORIES[p.category] || CATEGORIES.sonstiges).group;
    out[g] = round2(out[g] + p.amount);
  }
  return out;
}

export function categoryTotals(st) {
  const out = {};
  for (const p of st.positions) out[p.category] = round2((out[p.category] || 0) + p.amount);
  return out;
}

// Normalisiert eine Abrechnung. Wirft Error mit verständlicher Meldung.
export function normalizeStatement(raw, idx = 0) {
  const where = `Abrechnung ${idx + 1}`;
  if (!raw || typeof raw !== 'object') throw new Error(`${where}: kein Objekt`);
  const year = Number(raw.year);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) throw new Error(`${where}: "year" fehlt oder ist ungültig`);
  if (!Array.isArray(raw.positions) || raw.positions.length === 0) throw new Error(`${where} (${year}): "positions" fehlt oder ist leer`);

  const warnings = [];
  const positions = raw.positions.map((p, i) => {
    const amount = num(p.amount);
    if (amount === null) throw new Error(`${where} (${year}): Position ${i + 1} hat keinen Betrag ("amount")`);
    let category = String(p.category || 'sonstiges').toLowerCase();
    if (!CATEGORIES[category]) {
      warnings.push(`Unbekannte Kategorie "${p.category}" bei "${p.label}" → Sonstiges`);
      category = 'sonstiges';
    }
    return {
      label: String(p.label || CATEGORIES[category].label),
      category,
      amount: round2(amount),
      buildingTotal: num(p.buildingTotal),
      allocationKey: p.allocationKey ? String(p.allocationKey) : '',
      share: p.share != null ? String(p.share) : '',
      source: p.source ? String(p.source) : '',
      note: p.note ? String(p.note) : '',
    };
  });

  const t = raw.totals || {};
  const st = {
    year,
    periodFrom: raw.periodFrom || `${year}-01-01`,
    periodTo: raw.periodTo || `${year}-12-31`,
    usageFrom: raw.usageFrom || raw.periodFrom || `${year}-01-01`,
    usageTo: raw.usageTo || raw.periodTo || `${year}-12-31`,
    issuedOn: raw.issuedOn || null,
    receivedOn: raw.receivedOn || raw.issuedOn || null,
    dueOn: raw.dueOn || null,
    issuer: raw.issuer ? String(raw.issuer) : '',
    unit: {
      label: raw.unit?.label ? String(raw.unit.label) : '',
      livingArea: num(raw.unit?.livingArea),
      meaShare: num(raw.unit?.meaShare),
      meaTotal: num(raw.unit?.meaTotal),
    },
    positions,
    totals: {
      costs: num(t.costs),
      prepayments: num(t.prepayments),
      balance: num(t.balance),
    },
    prepaymentSchedule: Array.isArray(raw.prepaymentSchedule)
      ? raw.prepaymentSchedule.map((r) => ({ months: num(r.months) || 0, monthly: num(r.monthly) || 0 }))
      : [],
    consumption: {},
    consumptionHistory: [],
    tax35a: {
      householdServices: num(raw.tax35a?.householdServices),
      craftsmenServices: num(raw.tax35a?.craftsmenServices),
    },
    notes: Array.isArray(raw.notes) ? raw.notes.map(String) : [],
  };

  const c = raw.consumption || {};
  for (const k of ['heatingKwh', 'hotWaterM3', 'hotWaterKwh', 'coldWaterM3', 'waterTotalM3',
    'heatingKwhPerM2', 'heatingKwhPerM2Building', 'hotWaterKwhPerM2', 'hotWaterKwhPerM2Building',
    'co2CostTenant', 'energyPricePerKwh']) {
    const v = num(c[k]);
    if (v !== null) st.consumption[k] = v;
  }
  if (Array.isArray(raw.consumptionHistory)) {
    st.consumptionHistory = raw.consumptionHistory
      .map((h) => ({ year: Number(h.year), heatingKwh: num(h.heatingKwh), hotWaterKwh: num(h.hotWaterKwh), waterTotalM3: num(h.waterTotalM3) }))
      .filter((h) => Number.isInteger(h.year));
  }

  // Summen ergänzen / prüfen
  const sum = sumPositions(st);
  if (st.totals.costs === null) st.totals.costs = sum;
  else if (Math.abs(st.totals.costs - sum) > 0.05) {
    warnings.push(`Summe der Positionen (${sum.toFixed(2)} €) weicht von "totals.costs" (${st.totals.costs.toFixed(2)} €) ab`);
  }
  if (st.totals.prepayments === null && st.prepaymentSchedule.length) {
    st.totals.prepayments = round2(st.prepaymentSchedule.reduce((a, r) => a + r.months * r.monthly, 0));
  }
  if (st.totals.balance === null && st.totals.prepayments !== null) {
    st.totals.balance = round2(st.totals.prepayments - st.totals.costs);
  }
  return { statement: st, warnings };
}

export function normalizeContract(raw, idx = 0) {
  if (!raw || typeof raw !== 'object') throw new Error(`Vertrag ${idx + 1}: kein Objekt`);
  if (!raw.name) throw new Error(`Vertrag ${idx + 1}: "name" fehlt`);
  const years = Array.isArray(raw.years) ? raw.years : [];
  return {
    id: raw.id ? String(raw.id) : uid(),
    name: String(raw.name),
    category: CONTRACT_CATEGORIES.includes(raw.category) ? raw.category : 'Sonstiges',
    provider: raw.provider ? String(raw.provider) : '',
    contractNo: raw.contractNo ? String(raw.contractNo) : '',
    startDate: raw.startDate || '',
    endDate: raw.endDate || '',
    noticePeriodMonths: num(raw.noticePeriodMonths),
    autoRenewMonths: num(raw.autoRenewMonths),
    active: raw.active !== false,
    notes: raw.notes ? String(raw.notes) : '',
    years: years
      .map((y) => ({
        year: Number(y.year),
        cost: num(y.cost) ?? (num(y.monthly) !== null ? round2(num(y.monthly) * 12) : null),
        tariff: y.tariff ? String(y.tariff) : '',
        provider: y.provider ? String(y.provider) : '',
        benchmark: num(y.benchmark),
        benchmarkNote: y.benchmarkNote ? String(y.benchmarkNote) : '',
        note: y.note ? String(y.note) : '',
      }))
      .filter((y) => Number.isInteger(y.year) && y.cost !== null)
      .sort((a, b) => a.year - b.year),
  };
}

// Akzeptiert: Import-Container, einzelne Abrechnung, Array von Abrechnungen, Voll-Backup.
export function parseImport(text) {
  let data;
  try {
    data = typeof text === 'string' ? JSON.parse(stripFences(text)) : text;
  } catch (e) {
    throw new Error('Kein gültiges JSON. Tipp: nur den Inhalt des Code-Blocks von Claude einfügen.');
  }
  let statements = [], contracts = [], isBackup = false;
  if (Array.isArray(data)) statements = data;
  else if (data.format === 'nebenkostencheck-backup') { isBackup = true; statements = data.statements || []; contracts = data.contracts || []; }
  else if (data.statements || data.contracts) { statements = data.statements || []; contracts = data.contracts || []; }
  else if (data.year && data.positions) statements = [data];
  else throw new Error('Unbekanntes Format: erwartet "statements" und/oder "contracts".');

  const warnings = [];
  const st = statements.map((s, i) => {
    const r = normalizeStatement(s, i);
    warnings.push(...r.warnings.map((w) => `${r.statement.year}: ${w}`));
    return r.statement;
  });
  const ct = contracts.map((c, i) => normalizeContract(c, i));
  return { statements: st, contracts: ct, warnings, isBackup, raw: data };
}

function stripFences(t) {
  const s = t.trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1] : s;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
