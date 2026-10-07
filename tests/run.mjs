// Golden-Tests für die Rechenlogik (ohne Browser): `npm test`
// Die erwarteten Werte stehen in tests/golden.json – eine spätere Swift-App
// lädt dieselben Fixtures und muss exakt dieselben Ergebnisse liefern.
// Nach bewusster Änderung der Logik: `npm run test:update`.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseImport, groupTotals, categoryTotals } from '../js/model.js';
import { kpis, forecastNext, nebenkostenForYear, consumptionSeries, tax35a, contractTimeline,
  rateContractYear, contractsTotal, noticeInfo } from '../js/analysis.js';

const NOW = new Date('2026-10-07T12:00:00');
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const r2 = (x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x);
const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => r2(v)));
const day = (d) => (d ? d.toISOString().slice(0, 10) : null);

const { statements } = parseImport(read('../data/abrechnung-2024.json'));
const { contracts } = parseImport(read('./fixtures/contracts.json'));
const st = statements[0];

const actual = round({
  statement2024: {
    groupTotals: groupTotals(st),
    categoryTotals: categoryTotals(st),
    kpis: kpis(st, null),
    tax35a: tax35a(st),
    forecast: forecastNext(statements),
    consumption: consumptionSeries(statements, 2024),
    nebenkostenForYear: Object.fromEntries([2023, 2024, 2025, 2026, 2027].map((y) => [y, nebenkostenForYear(statements, y, NOW)])),
  },
  contracts: Object.fromEntries(contracts.map((c) => [c.id, {
    timeline: contractTimeline(c, NOW).map(({ year, cost, estimated, months, benchmark }) => ({ year, cost, estimated, months: months ?? null, benchmark, rating: rateContractYear({ cost, benchmark })?.label ?? null })),
    notice: (() => { const n = noticeInfo(c, NOW); return n ? { end: day(n.end), lastNotice: day(n.lastNotice), days: n.days } : null; })(),
  }])),
  contractsTotal: Object.fromEntries([2014, 2015, 2020, 2023, 2024, 2025, 2026].map((y) => [y, contractsTotal(contracts, y, NOW)])),
});

const goldenPath = new URL('./golden.json', import.meta.url);
if (process.argv.includes('--update')) {
  writeFileSync(goldenPath, JSON.stringify(actual, null, 2) + '\n');
  console.log('golden.json aktualisiert');
  process.exit(0);
}
const expected = JSON.parse(readFileSync(goldenPath, 'utf8'));
const diffs = [];
(function cmp(a, b, path) {
  if (typeof a === 'object' && a && typeof b === 'object' && b) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) cmp(a[k], b[k], `${path}.${k}`);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${path}: erwartet ${JSON.stringify(b)}, erhalten ${JSON.stringify(a)}`);
})(actual, expected, '$');
if (diffs.length) { console.error(`✗ ${diffs.length} Abweichung(en):\n` + diffs.join('\n')); process.exit(1); }
console.log('✓ Alle Golden-Tests bestanden');
