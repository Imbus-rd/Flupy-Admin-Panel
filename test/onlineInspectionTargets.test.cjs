const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/onlineInspectionTargets.ts'), 'utf8');
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { module: moduleValue, exports: moduleValue.exports, URLSearchParams, Intl, Date });
const { onlineTargetQuery, onlineTargetScale, onlineTargetExport } = moduleValue.exports;

test('target requests have their own explicit period and encode regional and supervisor filters', () => {
  const p = new URLSearchParams(onlineTargetQuery({ period: 'WEEK', date: '2026-11-17', region: 'Este & Sur', supervisorId: 'sup/1' }));
  assert.equal(p.get('period'), 'WEEK'); assert.equal(p.get('date'), '2026-11-17');
  assert.equal(p.get('region'), 'Este & Sur'); assert.equal(p.get('supervisorId'), 'sup/1');
  assert.equal(p.has('fromDate'), false);
});

test('bars share a single scale for actuals and targets and retain zero progress and overachievement', () => {
  const scale = onlineTargetScale([{ completed: 90, target: 60 }, { completed: 0, target: 60 }]);
  assert.equal(scale.maximum, 90); assert.equal(scale.width(90), 100);
  assert.equal(scale.width(0), 0); assert.equal(scale.width(60), 60 / 90 * 100);
  assert.equal(onlineTargetScale([]).width(0), 0);
  assert.equal(onlineTargetScale([{ completed: 0, target: null }]).width(0), 0);
});

test('Excel preserves numeric targets, historical snapshots, zero activity and the explicit period', () => {
  const out = onlineTargetExport({ monthlyGoal: 60, period: { fromDate: '2026-11-16', toDate: '2026-11-20', workdays: 5 },
    rows: [{ name: 'Supervisor', card: '001', region: 'Este', target: 14.29, completed: 0, percent: 0, remaining: 14.29,
      historical: true, daily: [{ date: '2026-11-17', target: 60 / 21, completed: 0 }] }] });
  assert.equal(out.headings.length, out.rows[0].length);
  assert.equal(out.rows[0][5], 60); assert.equal(out.rows[0][7], 14.29);
  assert.equal(out.rows[0][8], 0); assert.equal(out.rows[0][9], 0);
  assert.equal(out.rows[0][11], 'Sí'); assert.equal(out.daily[0][4], 60 / 21);
  assert.equal(out.rows[0][3], '2026-11-16');
});
