const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', file + '.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, require: name => name === './claroQuality' ? load('claroQuality') : require(name), Date, Map, Math, URLSearchParams });
  return module.exports;
}
const { claroChart } = load('claroChart');
const { claroPreviousYearFilters, shiftClaroYear } = load('claroYearComparison');
const { claroGoal, CLARO_GOAL, claroQuery, normalizeClaroFilters, emptyClaroFilters, claroFlupyCoverage } = load('claroQuality');
const month = (m, quality) => ({ month: m, quality, evaluated: quality == null ? 0 : 1 });

test('upload coverage displays two decimals, matching sample counts and safe fallback for an older backend', () => {
  assert.equal(claroFlupyCoverage({ total: 3, flupyUploadedSamples: 2, flupyUploadPercent: 66.67 }).label, '66.67%');
  assert.equal(claroFlupyCoverage({ total: 3, flupyUploadedSamples: 2, flupyUploadPercent: 66.67 }).count, '2 / 3 muestras');
  assert.equal(claroFlupyCoverage({ total: 3, flupyUploadedSamples: 0, flupyUploadPercent: 0 }).label, '0.00%');
  assert.equal(claroFlupyCoverage({ total: 3 }).label, 'No verificado');
  assert.equal(claroFlupyCoverage({ total: 0, flupyUploadPercent: null }).label, 'Sin muestra');
});

test('the target is 96 and absence is not a failed score', () => {
  assert.equal(CLARO_GOAL, 96); assert.equal(claroGoal(95.99), 'Bajo la meta');
  assert.equal(claroGoal(96), 'Cumple la meta'); assert.equal(claroGoal(null), 'Sin muestra');
});

test('multiselect filters use repeated encoded parameters without conflating commas or ampersands', () => {
  const query = claroQuery({ ...emptyClaroFilters, region: ['ESTE', 'SUR'], supervisorCard: ['001', '002'],
    product: ['Voz, Datos', 'TV & Internet'], result: ['OK', 'PENDING'], process: 'REP' });
  assert.deepEqual(query.getAll('region'), ['ESTE', 'SUR']);
  assert.deepEqual(query.getAll('supervisorCard'), ['001', '002']);
  assert.deepEqual(query.getAll('product'), ['Voz, Datos', 'TV & Internet']);
  assert.deepEqual(query.getAll('result'), ['OK', 'PENDING']);
  assert.equal(query.get('process'), 'REP');
  assert.equal(query.has('technicianCard'), false);
});

test('responses from an older API normalize scalar and missing selections without changing current arrays', () => {
  const before = normalizeClaroFilters({ region: 'ESTE', supervisorCard: '', result: null });
  assert.deepEqual(Array.from(before.region), ['ESTE']);
  assert.equal(before.supervisorCard.length, 0);
  assert.equal(before.result.length, 0);
  const after = normalizeClaroFilters({ region: ['ESTE', 'SUR'], result: ['OK', 'OK'] });
  assert.deepEqual(Array.from(after.region), ['ESTE', 'SUR']);
  assert.deepEqual(Array.from(after.result), ['OK']);
});
test('a one-month chart has a visible centered point and a valid scale', () => {
  const c = claroChart([month('2026-10', 97.22)]);
  assert.equal(c.points.length, 1); assert.equal(c.segments.length, 0);
  assert.ok(c.points[0].x > c.left && c.points[0].x < c.width - c.right);
  assert.ok(c.points[0].y >= c.top && c.points[0].y < c.height - c.bottom);
});
test('segments cross the target with red below and teal above', () => {
  const c = claroChart([month('2026-09', 90), month('2026-10', 98)]);
  assert.equal(c.segments.length, 2);
  assert.equal(c.segments[0].color, '#f87171'); assert.equal(c.segments[1].color, '#2dd4bf');
  assert.equal(c.segments[0].y2, c.goalY); assert.equal(c.segments[1].y1, c.goalY);
});
test('missing months and pending-only months are gaps, never zero scores or joining lines', () => {
  const c = claroChart([month('2026-08', 99), month('2026-10', 97), month('2026-11', null), month('2026-12', 100)]);
  assert.equal(c.points.length, 5); assert.equal(c.points[1].quality, null); assert.equal(c.points[1].evaluated, 0);
  assert.equal(c.segments.length, 0);
});
test('zero scores render at the lower limit and an empty chart remains finite', () => {
  const c = claroChart([month('2026-10', 0)]);
  assert.equal(c.points[0].y, c.height - c.bottom);
  assert.ok(Number.isFinite(claroChart([]).goalY));
});

test('every month has a two-decimal label with target colors and no fabricated missing scores', () => {
  const c = claroChart([month('2026-01', 100), month('2026-02', 95.9), month('2026-04', 96)]);
  assert.deepEqual(Array.from(c.points, p => p.label), ['100.00%', '95.90%', 'Sin muestra', '96.00%']);
  assert.deepEqual(Array.from(c.points, p => p.color), ['#2dd4bf', '#f87171', '#94a3b8', '#2dd4bf']);
  assert.equal(c.points[2].y, null);
  for (const p of c.points) assert.ok(p.labelY > 18 && p.labelY < c.height - c.bottom);
});

test('long monthly ranges expand the chart so labels cannot crowd adjacent months', () => {
  const entries = Array.from({ length: 36 }, (_, i) => month((2024 + Math.floor(i / 12)) + '-' + String(i % 12 + 1).padStart(2, '0'), 97));
  const c = claroChart(entries);
  assert.ok(c.width > 920);
  for (let i = 1; i < c.points.length; i++) assert.ok(c.points[i].x - c.points[i - 1].x >= 77.99);
  assert.ok(c.points[0].x >= 42); assert.ok(c.width - c.points.at(-1).x >= 42);
});

test('previous year preserves all applied facets and clamps leap days rather than changing months', () => {
  const filters = { ...emptyClaroFilters, fromDate: '2024-02-29', toDate: '2024-03-17', region: ['ESTE'], supervisorCard: ['001'], technicianCard: ['002'], process: 'IN', result: ['OK'], state: 'initial' };
  const before = JSON.stringify(filters);
  const previous = claroPreviousYearFilters({ filters, monthly: [] });
  assert.equal(previous.fromDate, '2023-02-28'); assert.equal(previous.toDate, '2023-03-17');
  for (const key of ['region', 'supervisorCard', 'technicianCard', 'process', 'result', 'state']) assert.equal(previous[key], filters[key]);
  assert.equal(JSON.stringify(filters), before);
  assert.equal(shiftClaroYear('2025-01-01', -1), '2024-01-01');
  assert.throws(() => shiftClaroYear('2024-02-31', -1));
  assert.equal(claroPreviousYearFilters({ filters: emptyClaroFilters, monthly: [] }), null);
});

test('unbounded reports derive comparison dates from actual sample months', () => {
  const previous = claroPreviousYearFilters({ filters: emptyClaroFilters, monthly: [month('2026-02', 97), month('2026-01', 98)] });
  assert.equal(previous.fromDate, '2025-01-01'); assert.equal(previous.toDate, '2025-02-28');
  const leap = claroPreviousYearFilters({ filters: { ...emptyClaroFilters, fromDate: '2025-02-01', toDate: '2025-02-28' }, monthly: [] });
  assert.equal(leap.fromDate, '2024-02-01'); assert.equal(leap.toDate, '2024-02-29');
});

test('previous January aligns with January, scales both series and keeps absent months as gaps', () => {
  const c = claroChart([month('2026-01', 98), month('2026-03', 97)], {
    fromDate: '2026-01-01', toDate: '2026-04-30', previousMonths: [month('2025-01', 50), month('2025-02', 99), month('2025-04', 96), month('2024-03', 100)]
  });
  assert.equal(c.points.length, 4); assert.equal(c.previousPoints.length, 4);
  assert.deepEqual(Array.from(c.previousPoints, p => p.month), ['2025-01', '2025-02', '2025-03', '2025-04']);
  assert.equal(c.previousPoints[0].x, c.points[0].x);
  assert.equal(c.previousPoints[2].y, null); assert.equal(c.previousPoints[2].label, 'Sin muestra');
  assert.equal(c.previousSegments.length, 1); assert.equal(c.min, 40);
  assert.equal(c.previousPoints[0].color, '#f87171');
});

test('cross-year ranges compare each month to its own previous year without wrapping or averaging', () => {
  const c = claroChart([month('2025-12', 97), month('2026-01', 98)], { previousMonths: [month('2024-12', 90), month('2025-01', 100)] });
  assert.equal(c.previousPoints[0].quality, 90); assert.equal(c.previousPoints[1].quality, 100);
  assert.equal(c.previousSegments.length, 1);
});

test('comparison can render prior samples even if the selected period has none; disabling restores one series', () => {
  const c = claroChart([], { fromDate: '2026-01-01', toDate: '2026-02-28', previousMonths: [month('2025-01', 97)] });
  assert.equal(c.points[0].quality, null); assert.equal(c.previousPoints[0].quality, 97);
  const normal = claroChart([month('2026-01', 97)]);
  assert.equal(normal.previousPoints.length, 0); assert.equal(normal.previousSegments.length, 0);
});
