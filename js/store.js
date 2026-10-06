// Lokale Datenhaltung (nur auf diesem Gerät). Sicherung über Export.
import { APP_VERSION, DATA_FORMAT_VERSION } from './version.js';
import { uid } from './model.js';

const KEY = 'nebenkostencheck.v1';
const fmt = (n) => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const empty = () => ({
  dataVersion: DATA_FORMAT_VERSION,
  statements: [],
  contracts: [],
  activity: [],
  settings: { lastSeenVersion: null, selectedYear: null },
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const s = JSON.parse(raw);
    return { ...empty(), ...s, settings: { ...empty().settings, ...(s.settings || {}) } };
  } catch {
    return empty();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Speichern fehlgeschlagen', e);
  }
  listeners.forEach((fn) => fn(state));
}

function log(action, detail) {
  state.activity.unshift({ id: uid(), ts: new Date().toISOString(), appVersion: APP_VERSION, action, detail });
  state.activity = state.activity.slice(0, 300);
}

export const store = {
  get: () => state,
  subscribe: (fn) => listeners.add(fn),
  statements: () => [...state.statements].sort((a, b) => a.year - b.year),
  statement: (year) => state.statements.find((s) => s.year === year),
  contracts: () => state.contracts,
  contract: (id) => state.contracts.find((c) => c.id === id),

  upsertStatement(st, sourceLabel = 'Import') {
    const i = state.statements.findIndex((s) => s.year === st.year);
    const stamped = { ...st, importedAt: new Date().toISOString(), source: sourceLabel };
    if (i >= 0) {
      const old = state.statements[i];
      stamped.revisions = [
        { importedAt: old.importedAt, source: old.source, totals: old.totals, positions: old.positions },
        ...(old.revisions || []),
      ].slice(0, 10);
      state.statements[i] = stamped;
      log('Abrechnung aktualisiert', `${st.year}: Gesamt ${fmt(old.totals.costs)} → ${fmt(st.totals.costs)} (${sourceLabel})`);
    } else {
      state.statements.push(stamped);
      log('Abrechnung hinzugefügt', `${st.year}: Gesamt ${fmt(st.totals.costs)}, Saldo ${fmt(st.totals.balance)} (${sourceLabel})`);
    }
    persist();
  },

  deleteStatement(year) {
    state.statements = state.statements.filter((s) => s.year !== year);
    log('Abrechnung gelöscht', String(year));
    persist();
  },

  upsertContract(c, merge = true) {
    const i = state.contracts.findIndex((x) => x.id === c.id ||
      (merge && x.name.toLowerCase() === c.name.toLowerCase() && x.category === c.category));
    if (i >= 0) {
      const old = state.contracts[i];
      const years = new Map(old.years.map((y) => [y.year, y]));
      for (const y of c.years) years.set(y.year, y);
      state.contracts[i] = { ...old, ...c, id: old.id, years: [...years.values()].sort((a, b) => a.year - b.year) };
      log('Vertrag aktualisiert', c.name);
    } else {
      state.contracts.push(c);
      log('Vertrag hinzugefügt', `${c.name}${c.provider ? ' (' + c.provider + ')' : ''}`);
    }
    persist();
  },

  replaceContract(c) {
    const i = state.contracts.findIndex((x) => x.id === c.id);
    if (i >= 0) state.contracts[i] = c; else state.contracts.push(c);
    log(i >= 0 ? 'Vertrag bearbeitet' : 'Vertrag hinzugefügt', c.name);
    persist();
  },

  deleteContract(id) {
    const c = store.contract(id);
    state.contracts = state.contracts.filter((x) => x.id !== id);
    log('Vertrag gelöscht', c?.name || id);
    persist();
  },

  setSetting(k, v) {
    state.settings[k] = v;
    persist();
  },

  backup() {
    return {
      format: 'nebenkostencheck-backup',
      formatVersion: DATA_FORMAT_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      statements: state.statements,
      contracts: state.contracts,
      activity: state.activity,
    };
  },

  restore(data) {
    state = { ...empty(), statements: data.statements || [], contracts: data.contracts || [],
      activity: data.activity || [], settings: state.settings };
    log('Sicherung wiederhergestellt', `${state.statements.length} Abrechnungen, ${state.contracts.length} Verträge`);
    persist();
  },

  logExport() { log('Daten exportiert', 'Sicherungsdatei erstellt'); persist(); },

  reset() {
    const settings = state.settings;
    state = empty();
    state.settings = settings;
    log('Alle Daten gelöscht', '');
    persist();
  },
};
