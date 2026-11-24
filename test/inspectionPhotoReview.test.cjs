const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/lib/inspectionPhotoReview.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, { module: moduleUnderTest, exports: moduleUnderTest.exports });
const { inspectionPhotoReview, inspectionPhotoTitle, inspectionFindingCount } = moduleUnderTest.exports;
const photo = { id: 'photo', photoType: 'CUSTOMER_HOME', photoUrl: '/mock.jpg' };
test('FE remains visible with its comment and is included among PDF findings, independently of OK and Error', () => {
  const fe = inspectionPhotoReview({ ...photo, inspectorDecision: 'FE', inspectorComment: '  Revisar conexión  ' });
  assert.equal(fe.label, 'FE'); assert.equal(fe.comment, 'Revisar conexión'); assert.equal(fe.finding, true);
  assert.match(fe.tone, /amber/);
  assert.equal(inspectionPhotoReview({ ...photo, inspectorDecision: 'ERROR' }).label, 'Error');
  assert.equal(inspectionPhotoReview({ ...photo, inspectorDecision: 'OK' }).finding, false);
});
test('missing historical decisions are pending rather than fabricated OK and photo titles avoid untranslated keys', () => {
  assert.equal(inspectionPhotoReview(photo).label, 'Pendiente');
  assert.equal(inspectionPhotoReview(photo).finding, false);
  assert.equal(inspectionPhotoTitle(photo, 'inspectionPhotoCUSTOMER_HOME'), 'Vivienda del cliente');
  assert.equal(inspectionPhotoTitle(photo, 'Existing translation'), 'Existing translation');
});
test('grid and Excel use the server finding count, including FE, with a backwards-compatible fallback', () => {
  assert.equal(inspectionFindingCount({ findingsCount: 2, lowRatingGroups: 0, missingTools: 0 }), 2);
  assert.equal(inspectionFindingCount({ lowRatingGroups: 1, missingTools: 1, photoFindingCount: 2 }), 4);
  assert.equal(inspectionFindingCount({ lowRatingGroups: 0, missingTools: 0 }), 0);
});

test('all classified errors on a photograph are visible in detail and PDF comments, not only the worst one', () => {
  const result=inspectionPhotoReview({...photo,inspectorDecision:'ERROR',inspectorComment:'Comentario compartido',errors:[
    {code:'12',status:'NC',description:'Uno',group:'Cabina'},
    {code:'14',status:'X',description:'Dos',group:'Cabina'},
    {code:'70',status:'C',description:'Tres',group:'Equipos'}]});
  for(const text of ['12 · Cabina · Uno (No crítico)','14 · Cabina · Dos (No imputable)','70 · Equipos · Tres (Crítico)','Comentario compartido']) assert.ok(result.comment.includes(text));
});
