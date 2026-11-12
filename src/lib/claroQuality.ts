export type ClaroFilters = { fromDate: string; toDate: string; region: string; district: string; supervisorCard: string; technicianCard: string; process: string; project: string; product: string; technology: string; order: string; state: string; result: string };
export const emptyClaroFilters: ClaroFilters = { fromDate: "", toDate: "", region: "", district: "", supervisorCard: "", technicianCard: "", process: "", project: "", product: "", technology: "", order: "", state: "final", result: "" };
export type ClaroMetrics = { total: number; evaluated: number; ok: number; notAttributable: number; okSamples: number; critical: number; nonCritical: number; pending: number; quality: number | null; okPercent: number | null };
export type ClaroGroup = ClaroMetrics & { id: string; name: string };
export type ClaroSample = { id: string; sourceId: string; motherOrder: string; childOrder: string; sampleDate: string; district: string; region: string; process: string; project: string; product: string; technology: string; technicianName: string; technicianCard: string; supervisorName: string; supervisorCard: string; initialState: string; finalState: string | null; comment: string; errorCodes: string };
export type ClaroReport = { filters: ClaroFilters; summary: ClaroMetrics; initial: ClaroMetrics; final: ClaroMetrics; latest: ClaroMetrics & { month: string | null }; monthly: (ClaroMetrics & { month: string })[]; byRegion: ClaroGroup[]; bySupervisor: ClaroGroup[]; byTechnician: ClaroGroup[]; byProcess: ClaroGroup[]; byProject: ClaroGroup[]; byProduct: ClaroGroup[]; rows: ClaroSample[]; formula: string; dateBasis: string; generatedAt: string };
type Person = { id: string; name: string; region: string; regions?: string[] };
export type ClaroOptions = { scopedRegion: string | null; canImport: boolean; regions: string[]; districts: string[]; supervisors: Person[]; technicians: Person[]; processes: string[]; projects: string[]; products: string[]; technologies: string[] };
export type ClaroImport = { sourceFilename: string; headers: string[]; rows: { rowNumber: number; values: (string | number | boolean | null)[] }[]; requestId: string; date1904: boolean };
export type ClaroPreview = { totalRows: number; validRows: number; inserted: number; updated: number; unchanged: number; outsideRegion: number; outsideCompany: number; duplicates: number; errors: { row: number; message: string }[]; errorCount: number; canImport: boolean; preview: { sourceId: string; order: string; sampleDate: string; region: string; technicianName: string; initialState: string; finalState: string | null }[] };
export type ClaroDetail = ClaroSample & { raw: Record<string, unknown>; history: { filename: string; changedAt: string; changedBy: string }[] };
export const claroState: Record<string, string> = { OK: "OK", NOT_ATTRIBUTABLE: "No imputable", CRITICAL: "Crítica", NON_CRITICAL: "No crítica", PENDING: "Pendiente" };
export const claroProject: Record<string, string> = { INSTALACION: "Instalación", AVERIA: "Avería" };
export const claroPercent = (value: number | null) => value == null ? "Sin muestra" : `${value.toFixed(2)}%`;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

export async function readClaroWorkbook(file: File): Promise<ClaroImport> {
  if (!/\.xlsx$/i.test(file.name) || file.size > 10 * 1024 * 1024) throw new Error("Seleccione un archivo .xlsx de hasta 10 MB.");
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await file.arrayBuffer());
  for (const sheet of workbook.worksheets) {
    for (let headerRow = 1; headerRow <= Math.min(10, sheet.rowCount); headerRow++) {
      const headers = Array.from({ length: sheet.columnCount }, (_, i) => sheet.getRow(headerRow).getCell(i + 1).text.trim());
      if (!["ID", "MES", "DISTRITO", "ESTADO INICIAL"].every(key => headers.some(value => normalize(value) === key))) continue;
      if (headers.length > 100) throw new Error("El archivo excede 100 columnas.");
      const rows: ClaroImport["rows"] = [];
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= headerRow) return;
        const values = headers.map((header, i) => {
          const cell = row.getCell(i + 1);
          let value: unknown = cell.value;
          if (value && typeof value === "object" && "formula" in value) {
            value = (value as { result?: unknown }).result;
            if (value == null) throw new Error(`Fila ${rowNumber}: una fórmula no tiene resultado guardado. Abra y guarde el archivo en Excel antes de importarlo.`);
          }
          if (value instanceof Date) return value.toISOString().slice(0, 10);
          if (/^(ID|ORDEN MADRE|ORDEN HIJA|TARJETA DEL TECNICO|TARJETA DEL SUPERVISOR)$/.test(normalize(header))) return cell.text.trim();
          if (value == null) return null;
          if (["string", "number", "boolean"].includes(typeof value)) return value as string | number | boolean;
          return cell.text;
        });
        if (values.every(value => value === null || value === "")) return;
        rows.push({ rowNumber, values });
        if (rows.length > 5000) throw new Error("Cada importación admite hasta 5000 muestras.");
      });
      const result = { sourceFilename: file.name, headers, rows, requestId: crypto.randomUUID(), date1904: Boolean(workbook.properties.date1904) };
      if (new Blob([JSON.stringify(result)]).size > 11 * 1024 * 1024) throw new Error("El contenido excede el límite de importación. Divida el archivo.");
      return result;
    }
  }
  throw new Error("No se encontró el reporte detallado con Id, Mes, Distrito y Estado inicial. El reporte de avance solo sirve como referencia de resultados.");
}

export async function exportClaroReport(report: ClaroReport) {
  const ExcelJS = await import("exceljs"); const workbook = new ExcelJS.Workbook();
  workbook.creator = "Flupy Time";
  function sheet(name: string, headings: string[], rows: (string | number | null | Date)[][]) {
    const ws = workbook.addWorksheet(name); ws.addRows([headings, ...rows]);
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B66" } };
    ws.columns.forEach(column => { column.width = 27; }); ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: headings.length } }; return ws;
  }
  sheet("Alcance", ["Campo", "Valor"], [...Object.entries(report.filters), ["Fórmula", report.formula], ["Fecha", report.dateBasis], ["Generado", report.generatedAt]]);
  const headings = ["Grupo", "Muestras", "Evaluadas", "OK", "No imputables", "Muestras OK", "Críticas", "No críticas", "Pendientes", "Calidad ponderada %", "Muestras OK %"];
  const values = (name: string, m: ClaroMetrics) => [name, m.total, m.evaluated, m.ok, m.notAttributable, m.okSamples, m.critical, m.nonCritical, m.pending, m.quality, m.okPercent];
  sheet("Resumen", headings, [values("Resultado seleccionado", report.summary), values("Estado inicial", report.initial), values("Estado final", report.final)]);
  sheet("Mensual", headings, report.monthly.map(m => values(m.month, m)));
  for (const [name, rows] of [["Regiones", report.byRegion], ["Supervisores", report.bySupervisor], ["Técnicos", report.byTechnician], ["Procesos", report.byProcess], ["Proyectos", report.byProject], ["Productos", report.byProduct]] as const) sheet(name, headings, rows.map(m => values(m.name, m)));
  const detail = sheet("Muestras", ["Id Claro", "Orden madre", "Orden hija", "Fecha Mes", "Distrito", "Región", "Supervisor", "Tarjeta supervisor", "Técnico", "Tarjeta técnico", "Proceso", "Proyecto", "Producto", "Tecnología", "Estado inicial", "Estado final", "Comentario", "Códigos de error"],
    report.rows.map(r => [r.sourceId, r.motherOrder, r.childOrder, new Date(r.sampleDate + "T00:00:00Z"), r.district, r.region, r.supervisorName, r.supervisorCard, r.technicianName, r.technicianCard, r.process, claroProject[r.project] || r.project, r.product, r.technology, claroState[r.initialState], claroState[r.finalState || "PENDING"], r.comment, r.errorCodes]));
  detail.getColumn(4).numFmt = "dd/mm/yyyy";
  const data = await workbook.xlsx.writeBuffer(); const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `Calidad-Claro-${report.filters.fromDate || "inicio"}-${report.filters.toDate || "fin"}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
