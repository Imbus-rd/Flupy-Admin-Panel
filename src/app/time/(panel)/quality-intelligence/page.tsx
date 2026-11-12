"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrainCircuit, CheckCheck, ChevronLeft, ChevronRight, Download, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { QualityUsageAnalysis } from "@/components/QualityUsageAnalysis";
import { QualityOnlineAnalysis } from "@/components/QualityOnlineAnalysis";
import { CalendarDateField } from "@/components/CalendarDateField";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { displayRating, displayFact, displayPercent as pct, exportIntelligence, type IntelligenceAnalysis, type IntelligenceFilters, type IntelligenceOptions, type IntelligencePerson, type IntelligenceReport } from "@/lib/qualityIntelligence";

const empty: IntelligenceFilters = { fromDate: "", toDate: "", companyId: "", region: "", officeId: "", supervisorId: "", technicianId: "", auditorId: "", workType: "" };
const input = "h-11 w-full min-w-0 rounded-lg border border-white/10 bg-[#080d15] px-3 text-sm text-white focus:border-teal-400 focus:outline-none";
const command = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-medium hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";
type Tab = "overview" | "usage" | "online" | "supervisors" | "technicians" | "auditors" | "incomplete" | "diagnosis";
const tabs: [Tab, string][] = [["overview", "Resumen"], ["usage", "Uso de la app"], ["online", "QR Online"], ["supervisors", "Supervisores"], ["technicians", "Técnicos"], ["auditors", "Auditores"], ["incomplete", "Órdenes incompletas"], ["diagnosis", "Diagnóstico y acciones"]];
const formatTime = (value: string) => new Intl.DateTimeFormat("es-DO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santo_Domingo" }).format(new Date(value));
const explainError = (err: unknown) => err instanceof ApiError ? err.status === 404 ? "La versión del backend aún no incluye el análisis ampliado." : err.message : "No fue posible completar la operación. Revise la conexión.";

function Rate({ value, numerator, denominator }: { value: number | null; numerator: number; denominator: number }) {
  return <span className="whitespace-nowrap tabular-nums" title={`${numerator} de ${denominator}`}><span className={value == null ? "text-slate-500" : "text-teal-300"}>{pct(value)}</span><span className="ml-2 text-xs text-slate-500">{numerator}/{denominator}</span></span>;
}

function Pager({ page, count, onChange }: { page: number; count: number; onChange: (value: number) => void }) {
  return <div className="flex items-center justify-end gap-3 py-3"><button className={command} title="Página anterior" aria-label="Página anterior" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></button><span className="text-xs text-slate-400">{page + 1} / {Math.max(1, count)}</span><button className={command} title="Página siguiente" aria-label="Página siguiente" disabled={page >= count - 1} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></button></div>;
}

function PeopleTable({ rows, auditors }: { rows: IntelligencePerson[]; auditors: boolean }) {
  const [page, setPage] = useState(0);
  const count = Math.max(1, Math.ceil(rows.length / 25));
  const current = Math.min(page, count - 1);
  return <div className="min-w-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-white/10 text-xs uppercase text-slate-400"><tr>{[auditors ? "Auditor / revisor" : "Nombre", "Órdenes", "Aprobación", "Fotos completas", "QR Online / 5", "QR Offline", ...(auditors ? [] : ["Adopción"]), "WiFi realizado"].map(label => <th key={label} className="whitespace-nowrap px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{rows.slice(current * 25, (current + 1) * 25).map(row => <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.025]"><td className="min-w-44 px-3 py-4"><div className="font-medium">{row.name}</div><div className="text-xs text-slate-500">{row.card || "Sin tarjeta"}</div></td><td className="px-3 py-4 tabular-nums">{row.orders.registered}</td><td className="px-3 py-4"><Rate value={row.orders.approvalPercent} numerator={row.orders.approved} denominator={row.orders.evaluated} /></td><td className="px-3 py-4"><Rate value={row.orders.completePercent} numerator={row.orders.complete} denominator={row.orders.applicable} /></td><td className="px-3 py-4"><span className="whitespace-nowrap text-sky-200">{displayRating(row.qrOnline.averageRating)}</span><div className="mt-1 whitespace-nowrap text-xs text-slate-500">{row.qrOnline.evaluated} evaluadas · {row.qrOnline.withFindings} con hallazgos</div></td><td className="px-3 py-4"><Rate value={row.qr.compliancePercent} numerator={row.qr.ok} denominator={row.qr.evaluated} /></td>{!auditors && <td className="px-3 py-4"><Rate value={row.adoption.percent} numerator={row.adoption.complete} denominator={row.adoption.eligible} /></td>}<td className="px-3 py-4"><Rate value={row.wifi.completionPercent} numerator={row.wifi.completed} denominator={row.wifi.applicable} /></td></tr>)}</tbody></table></div>{!rows.length && <p className="py-8 text-center text-slate-400">Sin registros para estos filtros.</p>}<div className="flex items-center justify-between"><span className="text-xs text-slate-500">{rows.length} registros</span><Pager page={current} count={count} onChange={setPage} /></div></div>;
}

function CountList({ rows }: { rows: (string | number)[][] }) {
  return <dl className="mt-3 text-sm">{rows.map(([label, value]) => <div className="flex justify-between gap-3 border-b border-white/5 py-3" key={label}><dt className="text-slate-400">{label}</dt><dd className="tabular-nums">{value}</dd></div>)}</dl>;
}

export default function QualityIntelligencePage() {
  const { token } = useAuth();
  const [filters, setFilters] = useState<IntelligenceFilters>(empty);
  const [applied, setApplied] = useState<IntelligenceFilters>(empty);
  const [options, setOptions] = useState<IntelligenceOptions | null>(null);
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [analysis, setAnalysis] = useState<IntelligenceAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [incompletePage, setIncompletePage] = useState(0);
  const request = useRef(0);
  const dirty = JSON.stringify(filters) !== JSON.stringify(applied);

  const load = useCallback(async (values: IntelligenceFilters) => {
    if (!token) return;
    const id = ++request.current;
    setBusy(true); setMessage(null); setAnalysis(null);
    const query = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => { if (value) query.set(key, value); });
    try {
      const next = await apiFetch<IntelligenceReport>(`/quality-intelligence/report?${query}`, { token });
      if (request.current !== id) return;
      const normalized = Object.fromEntries(Object.keys(empty).map(key => [key, next.filters[key as keyof IntelligenceFilters] || ""])) as IntelligenceFilters;
      setReport(next); setFilters(normalized); setApplied(normalized); setIncompletePage(0);
    } catch (err) { if (request.current === id) { setReport(null); setMessage(explainError(err)); } }
    finally { if (request.current === id) setBusy(false); }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setReport(null); setAnalysis(null); setOptions(null);
    apiFetch<IntelligenceOptions>("/quality-intelligence/options", { token }).then(value => { if (alive) setOptions(value); }).catch(err => { if (alive) setMessage(explainError(err)); });
    void load(empty);
    return () => { alive = false; request.current += 1; };
  }, [token, load]);

  async function generate() {
    if (!report || !token || busy || dirty) return;
    const id = request.current;
    setAnalyzing(true); setMessage(null);
    try {
      const result = await apiFetch<IntelligenceAnalysis>("/quality-intelligence/analysis", { token, method: "POST", body: JSON.stringify({ filters: applied, snapshotId: report.snapshotId }) });
      if (id === request.current) { setAnalysis(result); setTab("diagnosis"); }
    } catch (err) { if (id === request.current) setMessage(explainError(err)); }
    finally { setAnalyzing(false); }
  }
  async function download() {
    if (!report) return;
    setExporting(true);
    try { await exportIntelligence(report, analysis); } catch { setMessage("No fue posible generar el archivo Excel."); } finally { setExporting(false); }
  }
  const set = (key: keyof IntelligenceFilters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  const s = report?.summary;
  const kpis: { label: string; value: number | null; before: number | null; count: string; color: string; rating?: boolean }[] = report ? [
    { label: "QR Online", value: s!.qrOnline.averageRating, before: report.previous.qrOnline.averageRating, count: `${s!.qrOnline.evaluated} evaluadas · ${s!.qrOnline.withFindings} con hallazgos`, color: "text-sky-300", rating: true },
    { label: "Aprobación de órdenes", value: s!.orders.approvalPercent, before: report.previous.orders.approvalPercent, count: `${s!.orders.approved} OK / ${s!.orders.evaluated} evaluadas`, color: "text-teal-300" },
    { label: "Fotos completas", value: s!.orders.completePercent, before: report.previous.orders.completePercent, count: `${s!.orders.complete} / ${s!.orders.applicable} órdenes`, color: "text-sky-300" },
    { label: "QR Offline", value: s!.qr.compliancePercent, before: report.previous.qr.compliancePercent, count: `${s!.qr.ok} OK / ${s!.qr.evaluated} muestras`, color: "text-teal-300" },
    { label: "Técnicos con orden completa", value: s!.adoption.percent, before: report.previous.adoption.percent, count: `${s!.adoption.complete} / ${s!.adoption.eligible} elegibles`, color: "text-amber-300" },
    { label: "WiFi realizado", value: s!.wifi.completionPercent, before: report.previous.wifi.completionPercent, count: `${s!.wifi.completed} / ${s!.wifi.applicable} aplicables`, color: "text-sky-300" },
    { label: "WiFi aprobado", value: s!.wifi.approvalPercent, before: report.previous.wifi.approvalPercent, count: `${s!.wifi.approved} / ${s!.wifi.approved + s!.wifi.rejected} revisadas`, color: "text-teal-300" }
  ] : [];

  return <div className="min-w-0 space-y-6 pb-8" aria-busy={busy}>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">Análisis Inteligente de Calidad</h1><p className="mt-1 text-sm text-slate-400">{options?.company.name || report?.companyName || "Flupy Time"}{options?.scopedRegion ? ` · ${options.scopedRegion}` : ""}</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => void load(applied)} disabled={busy || analyzing} className={command} title="Actualizar los datos aplicados"><RefreshCw size={16} className={busy ? "animate-spin" : ""} />Actualizar</button><button onClick={() => void download()} disabled={!report || busy || exporting} className={command}><Download size={16} />{exporting ? "Exportando..." : "Exportar Excel"}</button><button onClick={() => void generate()} disabled={!report || busy || analyzing || dirty || !report.ai.configured || !report.ai.canGenerate} title={!report?.ai.configured ? "IA pendiente de configuración" : !report.ai.canGenerate ? "Acceso no permitido para este usuario" : "Generar informe con los indicadores aplicados"} className={`${command} border-teal-400/30 bg-teal-400 text-slate-950 hover:bg-teal-300`}><BrainCircuit size={17} />{analyzing ? "Analizando..." : "Generar análisis con IA"}</button></div></header>

    <form className="grid gap-3 border-y border-white/10 py-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={event => { event.preventDefault(); void load(filters); }}>
      <CalendarDateField id="intelligence-from" label="Desde fecha" value={filters.fromDate} onChange={value => set("fromDate", value)} openLabel="Abrir calendario" />
      <CalendarDateField id="intelligence-to" label="Hasta fecha" value={filters.toDate} onChange={value => set("toDate", value)} openLabel="Abrir calendario" />
      <label className="min-w-0 space-y-1 text-xs text-slate-400">Región<select aria-label="Región" className={input} value={filters.region} onChange={event => set("region", event.target.value)}><option value="">{options?.scopedRegion || "Todas las regiones"}</option>{options?.regions.map(value => <option key={value}>{value}</option>)}</select></label>
      {([['officeId', 'Localidad', options?.offices], ['supervisorId', 'Supervisor', options?.supervisors], ['technicianId', 'Técnico / empleado', options?.employees || options?.technicians], ['auditorId', 'Auditor / revisor', options?.auditors]] as const).map(([key, label, values]) => <label key={key} className="min-w-0 space-y-1 text-xs text-slate-400">{label}<select aria-label={label} className={input} value={filters[key]} onChange={event => set(key, event.target.value)}><option value="">Todos</option>{values?.map(value => <option key={value.id} value={value.id}>{value.name}{value.card ? ` · ${value.card}` : ""}</option>)}</select></label>)}
      <label className="min-w-0 space-y-1 text-xs text-slate-400">Tipo de trabajo<select aria-label="Tipo de trabajo" className={input} value={filters.workType} onChange={event => set("workType", event.target.value)}><option value="">Todos los tipos</option>{options?.workTypes.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 xl:col-span-4"><button type="submit" disabled={busy || analyzing} className={`${command} bg-teal-500/15 text-teal-200`}><SlidersHorizontal size={16} />Aplicar filtros</button><button type="button" onClick={() => void load(empty)} disabled={busy || analyzing} className={command}>Limpiar</button><span className="text-xs text-amber-300" role="status">{dirty ? "Cambios sin aplicar" : ""}</span><span className="ml-auto text-xs text-slate-500">{report ? `Actualizado ${formatTime(report.generatedAt)}` : busy ? "Consultando..." : ""}</span></div>
    </form>
    {message && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{message}</p>}
    {busy && <div className="h-1 animate-pulse bg-teal-400/40" role="progressbar" aria-label="Cargando análisis" />}
    {report && s && <>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400"><span>{report.filters.fromDate} al {report.filters.toDate}</span><span className="text-slate-600">|</span><span>Comparación: {report.filters.previousFrom} al {report.filters.previousTo}</span><span className="ml-auto rounded border border-white/10 px-2 py-1">{report.ai.configured ? `IA disponible · ${report.ai.model}` : "Diagnóstico por reglas · IA sin configurar"}</span></div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Indicadores generales">{kpis.map(kpi => <article className="min-w-0 rounded-lg border border-white/10 bg-white/[0.025] p-4" key={kpi.label}><h2 className="text-xs text-slate-400">{kpi.label}</h2><p className={`mt-2 text-2xl font-semibold tabular-nums ${kpi.value == null ? "text-slate-500" : kpi.color}`}>{kpi.rating ? displayRating(kpi.value) : pct(kpi.value)}</p><p className="mt-1 text-xs text-slate-400">{kpi.count}</p><p className="mt-3 text-xs text-slate-500">{kpi.value == null || kpi.before == null ? "Sin comparación" : `${kpi.value - kpi.before >= 0 ? "+" : ""}${(kpi.value - kpi.before).toFixed(2)} ${kpi.rating ? "puntos" : "pp"} vs. anterior`}</p></article>)}</section>
      <nav className="flex gap-1 overflow-x-auto border-b border-white/10" role="tablist" aria-label="Vistas del análisis">{tabs.map(([value, title]) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm ${tab === value ? "border-teal-400 text-teal-200" : "border-transparent text-slate-400 hover:text-white"}`}>{title}{value === "incomplete" && report.incompleteOrders.length > 0 ? ` (${report.incompleteOrders.length})` : ""}</button>)}</nav>

      {tab === "overview" && <div className="space-y-7">
        {report.usage && <section className="flex flex-wrap items-center justify-between gap-4 border-y border-white/10 py-4"><div><h2 className="font-semibold">Uso registrado de la aplicación</h2><p className="mt-2 text-sm text-slate-400">{report.usage.summary.active} empleados activos · {report.usage.summary.withPunch} con entrada · {report.usage.summary.withPhotos} con fotos · {report.usage.summary.both} usan ambas · {report.usage.summary.withoutActivity} sin actividad registrada</p></div><button className={command} onClick={() => setTab("usage")}>Ver empleados</button></section>}
        <section className="grid gap-6 xl:grid-cols-2"><div className="min-w-0"><h2 className="mb-4 font-semibold">Evolución mensual</h2><div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-400"><span className="text-teal-300">Aprobación</span><span className="text-sky-300">Completitud</span><span className="text-amber-300">QR Offline</span></div>{report.monthly.map(month => <div key={month.month} className="grid grid-cols-[4rem_1fr] gap-3 border-t border-white/5 py-3"><span className="text-xs text-slate-400">{month.month}</span><div className="space-y-2">{[["Aprobación", month.orders.approvalPercent, "bg-teal-400"], ["Completitud", month.orders.completePercent, "bg-sky-400"], ["QR Offline", month.qr.compliancePercent, "bg-amber-400"]].map(([label, value, color]) => <div key={String(label)} className="flex items-center gap-3" title={`${label}: ${pct(value as number | null)}`}><div className="h-2 flex-1 overflow-hidden rounded-sm bg-white/5"><div className={`h-full ${color}`} style={{ width: `${typeof value === "number" ? value : 0}%` }} /></div><span className="w-24 text-right text-xs tabular-nums text-slate-400">{pct(value as number | null)}</span></div>)}</div></div>)}</div>
        <div className="min-w-0"><h2 className="mb-4 font-semibold">Carga y revisión de órdenes</h2><div className="flex h-5 overflow-hidden rounded-sm bg-white/5" role="img" aria-label={`${s.orders.complete} completas, ${s.orders.incomplete} incompletas, ${s.orders.unknownCatalog} sin catálogo`}>{[[s.orders.complete, "bg-teal-400"], [s.orders.incomplete, "bg-amber-400"], [s.orders.unknownCatalog, "bg-slate-500"]].map(([value, color]) => <div key={String(color)} className={String(color)} style={{ width: `${s.orders.registered ? Number(value) * 100 / s.orders.registered : 0}%` }} />)}</div><CountList rows={[["Registradas", s.orders.registered], ["Completas", s.orders.complete], ["Incompletas", s.orders.incomplete], ["Catálogo desconocido", s.orders.unknownCatalog], ["Evaluadas OK / ERROR", s.orders.evaluated], ["FE", s.orders.fe], ["Pendientes", s.orders.pending], ["Fotos ERROR", s.orders.errorPhotos]]} /><h3 className="mt-6 text-sm font-medium">Universo de adopción</h3><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400"><span>{s.adoption.eligible} elegibles</span><span>{s.adoption.registered} con registros</span><span>{s.adoption.withoutRecords} sin registros</span></div></div></section>
        <section className="grid gap-6 border-t border-white/10 pt-6 xl:grid-cols-2"><div><h2 className="font-semibold">Evidencias con ERROR más frecuentes</h2>{!report.findings.length ? <p className="py-6 text-sm text-slate-400">Sin hallazgos ERROR registrados.</p> : <ol className="mt-3 divide-y divide-white/5">{report.findings.slice(0, 8).map((finding, index) => <li key={`${finding.source}:${finding.type}`} className="flex items-start justify-between gap-3 py-3 text-sm"><div><span className="mr-2 text-slate-500">{index + 1}.</span>{finding.label}<div className="mt-1 text-xs text-slate-500">{finding.source === "QUALITY" ? "Calidad" : "QR Offline"} · {finding.photos} fotos · {finding.supervisors} supervisores</div></div><span className="whitespace-nowrap text-rose-300">{finding.orders} órdenes</span></li>)}</ol>}</div><div><h2 className="font-semibold">Asesorías WiFi</h2><CountList rows={[["Aplicables", s.wifi.applicable], ["Realizadas", s.wifi.completed], ["Pendientes", s.wifi.pending], ["Esperando revisión", s.wifi.awaitingReview], ["Aprobadas", s.wifi.approved], ["Rechazadas", s.wifi.rejected]]} /></div></section>
      </div>}
      {tab === "usage" && <QualityUsageAnalysis key={report.snapshotId} report={report} />}
      {tab === "online" && <QualityOnlineAnalysis key={report.snapshotId} report={report} />}
      {(tab === "supervisors" || tab === "technicians" || tab === "auditors") && <PeopleTable key={tab + report.snapshotId} rows={tab === "supervisors" ? report.bySupervisor : tab === "technicians" ? report.byTechnician : report.byAuditor} auditors={tab === "auditors"} />}
      {tab === "incomplete" && <section><div className="flex items-center justify-between"><h2 className="font-semibold">Órdenes con fotos obligatorias pendientes</h2><span className="text-sm text-slate-400">{report.incompleteOrders.length} órdenes</span></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-white/10 text-xs uppercase text-slate-400"><tr>{["Orden", "Fecha", "Técnico", "Supervisor", "Evidencias faltantes"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{report.incompleteOrders.slice(incompletePage * 25, (incompletePage + 1) * 25).map(order => <tr key={order.id} className="border-b border-white/5"><td className="p-3 font-medium text-teal-300">{order.orderNumber}</td><td className="whitespace-nowrap p-3 text-slate-400">{order.date}</td><td className="p-3">{order.technicianName}<div className="text-xs text-slate-500">{order.technicianCard}</div></td><td className="p-3 text-slate-400">{order.supervisorName || "Sin asignar"}</td><td className="max-w-md p-3 text-xs text-amber-200">{order.missing.map(type => report.missingPhotos.find(photo => photo.type === type)?.label || type).join(" · ")}</td></tr>)}</tbody></table></div>{!report.incompleteOrders.length && <p className="flex items-center justify-center gap-2 py-10 text-slate-400"><CheckCheck size={20} />Sin órdenes incompletas en este período.</p>}<Pager page={incompletePage} count={Math.ceil(report.incompleteOrders.length / 25)} onChange={setIncompletePage} /></section>}
      {tab === "diagnosis" && <section className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{analysis ? "Informe generado con IA" : "Diagnóstico operativo"}</h2><span className="rounded border border-white/10 px-2 py-1 text-xs text-slate-400">{analysis ? `${analysis.model} · ${formatTime(analysis.generatedAt)}` : "Reglas verificables"}</span></div>{analysis && <p className="max-w-5xl whitespace-pre-line text-sm leading-7 text-slate-200">{analysis.executiveSummary}</p>}{!analysis && <p className="text-sm text-slate-400">{s.orders.registered} órdenes registradas; {s.orders.complete} completas y {s.orders.incomplete} incompletas. QR Offline: {s.qr.evaluated} muestras evaluadas y {s.qr.pending} pendientes. QR Online: {s.qrOnline.evaluated} inspecciones evaluadas, valoración {displayRating(s.qrOnline.averageRating)}.</p>}<div className="divide-y divide-white/10">{(analysis ? analysis.findings : report.recommendations).map((finding, index) => <article className="py-5" key={index}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{index + 1}. {finding.title}</h3><span className="text-xs text-amber-300">Prioridad {finding.priority.toLowerCase()}</span></div>{"analysis" in finding && <p className="mt-2 text-sm text-slate-300">{finding.analysis}</p>}<div className="mt-3 flex flex-wrap gap-2">{finding.evidenceIds.map(id => { const fact = report.facts.find(value => value.id === id); return fact && <span key={id} className="rounded border border-sky-400/20 bg-sky-400/5 px-2 py-1 text-xs text-sky-200">{fact.label}: {displayFact(fact)} ({fact.numerator}/{fact.denominator})</span>; })}</div><dl className="mt-3 grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">{[["Acción propuesta", finding.action], ["Responsable sugerido", finding.owner], ["Causa probable", finding.probableCause], ["Plazo sugerido", finding.timeframe], ["Seguimiento", finding.followUp], ...("target" in finding ? [["Meta propuesta para aprobación", finding.target]] : [])].map(([label, value]) => <div key={String(label)}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-slate-300">{value}</dd></div>)}</dl></article>)}</div>{!analysis && !report.recommendations.length && <p className="py-5 text-sm text-slate-400">No se detectaron condiciones para proponer acciones con la muestra disponible.</p>}</section>}
      <details className="border-t border-white/10 pt-4"><summary className="flex cursor-pointer items-center gap-2 text-sm text-slate-400"><Search size={16} />Alcance, fórmulas y limitaciones</summary><ul className="mt-4 max-w-5xl space-y-2 text-xs leading-6 text-slate-400">{report.limitations.map(value => <li key={value}>{value}</li>)}{report.duplicateOrderRows > 0 && <li>{report.duplicateOrderRows} registros duplicados de orden consolidados en su registro más reciente.</li>}{analysis?.limitations.map((value, index) => <li key={index}>{value}</li>)}</ul></details>
    </>}
  </div>;
}
