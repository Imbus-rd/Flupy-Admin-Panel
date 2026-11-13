"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { CalendarDateField } from "./CalendarDateField";
import { QualityPerformancePanel } from "./QualityPerformancePanel";
import { exportIntelligence, type IntelligenceFilters, type IntelligenceOptions, type IntelligenceReport } from "@/lib/qualityIntelligence";

const empty: IntelligenceFilters = { fromDate: "", toDate: "", companyId: "", region: "", officeId: "", supervisorId: "", technicianId: "", auditorId: "", workType: "", process: "", project: "" };
const input = "h-11 w-full min-w-0 rounded-lg border border-white/10 bg-[#080d15] px-3 text-sm";
export function QualityPerformanceDashboard() {
  const { token } = useAuth(), sequence = useRef(0);
  const [filters, setFilters] = useState(empty), [applied, setApplied] = useState(empty);
  const [options, setOptions] = useState<IntelligenceOptions>(), [report, setReport] = useState<IntelligenceReport>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [exporting, setExporting] = useState(false);
  const load = useCallback(async (values: IntelligenceFilters) => {
    if (!token) return;
    const id = ++sequence.current; setBusy(true); setError("");
    const query = new URLSearchParams(); Object.entries(values).forEach(([key, value]) => { if (value) query.set(key, value); });
    try {
      const result = await apiFetch<IntelligenceReport>("/quality-intelligence/report?" + query, { token });
      if (id !== sequence.current) return;
      const normalized = { ...empty, ...result.filters }; setReport(result); setFilters(normalized); setApplied(normalized);
    } catch (e) { if (id === sequence.current) { setReport(undefined); setError(e instanceof Error ? e.message : "No se pudieron consultar los KPI."); } }
    finally { if (id === sequence.current) setBusy(false); }
  }, [token]);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  useEffect(() => {
    let alive = true;
    if (token) void apiFetch<IntelligenceOptions>("/quality-intelligence/options", { token }).then(o => { if (alive) setOptions(o); }).catch(() => {});
    void load(empty); return () => { alive = false; invalidate(); };
  }, [token, load, invalidate]);
  return <section className="min-w-0 space-y-5 border-t border-white/10 pt-6" aria-busy={busy}>
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">KPI de técnicos y supervisores</h2><div className="flex gap-3">
      <button type="button" title="Actualizar KPI" aria-label="Actualizar KPI" disabled={busy} onClick={() => void load(applied)} className="p-2 disabled:opacity-30"><RefreshCw size={19} className={busy ? "animate-spin" : ""} /></button>
      <button type="button" title="Exportar KPI a Excel" aria-label="Exportar KPI a Excel" disabled={!report || busy || exporting} onClick={async () => { if (!report) return; setExporting(true); try { await exportIntelligence(report, null); } catch { setError("No fue posible exportar los KPI."); } finally { setExporting(false); } }} className="p-2 disabled:opacity-30"><Download size={19} /></button>
    </div></header>
    <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={e => { e.preventDefault(); void load(filters); }}>
      <CalendarDateField id="kpi-from" label="Desde fecha KPI" value={filters.fromDate} onChange={value => setFilters(f => ({ ...f, fromDate: value }))} openLabel="Abrir calendario" />
      <CalendarDateField id="kpi-to" label="Hasta fecha KPI" value={filters.toDate} onChange={value => setFilters(f => ({ ...f, toDate: value }))} openLabel="Abrir calendario" />
      <label className="min-w-0 text-xs text-slate-400">Región KPI<select aria-label="Región KPI" className={input} value={filters.region} onChange={e => setFilters(f => ({ ...f, region: e.target.value }))}><option value="">{options?.scopedRegion || "Todas"}</option>{options?.regions.map(region => <option key={region}>{region}</option>)}</select></label>
      {([["supervisorId", "Supervisor KPI", options?.supervisors], ["technicianId", "Técnico KPI", options?.technicians]] as const).map(([key, label, values]) => <label key={key} className="min-w-0 text-xs text-slate-400">{label}<select aria-label={label} className={input} value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}><option value="">Todos</option>{values?.map(v => <option key={v.id} value={v.id}>{v.name} · {v.card}</option>)}</select></label>)}
      {([["process", "Proceso Claro KPI", options?.processes], ["project", "Proyecto Claro KPI", options?.projects]] as const).map(([key, label, values]) => <label key={key} className="min-w-0 text-xs text-slate-400">{label}<select aria-label={label} className={input} value={filters[key] || ""} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}><option value="">Todos</option>{values?.map(v => <option key={v}>{v}</option>)}</select></label>)}
      <button type="submit" disabled={busy} className="h-11 self-end rounded-lg border border-teal-400/25 bg-teal-500/15 px-3 text-sm text-teal-200 disabled:opacity-30">Aplicar filtros KPI</button>
    </form>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {report && <><p className="text-xs text-slate-400">{report.filters.fromDate} / {report.filters.toDate}</p><QualityPerformancePanel key={report.snapshotId} value={report.performance} /></>}
  </section>;
}
