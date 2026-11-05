"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDateField } from "@/components/CalendarDateField";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";

type Indicator = { id: string; name: string; card: string; okSamples: number; criticalSamples: number; evaluatedSamples: number; compliancePercent: number | null; errorPhotoCount: number };
type Row = { id: string; inspectionDate: string; sampleClassification: "OK" | "CRITICAL" | "PENDING"; errorPhotoCount: number; supervisorName: string; technicianName: string; orderNumber: string };
type Report = { items: Row[]; qualityBySupervisor: Indicator[]; summary: { total: number; okSamples: number; criticalSamples: number; evaluatedSamples: number; compliancePercent: number | null; errorPhotoCount: number } };
type Options = { regions: string[]; supervisors: { id: string; full_name: string; employee_code: string }[] };

export default function QualityIntelligencePage() {
  const { token } = useAuth();
  const [filters, setFilters] = useState({ fromDate: "", toDate: "", region: "", supervisorId: "" });
  const [options, setOptions] = useState<Options>({ regions: [], supervisors: [] });
  const [report, setReport] = useState<Report | null>(null);
  const [analysis, setAnalysis] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true); setMessage(null); setAnalysis([]);
    const query = new URLSearchParams({ mode: "OFFLINE" });
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    try { setReport(await apiFetch<Report>(`/quality-inspection-reports?${query}`, { token })); }
    catch (error) { setMessage(error instanceof ApiError ? error.message : "No fue posible cargar el análisis."); }
    finally { setBusy(false); }
  }, [filters, token]);

  useEffect(() => {
    if (!token) return;
    apiFetch<Options>("/quality-inspection-reports/options?mode=OFFLINE", { token }).then(setOptions).catch(() => undefined);
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const monthly = useMemo(() => {
    const values = new Map<string, { ok: number; critical: number }>();
    for (const row of report?.items || []) {
      if (row.sampleClassification === "PENDING") continue;
      const month = String(row.inspectionDate).slice(0, 7);
      const value = values.get(month) || { ok: 0, critical: 0 };
      if (row.sampleClassification === "OK") value.ok += 1; else value.critical += 1;
      values.set(month, value);
    }
    return [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, ...value, compliance: value.ok + value.critical ? value.ok * 100 / (value.ok + value.critical) : null }));
  }, [report]);

  function generateAnalysis() {
    if (!report || report.summary.evaluatedSamples === 0) {
      setAnalysis(["No existe una muestra definitiva suficiente para generar conclusiones. Amplíe el período o complete las inspecciones pendientes."]);
      return;
    }
    const s = report.summary;
    const worst = [...report.qualityBySupervisor].filter((item) => item.evaluatedSamples > 0).sort((a, b) => (a.compliancePercent ?? 100) - (b.compliancePercent ?? 100))[0];
    const result = [
      `Se evaluaron ${s.evaluatedSamples} órdenes únicas: ${s.okSamples} OK y ${s.criticalSamples} críticas. El cumplimiento ponderado es ${s.compliancePercent?.toFixed(2)}%.`,
      `Las órdenes críticas contienen ${s.errorPhotoCount} fotografías con ERROR. Estas incidencias explican los hallazgos, pero no incrementan el número de muestras críticas.`
    ];
    if (worst) result.push(`Prioridad sugerida: revisar el equipo de ${worst.name}, con ${worst.compliancePercent?.toFixed(2)}% en ${worst.evaluatedSamples} muestras y ${worst.errorPhotoCount} fotografías con error.`);
    if ((s.compliancePercent ?? 100) < 90) result.push("Acción recomendada: realizar acompañamiento dirigido y revisar los tipos de evidencia con ERROR antes del próximo cierre semanal.");
    else result.push("El cumplimiento está sobre 90%. Mantenga seguimiento de recurrencias y replique las prácticas de los supervisores con mejor resultado.");
    setAnalysis(result);
  }

  const field = "min-h-11 rounded-lg border border-white/10 bg-[#070b13] px-3 text-sm text-white";
  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Análisis Inteligente de Calidad</h1><p className="mt-1 text-sm text-slate-400">Diagnóstico operativo basado en órdenes QR Offline y sus evidencias vigentes.</p></div><button onClick={generateAnalysis} disabled={!report || busy} className="rounded-lg bg-teal-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40">Generar análisis inteligente</button></header>
    <section className="ui-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <CalendarDateField id="ai-from" label="Desde fecha" value={filters.fromDate} onChange={(value) => setFilters((f) => ({ ...f, fromDate: value }))} openLabel="Abrir calendario" />
      <CalendarDateField id="ai-to" label="Hasta fecha" value={filters.toDate} onChange={(value) => setFilters((f) => ({ ...f, toDate: value }))} openLabel="Abrir calendario" />
      <select className={field} value={filters.region} onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))}><option value="">Todas las regiones</option>{options.regions.map((value) => <option key={value}>{value}</option>)}</select>
      <select className={field} value={filters.supervisorId} onChange={(e) => setFilters((f) => ({ ...f, supervisorId: e.target.value }))}><option value="">Todos los supervisores</option>{options.supervisors.map((value) => <option key={value.id} value={value.id}>{value.full_name}</option>)}</select>
      <button onClick={() => void load()} className="rounded-lg bg-teal-500 px-4 py-2 font-semibold text-slate-950">Aplicar filtros</button>
    </section>
    {message && <p className="rounded-lg bg-rose-400/10 p-3 text-rose-200">{message}</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
      ["Muestras evaluadas", report?.summary.evaluatedSamples ?? 0], ["Muestras OK", report?.summary.okSamples ?? 0], ["Muestras críticas", report?.summary.criticalSamples ?? 0], ["Fotos con ERROR", report?.summary.errorPhotoCount ?? 0], ["Cumplimiento", report?.summary.compliancePercent == null ? "N/A" : `${report.summary.compliancePercent.toFixed(2)}%`]
    ].map(([label, value]) => <div className="ui-card p-4" key={String(label)}><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-sky-300">{value}</p></div>)}</section>
    {!!analysis.length && <section className="ui-card p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Diagnóstico ejecutivo</h2><span className="rounded-full bg-sky-400/10 px-3 py-1 text-xs text-sky-200">Motor de reglas verificables v1</span></div><div className="mt-4 space-y-3">{analysis.map((text, index) => <p key={index} className="rounded-lg border border-white/5 bg-white/[0.025] p-3 text-sm text-slate-200">{text}</p>)}</div></section>}
    <section className="grid gap-4 xl:grid-cols-2"><div className="ui-card p-5"><h2 className="font-semibold">Evolución mensual</h2><div className="mt-4 space-y-3">{monthly.map((item) => <div key={item.month}><div className="flex justify-between text-sm"><span>{item.month}</span><span>{item.compliance == null ? "N/A" : `${item.compliance.toFixed(2)}%`}</span></div><div className="mt-1 h-2 rounded bg-white/5"><div className="h-2 rounded bg-teal-400" style={{ width: `${item.compliance ?? 0}%` }} /></div></div>)}</div></div><div className="ui-card overflow-hidden"><div className="p-5"><h2 className="font-semibold">Comparación por supervisor</h2></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-white/[0.04] text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Supervisor</th><th className="p-3">OK</th><th className="p-3">Críticas</th><th className="p-3">Cumplimiento</th></tr></thead><tbody>{report?.qualityBySupervisor.map((item) => <tr key={item.id} className="border-t border-white/5"><td className="p-3">{item.name}</td><td className="p-3 text-teal-300">{item.okSamples}</td><td className="p-3 text-rose-300">{item.criticalSamples}</td><td className="p-3">{item.compliancePercent == null ? "N/A" : `${item.compliancePercent.toFixed(2)}%`}</td></tr>)}</tbody></table></div></div></section>
  </div>;
}
