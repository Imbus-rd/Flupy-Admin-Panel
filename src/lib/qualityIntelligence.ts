export type IntelligenceFilters = { fromDate: string; toDate: string; companyId: string; region: string; officeId: string; supervisorId: string; technicianId: string; auditorId: string; workType: string };
export type IntelligenceTotals = {
  qrOnline: { total: number; completed: number; inProgress: number; cancelled: number; accompaniments: number; evaluated: number; unratedCompleted: number; withFindings: number; withoutFindings: number; ratingSum: number; ratingCount: number; averageRating: number | null; findingPercent: number | null; groups: { key: string; label: string; evaluated: number; ratingSum: number; averageRating: number | null; withFindings: number }[] };
  orders: { registered: number; applicable: number; unknownCatalog: number; complete: number; incomplete: number; completePercent: number | null; incompletePercent: number | null; approved: number; rejected: number; fe: number; evaluated: number; pending: number; approvalPercent: number | null; errorPhotos: number };
  qr: { total: number; online: number; offline: number; validated: number; cancelled: number; ok: number; critical: number; evaluated: number; pending: number; compliancePercent: number | null; errorPhotos: number };
  wifi: { applicable: number; completed: number; pending: number; approved: number; rejected: number; awaitingReview: number; completionPercent: number | null; approvalPercent: number | null };
  adoption: { eligible: number; registered: number; complete: number; incomplete: number; withoutRecords: number; percent: number | null };
};
export type IntelligencePerson = IntelligenceTotals & { id: string; name: string; card: string };
export type UsageTotals = { active: number; technicians: number; withPunch: number; withPhotos: number; both: number; onlyPunch: number; onlyPhotos: number; any: number; withoutActivity: number; punchPercent: number | null; photoPercent: number | null; bothPercent: number | null; anyPercent: number | null };
export type UsageEmployee = { id: string; name: string; card: string; role: string; isSupervisor: boolean; region: string; officeName: string; supervisorId: string; supervisorName: string; createdDate: string | null; punchDays: number; lastPunchAt: string | null; photoCount: number; photoOrders: number; photoDays: number; lastPhotoAt: string | null; status: string };
export type IntelligenceUsage = { summary: UsageTotals; previous: UsageTotals; monthly: (UsageTotals & { month: string })[]; bySupervisor: (UsageTotals & { id: string; name: string })[]; employees: UsageEmployee[]; limitations: string[] };
export type IntelligenceFact = { id: string; label: string; numerator: number; denominator: number; value: number | null; unit?: "RATING" };
export type IntelligenceRecommendation = { id: string; title: string; evidenceIds: string[]; action: string; owner: string; priority: string; probableCause: string; timeframe: string; followUp: string };
export type IntelligenceAnalysis = { executiveSummary: string; engine: string; model: string; snapshotId: string; generatedAt: string; limitations: string[]; findings: (Omit<IntelligenceRecommendation, "id"> & { analysis: string; kpi: string; target: string })[] };
export type IntelligenceReport = {
  usage?: IntelligenceUsage;
  generatedAt: string; snapshotId: string; companyName: string; filters: IntelligenceFilters & { previousFrom: string; previousTo: string };
  summary: IntelligenceTotals; previous: IntelligenceTotals; monthly: (IntelligenceTotals & { month: string })[];
  bySupervisor: IntelligencePerson[]; byTechnician: IntelligencePerson[]; byAuditor: IntelligencePerson[];
  findings: { source: string; type: string; label: string; photos: number; orders: number; supervisors: number }[];
  missingPhotos: { type: string; label: string; orders: number }[];
  incompleteOrders: { id: string; orderNumber: string; technicianName: string; technicianCard: string; supervisorName: string; workType: string; date: string; missing: string[]; required: number }[];
  onlineInspections: { id: string; accompanimentId: string; orderNumber: string; date: string; status: string; technicianName: string; technicianCard: string; supervisorName: string; auditorName: string; averageRating: number | null; hasFindings: boolean; missingTools: number; groups: { key: string; label: string; rating: number; comment: string; scored: boolean; failedCriteria: string[] }[] }[];
  facts: IntelligenceFact[]; recommendations: IntelligenceRecommendation[]; limitations: string[]; duplicateOrderRows: number;
  effectiveness: { value: null; status: string }; ai: { configured: boolean; model: string | null; canGenerate: boolean };
};
type Option = { id: string; name: string; card?: string };
export type IntelligenceOptions = { company: Option; scopedRegion: string | null; regions: string[]; offices: Option[]; supervisors: Option[]; technicians: Option[]; employees?: Option[]; auditors: Option[]; workTypes: { id: string; label: string }[]; ai: { configured: boolean; canGenerate: boolean } };

export const displayPercent = (value: number | null | undefined) => value == null ? "Sin muestra" : `${value.toFixed(2)}%`;
export const displayRating = (value: number | null | undefined) => value == null ? "Sin muestra" : `${value.toFixed(2)} / 5`;
export const displayFact = (fact: IntelligenceFact) => fact.unit === "RATING" ? displayRating(fact.value) : displayPercent(fact.value);
export const usageStatus: Record<string, string> = { BOTH: "Poncha y carga fotos", PUNCH_ONLY: "Solo poncha", PHOTOS_ONLY: "Solo carga fotos", NO_ACTIVITY: "Sin actividad registrada" };
export const usageRole: Record<string, string> = { EMPLOYEE: "Empleado", SUPERVISOR: "Supervisor", ADMIN: "Administrador", INSPECTOR: "Inspector", WAREHOUSE: "Almacén" };
const usageHeadings = ["Empleado", "Tarjeta", "Rol", "Región", "Localidad", "Supervisor", "Fecha de creación", "Días con entrada", "Última entrada UTC", "Órdenes con carga", "Fotos cargadas", "Días con fotos", "Última carga UTC", "Uso registrado"];
const usageValues = (rows: UsageEmployee[]) => rows.map(e => [e.name, e.card, e.isSupervisor ? "Supervisor" : usageRole[e.role] || e.role, e.region, e.officeName, e.supervisorName, e.createdDate, e.punchDays, e.lastPunchAt, e.photoOrders, e.photoCount, e.photoDays, e.lastPhotoAt, usageStatus[e.status] || e.status]);

export async function exportUsageList(report: IntelligenceReport, rows: UsageEmployee[], state: string, role: string) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const scope = workbook.addWorksheet("Filtros");
  scope.addRows([["Empresa", report.companyName], ...Object.entries(report.filters), ["Estado de uso", state || "Todos"], ["Rol", role || "Todos"], ["Generado", report.generatedAt], ...(report.usage?.limitations || []).map(value => ["Alcance", value])]);
  scope.columns = [{ width: 28 }, { width: 100 }];
  const sheet = workbook.addWorksheet("Uso empleados");
  sheet.addRows([usageHeadings, ...usageValues(rows)]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach(c => { c.width = 28; });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: usageHeadings.length } };
  await downloadWorkbook(workbook, `Flupy-Uso-${report.filters.fromDate}-${report.filters.toDate}.xlsx`);
}

export async function exportIntelligence(report: IntelligenceReport, analysis: IntelligenceAnalysis | null) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Flupy Time";
  const sheet = (name: string, headings: string[], rows: (string | number | null)[][]) => {
    const ws = workbook.addWorksheet(name);
    ws.addRow(headings);
    rows.forEach(row => ws.addRow(row));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B66" } };
    ws.columns.forEach(column => { column.width = 27; });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headings.length } };
  };
  sheet("Alcance", ["Campo", "Valor"], [["Empresa", report.companyName], ...Object.entries(report.filters), ["Generado", report.generatedAt], ["Identificador de datos", report.snapshotId], ...report.limitations.map(value => ["Limitación", value])]);
  sheet("Indicadores", ["Indicador", "Numerador", "Universo", "Valor", "Unidad"], report.facts.map(f => [f.label, f.numerator, f.denominator, f.value, f.unit === "RATING" ? "Valoración de 1 a 5" : "Porcentaje"]));
  if (report.usage) {
    sheet("Uso empleados", usageHeadings, usageValues(report.usage.employees));
    const headings = ["Grupo", "Activos", "Con entrada", "Con fotos", "Ambas funciones", "Solo entrada", "Solo fotos", "Sin actividad", "Entrada %", "Fotos %", "Algún uso %"];
    const values = (name: string, s: UsageTotals) => [name, s.active, s.withPunch, s.withPhotos, s.both, s.onlyPunch, s.onlyPhotos, s.withoutActivity, s.punchPercent, s.photoPercent, s.anyPercent];
    sheet("Uso supervisores", headings, report.usage.bySupervisor.map(s => values(s.name, s)));
    sheet("Uso mensual", headings, report.usage.monthly.map(s => values(s.month, s)));
  }
  for (const [title, people] of [["Supervisores", report.bySupervisor], ["Técnicos", report.byTechnician], ["Auditores", report.byAuditor]] as const) {
    sheet(title, ["Nombre", "Tarjeta", "Órdenes", "OK", "ERROR", "FE", "Evaluadas", "Aprobación %", "Completas", "Incompletas", "Completitud %", "QR Online total", "Acompañamientos", "QR Online evaluadas", "Valoración Online / 5", "Grupos Online evaluados", "Online con hallazgos", "QR Offline OK", "QR Offline críticas", "QR Offline evaluadas", "QR Offline %", "Elegibles", "Con orden completa", "Sin registros", "Adopción %", "WiFi aplicables", "WiFi realizadas", "WiFi pendientes", "WiFi realización %", "WiFi aprobadas", "WiFi rechazadas"],
      people.map(p => [p.name, p.card, p.orders.registered, p.orders.approved, p.orders.rejected, p.orders.fe, p.orders.evaluated, p.orders.approvalPercent, p.orders.complete, p.orders.incomplete, p.orders.completePercent, p.qrOnline.total, p.qrOnline.accompaniments, p.qrOnline.evaluated, p.qrOnline.averageRating, p.qrOnline.ratingCount, p.qrOnline.withFindings, p.qr.ok, p.qr.critical, p.qr.evaluated, p.qr.compliancePercent, p.adoption.eligible, p.adoption.complete, p.adoption.withoutRecords, p.adoption.percent, p.wifi.applicable, p.wifi.completed, p.wifi.pending, p.wifi.completionPercent, p.wifi.approved, p.wifi.rejected]));
  }
  sheet("Evolución", ["Mes", "Órdenes evaluadas", "Aprobación %", "Órdenes aplicables", "Completas", "Completitud %", "QR Online evaluadas", "Valoración Online / 5", "QR Offline evaluadas", "QR Offline %", "WiFi aplicables", "WiFi %"], report.monthly.map(m => [m.month, m.orders.evaluated, m.orders.approvalPercent, m.orders.applicable, m.orders.complete, m.orders.completePercent, m.qrOnline.evaluated, m.qrOnline.averageRating, m.qr.evaluated, m.qr.compliancePercent, m.wifi.applicable, m.wifi.completionPercent]));
  sheet("QR Online grupos", ["Grupo", "Evaluaciones únicas", "Valoración / 5", "Con hallazgos"], report.summary.qrOnline.groups.map(g => [g.label, g.evaluated, g.averageRating, g.withFindings]));
  sheet("QR Online órdenes", ["Orden", "Fecha", "Técnico", "Tarjeta", "Supervisor", "Auditor", "Estado", "Valoración / 5", "Con hallazgos", "Herramientas requeridas faltantes"], report.onlineInspections.map(i => [i.orderNumber, i.date, i.technicianName, i.technicianCard, i.supervisorName, i.auditorName, i.status, i.averageRating, i.hasFindings ? "Sí" : "No", i.missingTools]));
  sheet("QR Online comentarios", ["Orden", "Grupo", "Valoración / 5", "Puntuable", "Comentario", "Criterios no cumplidos"], report.onlineInspections.flatMap(i => i.groups.map(g => [i.orderNumber, g.label, g.rating, g.scored ? "Sí" : "No", g.comment, g.failedCriteria.join(", ")])));
  sheet("Hallazgos", ["Origen", "Evidencia", "Órdenes", "Fotos ERROR", "Supervisores"], report.findings.map(f => [f.source, f.label, f.orders, f.photos, f.supervisors]));
  sheet("Órdenes incompletas", ["Orden", "Fecha", "Técnico", "Tarjeta", "Supervisor", "Tipo de trabajo", "Fotos requeridas", "Evidencias faltantes"], report.incompleteOrders.map(o => [o.orderNumber, o.date, o.technicianName, o.technicianCard, o.supervisorName, o.workType, o.required, o.missing.join(", ")]));
  sheet("Recomendaciones", ["Hallazgo", "Evidencia", "Acción", "Responsable sugerido", "Prioridad", "Causa probable", "Plazo sugerido", "Seguimiento"], report.recommendations.map(r => [r.title, r.evidenceIds.join(", "), r.action, r.owner, r.priority, r.probableCause, r.timeframe, r.followUp]));
  if (analysis) sheet("Análisis IA", ["Tipo", "Contenido"], [["Modelo", analysis.model], ["Resumen", analysis.executiveSummary], ...analysis.findings.map(f => [f.title, `${f.analysis}\nEvidencia: ${f.evidenceIds.join(", ")}\nAcción: ${f.action}\nResponsable: ${f.owner}\nMeta propuesta: ${f.target}\nSeguimiento: ${f.followUp}`])]);
  await downloadWorkbook(workbook, `Flupy-Analisis-${report.filters.fromDate}-${report.filters.toDate}.xlsx`);
}

async function downloadWorkbook(workbook: import("exceljs").Workbook, filename: string) {
  const data = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
