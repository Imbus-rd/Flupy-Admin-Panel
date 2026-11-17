"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { CalendarDateField } from "@/components/CalendarDateField";
import { FilterMultiSelect } from "@/components/FilterMultiSelect";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { onlineTargetToday, onlineTargetQuery, onlineTargetScale, onlineTargetExport,
  type OnlineTargets, type OnlineTargetFilters } from "@/lib/onlineInspectionTargets";

export function OnlineInspectionTargets({ refreshKey = 0 }: { refreshKey?: number }) {
  const { token } = useAuth();
  const { locale } = useI18n();
  const es = locale === "es";
  const [filters, setFilters] = useState<OnlineTargetFilters>(() => ({ period: "MONTH", date: onlineTargetToday(), region: "", supervisorId: [], process: "" }));
  const [data, setData] = useState<OnlineTargets | null>(null);
  const [regions, setRegions] = useState<string[]>([]);
  const [supervisors, setSupervisors] = useState<OnlineTargets["options"]["supervisors"]>([]);
  const [busy, setBusy] = useState(true), [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const query = onlineTargetQuery(filters);
  useEffect(() => {
    let current = true;
    setData(null); setError(null); setBusy(true);
    if (!token) { setBusy(false); return; }
    apiFetch<OnlineTargets>("/quality-inspection-reports/online-targets?" + query, { token })
      .then(result => {
        if (!current) return;
        setData(result);
        setSupervisors(result.options.supervisors);
        if (!result.filters.region) setRegions(result.options.regions);
      })
      .catch(e => { if (current) setError(e instanceof ApiError ? e.message : es ? "No se pudo consultar el objetivo." : "Unable to load the target."); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [token, query, reload, refreshKey, es]);
  const n = (v: number | null) => v == null ? "—" : v.toLocaleString(es ? "es-DO" : "en-US", { maximumFractionDigits: 2 });
  const date = (v: string) => new Intl.DateTimeFormat(es ? "es-DO" : "en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(v + "T12:00:00Z"));
  const scale = onlineTargetScale(data?.rows || []);
  const field = "h-11 w-full min-w-0 rounded-lg border border-white/10 bg-[#080d15] px-3 text-sm text-white";
  async function exportExcel() {
    if (!data) return;
    setExporting(true); setError(null);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const book = new ExcelJS.Workbook(), values = onlineTargetExport(data);
      const add = (title: string, headings: string[], rows: (string | number | null)[][]) => {
        const sheet = book.addWorksheet(title);
        sheet.addRow(headings); rows.forEach(row => sheet.addRow(row));
        sheet.getRow(1).font = { bold: true };
        sheet.views = [{ state: "frozen", ySplit: 1 }];
        sheet.columns.forEach((c, i) => { c.width = i === 0 ? 34 : 22; });
        sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headings.length } };
        for (const key of [8, 10, 11]) if (title === "Objetivos QR Online") sheet.getColumn(key).numFmt = "0.00";
        if (title === "Detalle diario") sheet.getColumn(5).numFmt = "0.00";
      };
      add("Objetivos QR Online", values.headings, values.rows);
      add("Detalle diario", ["Supervisor", "Tarjeta", "Región", "Fecha", "Meta proporcional", "QR Online completados", "Proceso"], values.daily);
      const buffer = await book.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a"); link.href = url;
      link.download = "flupy-objetivos-qr-online-" + data.filters.period.toLowerCase() + "-" + data.filters.date + ".xlsx";
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError(es ? "No se pudo exportar el cumplimiento." : "Unable to export target results."); }
    finally { setExporting(false); }
  }
  return <section aria-label={es ? "Objetivo QR Online por supervisor" : "QR Online supervisor target"} className="min-w-0 space-y-5 border-y border-white/10 py-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="text-lg font-semibold">{es ? "Objetivo QR Online por supervisor" : "QR Online supervisor target"}</h2>
        <p className="mt-1 text-sm text-slate-400">{es ? "Meta mensual: 60 · Lunes a viernes · Solo inspecciones completadas" : "Monthly target: 60 · Monday to Friday · Completed inspections only"}</p></div>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={() => setReload(v => v + 1)} disabled={busy} aria-label={es ? "Actualizar objetivo" : "Refresh target"} title={es ? "Actualizar objetivo" : "Refresh target"} className="rounded-lg border border-white/10 p-2.5 text-slate-300 hover:text-teal-200 disabled:opacity-40"><RefreshCw size={18} className={busy ? "animate-spin" : ""} /></button>
        <button type="button" onClick={() => void exportExcel()} disabled={busy || exporting || !data?.rows.length} aria-label={es ? "Exportar objetivos Excel" : "Export targets to Excel"} title={es ? "Exportar objetivos Excel" : "Export targets to Excel"} className="rounded-lg border border-white/10 p-2.5 text-slate-300 hover:text-teal-200 disabled:opacity-40"><Download size={18} /></button>
      </div>
    </header>
    <div className="flex w-fit max-w-full rounded-lg border border-white/10 p-1" role="group" aria-label={es ? "Período del objetivo" : "Target period"}>
      {(["MONTH", "WEEK", "DAY"] as const).map((period, i) => <button key={period} type="button" aria-pressed={filters.period === period} onClick={() => setFilters(f => ({ ...f, period }))}
        className={`min-h-10 rounded px-4 text-sm transition-colors ${filters.period === period ? "bg-teal-400/15 text-teal-200" : "text-slate-400 hover:text-white"}`}>{(es ? ["Mes", "Semana", "Día"] : ["Month", "Week", "Day"])[i]}</button>)}
    </div>
    <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <CalendarDateField id="online-target-date" label={es ? "Fecha de referencia del objetivo" : "Target reference date"} value={filters.date} onChange={value => { if (value) setFilters(f => ({ ...f, date: value })); }} openLabel={es ? "Abrir calendario del objetivo" : "Open target calendar"} />
      <label className="min-w-0 text-xs text-slate-400">{es ? "Región del objetivo" : "Target region"}<select aria-label={es ? "Región del objetivo" : "Target region"} className={field + " mt-1.5"} value={filters.region} onChange={e => setFilters(f => ({ ...f, region: e.target.value, supervisorId: [] }))}><option value="">{es ? "Todas las regiones disponibles" : "All available regions"}</option>{regions.map(r => <option key={r}>{r}</option>)}</select></label>
      <FilterMultiSelect label={es ? "Supervisor del objetivo" : "Target supervisor"} options={supervisors.map(s => ({ id: s.id, name: s.name + " · " + s.card }))} value={filters.supervisorId} onChange={supervisorId => setFilters(f => ({ ...f, supervisorId }))} />
      <label className="min-w-0 text-xs text-slate-400">{es ? "Proceso del objetivo" : "Target process"}<select aria-label={es ? "Proceso del objetivo" : "Target process"} className={field + " mt-1.5"} value={filters.process} onChange={e => setFilters(f => ({ ...f, process: e.target.value }))}><option value="">{es ? "Todos los procesos" : "All processes"}</option><option value="INSTALLATION">{es ? "Instalación" : "Installation"}</option><option value="REPAIR">{es ? "Avería" : "Repair"}</option><option value="UNCLASSIFIED">{es ? "Sin clasificar" : "Unclassified"}</option></select></label>
    </div>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {filters.process && <p className="text-xs text-slate-400">{es ? "Meta de 60 por supervisor, no adicional por proceso. Proceso según el perfil técnico de la inspección." : "Target of 60 per supervisor, not an additional process quota. Process follows the inspection technician profile."}</p>}
    {busy && <p role="status" className="text-sm text-slate-400">{es ? "Consultando cumplimiento…" : "Loading target results…"}</p>}
    {data && <>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400">
        <span>{date(data.period.fromDate)} – {date(data.period.toDate)} · {data.period.workdays} {es ? "días de lunes a viernes" : "weekdays"}</span>
        <span>{es ? "Meta por supervisor" : "Target per supervisor"}: <strong className="text-amber-200">{n(data.period.targetPerSupervisor)}</strong></span>
      </div>
      <div className="grid gap-4 border-y border-white/10 py-4 sm:grid-cols-4">
        {[[es ? "Supervisores" : "Supervisors", n(data.summary.supervisors)], [es ? "QR completados" : "Completed QR", n(data.summary.completed)],
          [es ? "Meta conjunta" : "Combined target", n(data.summary.target)], [es ? "Cumplimiento" : "Achievement", data.summary.percent == null ? "—" : n(data.summary.percent) + "%"]].map(([label, v]) => <div key={label}><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-sky-200">{v}</p></div>)}
      </div>
      {!data.period.workdays ? <p className="text-sm text-slate-400">{es ? "Día no laborable para este objetivo. Los sábados y domingos no tienen meta ni se contabilizan." : "No target on weekends. Saturday and Sunday inspections are excluded."}</p> :
        !data.rows.length ? <p className="text-sm text-slate-400">{es ? "Sin supervisores para los filtros seleccionados." : "No supervisors match these filters."}</p> : <>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400"><span><span className="mr-2 inline-block h-2 w-3 bg-sky-400" />{es ? "Completados" : "Completed"}</span><span><span className="mr-2 inline-block h-3 border-l-2 border-dashed border-amber-300" />{es ? "Meta del período" : "Period target"}</span></div>
          <ol className="space-y-5">{data.rows.map(row => <li key={row.id} className="min-w-0">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><div className="min-w-0"><p className="break-words text-sm font-medium">{row.name}</p><p className="text-xs text-slate-500">{row.card} · {row.region}{row.historical && (es ? " · Histórico" : " · Historical")}</p></div>
              <p className="text-sm tabular-nums"><strong className="text-sky-200">{n(row.completed)}</strong><span className="text-slate-400"> / {n(row.target)}</span><span className={`ml-3 ${(row.percent ?? 0) >= 100 ? "text-teal-200" : "text-rose-300"}`}>{n(row.percent)}%</span></p></div>
            <div aria-hidden="true" className="relative h-5 w-full rounded bg-white/5">
              <div className="absolute inset-y-0 left-0 rounded bg-sky-400/65" style={{ width: scale.width(row.completed) + "%" }} />
              <span className="absolute -bottom-1 -top-1 border-l-2 border-dashed border-amber-300" style={{ left: `calc(${scale.width(row.target ?? 0)}% - 2px)` }} />
            </div>
          </li>)}</ol>
        </>}
    </>}
  </section>;
}
