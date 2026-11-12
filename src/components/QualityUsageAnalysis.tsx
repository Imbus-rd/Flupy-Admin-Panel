"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { displayPercent, exportUsageList, usageRole, usageStatus, type IntelligenceReport } from "@/lib/qualityIntelligence";

const input = "h-10 min-w-0 rounded-lg border border-white/10 bg-[#080d15] px-3 text-sm";
const button = "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm hover:bg-white/5 disabled:opacity-40";
const time = (value: string | null) => value ? new Intl.DateTimeFormat("es-DO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santo_Domingo" }).format(new Date(value)) : "Sin registro";

export function QualityUsageAnalysis({ report }: { report: IntelligenceReport }) {
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!report.usage) return <p className="text-sm text-amber-200">Actualice el backend para consultar el uso por empleado.</p>;
  const usage = report.usage, s = usage.summary;
  const rows = usage.employees.filter(e => (!status || e.status === status) && (!role || (e.isSupervisor ? "SUPERVISOR" : e.role) === role));
  const pages = Math.max(1, Math.ceil(rows.length / 25)), current = Math.min(page, pages - 1);
  async function download() {
    setBusy(true); setError("");
    try { await exportUsageList(report, rows, usageStatus[status] || "", usageRole[role] || ""); }
    catch { setError("No fue posible exportar el listado de uso."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-6">
    <header><h2 className="font-semibold">Uso de la aplicación por empleados activos</h2><p className="mt-1 text-sm text-slate-400">{s.active} empleados activos · {s.technicians} técnicos operativos · {report.filters.fromDate} al {report.filters.toDate}</p></header>
    <dl className="grid gap-4 border-y border-white/10 py-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Con entrada", s.withPunch, displayPercent(s.punchPercent)], ["Cargaron fotos", s.withPhotos, displayPercent(s.photoPercent)],
      ["Ambas funciones", s.both, displayPercent(s.bothPercent)], ["Sin actividad registrada", s.withoutActivity, "En el período y filtros aplicados"]
    ].map(([label, count, detail]) => <div key={String(label)}><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-sky-200">{count}</dd><p className="mt-1 text-xs text-slate-500">{detail}</p></div>)}</dl>
    <p className="text-xs leading-6 text-slate-400">Base de todos los roles activos, no un indicador de asistencia perfecta ni de calidad. Una foto cargada demuestra uso aunque la orden esté incompleta o rechazada. Sin actividad no demuestra ausencia ni incumplimiento.</p>
    {(report.filters.workType || report.filters.auditorId) && <p className="text-sm text-amber-200">Tipo de trabajo y auditor filtran las fotos; los ponches mantienen el alcance de empleados y fechas porque no pertenecen a una categoría de orden o revisor.</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-3 text-left font-medium">Uso por supervisor</caption><thead className="border-y border-white/10 text-xs text-slate-400"><tr>{["Supervisor", "Activos", "Con entrada", "Con fotos", "Ambos", "Solo entrada", "Solo fotos", "Sin actividad"].map(label => <th className="whitespace-nowrap p-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody>{usage.bySupervisor.map(row => <tr key={row.id} className="border-b border-white/5"><td className="min-w-44 p-3">{row.name}</td>{[row.active, row.withPunch, row.withPhotos, row.both, row.onlyPunch, row.onlyPhotos, row.withoutActivity].map((value, index) => <td key={index} className="p-3 tabular-nums">{value}</td>)}</tr>)}</tbody></table></div>
    <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-xs text-slate-400">Uso registrado<select aria-label="Uso registrado" className={input} value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">Todos</option>{Object.entries(usageStatus).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="grid gap-1 text-xs text-slate-400">Rol del empleado<select aria-label="Rol del empleado" className={input} value={role} onChange={e => { setRole(e.target.value); setPage(0); }}><option value="">Todos</option>{Object.entries(usageRole).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><button onClick={() => void download()} disabled={busy} className={`${button} ml-auto`}><Download size={16} />Exportar listado</button></div>
    {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-white/10 text-xs text-slate-400"><tr>{["Empleado / tarjeta", "Rol", "Región / localidad", "Supervisor", "Días con entrada", "Última entrada", "Órdenes / fotos cargadas", "Última carga", "Uso registrado"].map(label => <th key={label} className="whitespace-nowrap p-3 font-medium">{label}</th>)}</tr></thead><tbody>{rows.slice(current * 25, (current + 1) * 25).map(e => <tr key={e.id} className="border-b border-white/5"><td className="min-w-44 p-3 font-medium">{e.name}<div className="text-xs text-slate-500">{e.card}</div></td><td className="p-3 text-slate-400">{e.isSupervisor ? "Supervisor" : usageRole[e.role] || e.role}</td><td className="p-3 text-slate-400">{e.region || "Sin región"}<div className="text-xs">{e.officeName || "Sin localidad"}</div></td><td className="p-3 text-slate-400">{e.supervisorName}</td><td className="p-3 tabular-nums">{e.punchDays}</td><td className="whitespace-nowrap p-3 text-xs text-slate-400">{time(e.lastPunchAt)}</td><td className="p-3 tabular-nums">{e.photoOrders} / {e.photoCount}</td><td className="whitespace-nowrap p-3 text-xs text-slate-400">{time(e.lastPhotoAt)}</td><td className={`whitespace-nowrap p-3 text-xs ${e.status === "NO_ACTIVITY" ? "text-amber-200" : "text-teal-200"}`}>{usageStatus[e.status]}</td></tr>)}</tbody></table></div>
    {!rows.length && <p className="py-5 text-sm text-slate-400">Sin empleados para esta selección.</p>}
    <div className="flex items-center justify-between"><span className="text-xs text-slate-400">{rows.length} empleados en el listado</span><div className="flex items-center gap-3"><button className={button} title="Página anterior" aria-label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></button><span className="text-xs text-slate-400">{current + 1} / {pages}</span><button className={button} title="Página siguiente" aria-label="Página siguiente" disabled={current === pages - 1} onClick={() => setPage(current + 1)}><ChevronRight size={16} /></button></div></div>
    <details className="border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm text-slate-400">Alcance del uso registrado</summary><ul className="mt-3 space-y-2 text-xs leading-6 text-slate-400">{usage.limitations.map(value => <li key={value}>{value}</li>)}</ul></details>
  </section>;
}
