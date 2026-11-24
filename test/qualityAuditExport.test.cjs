const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ts=require('typescript'),ExcelJS=require('exceljs');
const mod={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/qualityAuditExport.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod,mod.exports);
const {populateQualityAuditWorkbook}=mod.exports;
const summary={name:'Técnico',card:'001',total:3,okSamples:1,criticalSamples:1,nonCriticalSamples:1,evaluatedSamples:3,pending:0,unclassified:0,compliancePercent:66.67};
function fixture(){return {items:[{id:'id',order:'000123',date:'2026-11-24T14:00:00Z',workType:'DTH',status:'APPROVED',decision:'OK',technician:'Técnico',card:'001',region:'Este',supervisor:'Supervisor',supervisorCard:'002',classification:'OK',photos:[]}],byTechnician:[summary],byRegion:[summary],bySupervisor:[summary],pareto:[{code:'12',description:'Descripción',group:'Cabina',status:'NC',occurrences:2,orders:1,percent:1,cumulativePercent:1}],nonAttributable:[],generatedAt:'2026-11-24T15:00:00Z',filters:{employeeCode:'001'}};}
test('professional export preserves identifiers, numeric percentages, explicit filters and named audit/summary/Pareto sheets',()=>{
  const b=populateQualityAuditWorkbook(new ExcelJS.Workbook(),fixture());
  assert.equal(b.worksheets.length,9);
  assert.equal(b.getWorksheet('Órdenes').getCell('B6').value,'000123');
  assert.equal(b.getWorksheet('Por técnico').getCell('B6').value,'001');
  assert.ok(Math.abs(b.getWorksheet('Por técnico').getCell('J6').value-0.6667)<1e-12);
  assert.equal(b.getWorksheet('Por técnico').getCell('J6').numFmt,'0.00%');
  assert.equal(b.getWorksheet('Por técnico').getCell('J6').font.color.argb,'FFC62828');
  assert.equal(b.getWorksheet('Pareto de errores').getCell('H6').value,1);
  assert.match(b.getWorksheet('Órdenes').getCell('A3').value,/employeeCode: 001/);
  assert.equal(b.getWorksheet('Auditoría de fotos').views[0].ySplit,5);
});
test('no sample is visibly unavailable, never zero or an apparently passing score',()=>{
  const data=fixture();data.byTechnician=[{...summary,compliancePercent:null}];data.pareto=[];
  const b=populateQualityAuditWorkbook(new ExcelJS.Workbook(),data);
  assert.equal(b.getWorksheet('Por técnico').getCell('J6').value,'Sin muestra');
  assert.equal(b.getWorksheet('Pareto gráfico').getCell('A5').value,'Sin errores imputables para estos filtros.');
});
