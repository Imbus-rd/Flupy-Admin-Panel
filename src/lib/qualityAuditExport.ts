import type ExcelJS from 'exceljs';

type Photo = { id: string; type: string; url: string; decision: string | null; comment: string | null;
  fe: number; feComment: string | null; errorCode: string | null; errorStatus: string | null;
  errorDescription: string | null; errorGroup: string | null; capturedAt: string | null; reviewedAt: string | null;
  reviewerId: string | null; latitude: number | null; longitude: number | null };
type AuditOrder = { id: string; order: string; date: string; updatedAt: string; workType: string; status: string; decision: string;
  technician: string; card: string; region: string; supervisor: string; supervisorCard: string; classification: string; photos: Photo[] };
type Summary = { name: string; card: string; total: number; okSamples: number; criticalSamples: number;
  nonCriticalSamples: number; evaluatedSamples: number; pending: number; unclassified: number; compliancePercent: number | null };
type ErrorRow = { code: string; description: string; group: string; status: string; occurrences: number; orders: number;
  percent?: number | null; cumulativePercent?: number | null };
export type QualityAuditReport = { items: AuditOrder[]; byTechnician: Summary[]; byRegion: Summary[]; bySupervisor: Summary[];
  pareto: ErrorRow[]; nonAttributable: ErrorRow[]; generatedAt: string; filters: Record<string,string> };
const labels: Record<string,string> = { OK: 'OK', CRITICAL: 'Crítica', NON_CRITICAL: 'No crítica', PENDING: 'Pendiente', UNCLASSIFIED: 'Sin clasificar', C: 'Crítico', NC: 'No crítico', X: 'No imputable' };
const date = (value: string | null) => value ? new Intl.DateTimeFormat('es-DO', { timeZone: 'America/Santo_Domingo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '';

export function populateQualityAuditWorkbook(book: ExcelJS.Workbook, data: QualityAuditReport) {
  book.creator = 'Flupy Time'; book.created = new Date(data.generatedAt);
  const filters = Object.entries(data.filters).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(' · ') || 'Todos los registros permitidos por su acceso';
  type Cell = string | number | null;
  function sheet(name: string, headings: string[], rows: Cell[][], widths: number[]) {
    const s = book.addWorksheet(name, { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:5' } });
    s.mergeCells(1,1,1,headings.length); s.getCell(1,1).value = `Flupy Time | ${name}`;
    s.getRow(1).height = 30; s.getRow(1).font = { name:'Calibri',size:18,bold:true,color:{argb:'FFFFFFFF'} }; s.getRow(1).fill = { type:'pattern',pattern:'solid',fgColor:{argb:'FF154D57'} };
    s.mergeCells(2,1,2,headings.length); s.getCell(2,1).value = `Emitido: ${date(data.generatedAt)} | Órdenes: ${data.items.length}`;
    s.mergeCells(3,1,3,headings.length); s.getCell(3,1).value = filters; s.getRow(3).height = 32; s.getRow(3).alignment = { vertical:'middle',wrapText:true };
    s.getRow(5).values = headings; s.getRow(5).height = 32;
    s.getRow(5).font = { bold:true,color:{argb:'FFFFFFFF'} }; s.getRow(5).fill = { type:'pattern',pattern:'solid',fgColor:{argb:'FF276878'} };
    s.getRow(5).alignment = { vertical:'middle',wrapText:true };
    rows.forEach((r,i) => { const row = s.addRow(r); row.font = { name:'Calibri',size:11 }; row.alignment = { vertical:'top',wrapText:true }; row.height = name === 'Auditoría de fotos' || name.includes('errores') ? 48 : 30;
      if (i%2===0) row.fill = { type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F6F7'} }; });
    widths.forEach((w,i) => { s.getColumn(i+1).width=w; });
    s.views = [{ state:'frozen',ySplit:5,xSplit:1 }];
    s.autoFilter = { from:{row:5,column:1},to:{row:Math.max(5,s.rowCount),column:headings.length} };
    s.headerFooter.oddFooter = '&LFlupy Time&C&P de &N&RCalidad interna';
    return s;
  }
  function summary(name: string, rows: Summary[]) {
    const s=sheet(name,['Grupo','Tarjeta','Muestras','OK + no imputables + FE','Críticas','No críticas','Evaluadas','Pendientes','Sin clasificar','Calidad ponderada','Meta'],
      rows.map(r=>[r.name,r.card,r.total,r.okSamples,r.criticalSamples,r.nonCriticalSamples,r.evaluatedSamples,r.pending,r.unclassified,r.compliancePercent==null?null:r.compliancePercent/100,0.96]),[32,16,14,24,14,14,14,14,16,20,12]);
    s.getColumn(10).numFmt='0.00%'; s.getColumn(11).numFmt='0%';
    rows.forEach((r,i)=>{ const cell=s.getCell(i+6,10); if(r.compliancePercent==null)cell.value='Sin muestra'; else cell.font={bold:true,color:{argb:r.compliancePercent<96?'FFC62828':'FF00796B'}}; });
  }
  summary('Por técnico',data.byTechnician); summary('Por región',data.byRegion); summary('Por supervisor',data.bySupervisor);
  sheet('Órdenes',['Fecha','Orden','Tarjeta','Técnico','Región','Supervisor','Tarjeta supervisor','Tipo de trabajo','Flujo','Decisión','Muestra','Fotos','ID'],data.items.map(o=>[date(o.date),o.order,o.card,o.technician,o.region,o.supervisor,o.supervisorCard,o.workType,o.status,o.decision,labels[o.classification]||o.classification,o.photos.length,o.id]),[22,18,14,32,16,32,18,28,18,18,20,10,38]);
  const audit=sheet('Auditoría de fotos',['Orden','Tarjeta','Técnico','Región','Supervisor','Tipo de foto','Respuesta','Comentario','Error','Descripción del error','Grupo','Tipo de error','FE técnico','Comentario FE técnico','Fecha de foto','Fecha de revisión','Revisor ID','Latitud','Longitud','Imagen','Foto ID'],data.items.flatMap(o=>o.photos.map(p=>[o.order,o.card,o.technician,o.region,o.supervisor,p.type,p.decision||'Pendiente',p.comment,p.errorCode,p.errorDescription,p.errorGroup,labels[p.errorStatus||'']||'',p.fe?'Sí':'No',p.feComment,date(p.capturedAt),date(p.reviewedAt),p.reviewerId,p.latitude,p.longitude,p.url,p.id])),[18,14,30,16,30,27,14,55,12,60,30,18,14,50,22,22,38,16,16,55,38]);
  audit.getColumn(18).numFmt='0.000000';audit.getColumn(19).numFmt='0.000000';
  const errors=sheet('Pareto de errores',['Error','Descripción','Grupo','Tipo','Ocurrencias','Órdenes distintas','Participación','Acumulado'],data.pareto.map(e=>[e.code,e.description,e.group,labels[e.status],e.occurrences,e.orders,e.percent??null,e.cumulativePercent??null]),[14,65,30,18,16,18,18,18]);
  errors.getColumn(7).numFmt='0.00%';errors.getColumn(8).numFmt='0.00%';
  const chartSheet=book.addWorksheet('Pareto gráfico', { pageSetup:{orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:1} });
  chartSheet.mergeCells('A1:L1');chartSheet.getCell('A1').value='Pareto de errores imputables';chartSheet.getCell('A1').font={bold:true,size:18,color:{argb:'FF154D57'}};
  chartSheet.mergeCells('A2:L2');chartSheet.getCell('A2').value='20 códigos principales. El acumulado usa todas las ocurrencias imputables del período.';
  chartSheet.mergeCells('A3:L3');chartSheet.getCell('A3').value=filters;chartSheet.getRow(3).alignment={wrapText:true};chartSheet.getRow(3).height=30;
  chartSheet.columns.forEach(c=>{c.width=12;});chartSheet.pageSetup.printArea='A1:L27';
  if(!data.pareto.length)chartSheet.getCell('A5').value='Sin errores imputables para estos filtros.';
  sheet('No imputables y sin clasificar',['Error','Descripción','Grupo','Tipo','Ocurrencias','Órdenes distintas'],data.nonAttributable.map(e=>[e.code,e.description,e.group,labels[e.status]||'Sin clasificar',e.occurrences,e.orders]),[20,65,30,20,16,18]);
  sheet('Metodología',['Concepto','Regla'],[
    ['Muestra','Una orden es una muestra. Prevalece el error más grave: crítico, no crítico, OK.'],
    ['Calidad ponderada','100 - (70 × muestras críticas + 30 × muestras no críticas) / muestras evaluadas. Meta: 96%.'],
    ['OK','Incluye respuestas OK, FE y errores de tipo X (no imputables).'],
    ['Sin clasificar','Errores históricos sin código no reciben una gravedad inventada. Se excluyen del porcentaje hasta clasificarse.'],
    ['Pendientes','Órdenes no enviadas o con fotos sin evaluar no entran al denominador. Sin evaluadas: Sin muestra.'],
    ['Pareto','Ocurrencias de errores imputables (C/NC), ordenadas de mayor a menor. No confundir ocurrencias con muestras.'],
    ['Histórico','Código, grupo, descripción y gravedad conservan la clasificación guardada al evaluar. Supervisor y región corresponden a la asignación actual del técnico.'],
  ],[26,120]);
  return book;
}

/** ExcelJS has no chart writer; attach a native OpenXML combo chart to its generated workbook. */
export async function qualityAuditBuffer(book: ExcelJS.Workbook, data: QualityAuditReport): Promise<ArrayBuffer> {
  const buffer=await book.xlsx.writeBuffer();
  if(!data.pareto.length)return buffer as unknown as ArrayBuffer;
  const {default:JSZip}=await import('jszip');
  const zip=await JSZip.loadAsync(buffer);
  const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const rows=data.pareto.slice(0,20), end=rows.length+5;
  const ref=(col:string)=>xml(`'Pareto de errores'!$${col}$6:$${col}$${end}`);
  const cats=`<c:strRef><c:f>${ref('A')}</c:f><c:strCache><c:ptCount val="${rows.length}"/>${rows.map((r,i)=>`<c:pt idx="${i}"><c:v>${xml(r.code)}</c:v></c:pt>`).join('')}</c:strCache></c:strRef>`;
  const nums=(col:string,values:number[],format:string)=>`<c:numRef><c:f>${ref(col)}</c:f><c:numCache><c:formatCode>${format}</c:formatCode><c:ptCount val="${values.length}"/>${values.map((v,i)=>`<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numCache></c:numRef>`;
  const chart=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:lang val="es-DO"/><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/>
    <c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Ocurrencias</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="227E91"/></a:solidFill></c:spPr><c:cat>${cats}</c:cat><c:val>${nums('E',rows.map(r=>r.occurrences),'0')}</c:val></c:ser><c:dLbls><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/></c:dLbls><c:gapWidth val="50"/><c:axId val="11"/><c:axId val="12"/></c:barChart>
    <c:lineChart><c:grouping val="standard"/><c:ser><c:idx val="1"/><c:order val="1"/><c:tx><c:v>Acumulado %</c:v></c:tx><c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="D39317"/></a:solidFill></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker><c:cat>${cats}</c:cat><c:val>${nums('H',rows.map(r=>r.cumulativePercent||0),'0%')}</c:val></c:ser><c:axId val="11"/><c:axId val="13"/></c:lineChart>
    <c:catAx><c:axId val="11"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:crossAx val="12"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>
    <c:valAx><c:axId val="12"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="0"/><c:crossAx val="11"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>
    <c:valAx><c:axId val="13"/><c:scaling><c:orientation val="minMax"/><c:max val="1"/><c:min val="0"/></c:scaling><c:axPos val="r"/><c:numFmt formatCode="0%" sourceLinked="0"/><c:crossAx val="11"/><c:crosses val="max"/><c:crossBetween val="between"/></c:valAx></c:plotArea><c:legend><c:legendPos val="b"/><c:layout/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
  zip.file('xl/charts/qualityPareto.xml',chart);
  zip.file('xl/drawings/qualityPareto.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>4</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>12</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>26</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="1" name="Pareto de errores"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rIdChart"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`);
  const relNS='http://schemas.openxmlformats.org/package/2006/relationships', docRel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  zip.file('xl/drawings/_rels/qualityPareto.xml.rels',`<Relationships xmlns="${relNS}"><Relationship Id="rIdChart" Type="${docRel}/chart" Target="../charts/qualityPareto.xml"/></Relationships>`);
  const sheetId=book.getWorksheet('Pareto gráfico')!.id;
  zip.file(`xl/worksheets/_rels/sheet${sheetId}.xml.rels`,`<Relationships xmlns="${relNS}"><Relationship Id="rIdPareto" Type="${docRel}/drawing" Target="../drawings/qualityPareto.xml"/></Relationships>`);
  const parser=new DOMParser(),serializer=new XMLSerializer();
  const sheetPath=`xl/worksheets/sheet${sheetId}.xml`;
  const sheetDoc=parser.parseFromString(await zip.file(sheetPath)!.async('string'),'application/xml');
  const drawing=sheetDoc.createElementNS(sheetDoc.documentElement.namespaceURI,'drawing');drawing.setAttributeNS(docRel,'r:id','rIdPareto');sheetDoc.documentElement.appendChild(drawing);
  zip.file(sheetPath,serializer.serializeToString(sheetDoc));
  const types=parser.parseFromString(await zip.file('[Content_Types].xml')!.async('string'),'application/xml');
  for(const [part,type] of [['/xl/charts/qualityPareto.xml','application/vnd.openxmlformats-officedocument.drawingml.chart+xml'],['/xl/drawings/qualityPareto.xml','application/vnd.openxmlformats-officedocument.drawing+xml']]) {
    const node=types.createElementNS(types.documentElement.namespaceURI,'Override');node.setAttribute('PartName',part);node.setAttribute('ContentType',type);types.documentElement.appendChild(node);
  }
  zip.file('[Content_Types].xml',serializer.serializeToString(types));
  return zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
}
