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
  vm.runInNewContext(js, { module, exports: module.exports, require: name => name === './claroQuality' ? load('claroQuality') : require(name), Date, Map, Math });
  return module.exports;
}
const { claroChart } = load('claroChart');
const { claroGoal, CLARO_GOAL } = load('claroQuality');
const month = (m, quality) => ({ month: m, quality, evaluated: quality == null ? 0 : 1 });

test('the target is 96 and absence is not a failed score', () => {
  assert.equal(CLARO_GOAL, 96); assert.equal(claroGoal(95.99), 'Bajo la meta');
  assert.equal(claroGoal(96), 'Cumple la meta'); assert.equal(claroGoal(null), 'Sin muestra');
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
