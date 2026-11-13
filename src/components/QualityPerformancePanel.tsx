"use client";

import { useState } from "react";
import { displayPercent, displayRating } from "@/lib/qualityIntelligence";
import type { QualityPerformance } from "@/lib/qualityPerformance";
const pct = displayPercent;
export function QualityPerformancePanel({ value }: { value?: QualityPerformance }) {
  const [group, setGroup] = useState<"byTechnician" | "bySupervisor" | "byProcess">("byTechnician"), [page, setPage] = useState(0);
  if (!value) return <p className="text-sm text-slate-400">Actualice el backend para consultar los KPI integrados.</p>;
  const s = value.summary, rows = group === "byProcess" ? [] : value[group], pages = Math.max(1, Math.ceil(rows.length / 25)), current = Math.min(page, pages - 1);
  const score = (v: number | null) => v == null ? "Sin muestra" : v.toFixed(2) + " / 100";
  const indicators = [
    ["Valoración global", score(s.overall.value), s.overall.available + " / " + s.overall.total + " KPI · igual peso", false],
    ["Calidad Claro", s.claro.comparable ? pct(s.claro.quality) : "No comparable", s.claro.evaluated + " muestras · meta 96%", s.claro.quality != null && s.claro.quality < 96],
    ["QR Offline", pct(s.qrOffline.value), s.qrOffline.ok + " OK / " + s.qrOffline.evaluated + " evaluadas", false],
    ["QR Online", displayRating(s.qrOnline.value), s.qrOnline.evaluated + " evaluadas", false],
    ["Fotos completas", pct(s.photos.value), s.photos.complete + " / " + s.photos.applicable + " órdenes", false],
    ["Puntualidad registrada", pct(s.attendance.value), s.attendance.onTimeDays + " a tiempo / " + s.attendance.knownDays + " con horario", false],
    ["Técnicos que usan la app", pct(s.usage.value), s.usage.active + " activos · " + s.usage.withoutActivity + " sin actividad", false],
    ["Retro+ enviadas", String(s.retro.submissions), pct(s.retro.value) + " · " + s.retro.daysWithSubmission + " / " + s.retro.daysWithActivity + " días con meta de 1 envío", false]
  ];
  return <section className="min-w-0 space-y-5" aria-label="KPI integrados">
    <div className="grid gap-x-6 gap-y-4 border-y border-white/10 py-5 sm:grid-cols-2 xl:grid-cols-4">{indicators.map(([label, result, count, below]) => <div key={String(label)} className="min-w-0"><h3 className="text-xs text-slate-400">{label}</h3><p className={`mt-2 text-xl font-semibold tabular-nums ${below ? "text-red-400" : "text-teal-200"}`}>{result}</p><p className="mt-1 text-xs leading-5 text-slate-500">{count}</p></div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Valoración por indicador</h3><select aria-label="Agrupar KPI" value={group} onChange={e => { setGroup(e.target.value as typeof group); setPage(0); }} className="h-10 rounded-lg border border-white/10 bg-[#080d15] px-3 text-sm"><option value="byTechnician">Técnico</option><option value="bySupervisor">Supervisor</option><option value="byProcess">Proceso Claro</option></select></div>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-white/10 text-xs text-slate-400"><tr>{(group === "byProcess" ? ["Proceso Claro", "Muestras evaluadas", "Calidad ponderada", "Meta"] : ["Nombre / tarjeta", "Global / 100", "Claro", "QR Offline", "QR Online", "Fotos completas", "Puntualidad", "Uso app", "Retro+ enviadas", "Meta diaria Retro+"]).map(label => <th key={label} className="whitespace-nowrap p-3 font-medium">{label}</th>)}</tr></thead><tbody>
      {group === "byProcess" ? value.byProcess.map(row => <tr key={row.process} className="border-b border-white/5"><td className="p-3">{row.process}</td><td className="p-3">{row.claro.evaluated}</td><td className={`p-3 ${row.claro.quality != null && row.claro.quality < 96 ? "text-red-400" : "text-teal-200"}`}>{pct(row.claro.quality)}</td><td className="p-3">96%</td></tr>) : rows.slice(current * 25, (current + 1) * 25).map(row => <tr key={row.id} className="border-b border-white/5"><td className="min-w-44 p-3">{row.name}<div className="text-xs text-slate-500">{row.card}{!row.matchedEmployee && " · Sin usuario coincidente"}</div></td><td className="whitespace-nowrap p-3 text-sky-200">{score(row.overall.value)}<div className="text-xs text-slate-500">{row.overall.available}/{row.overall.total} KPI</div></td><td className={`whitespace-nowrap p-3 ${row.claro.quality != null && row.claro.quality < 96 ? "text-red-400" : "text-teal-200"}`}>{pct(row.claro.quality)}<div className="text-xs text-slate-500">{row.claro.evaluated} muestras</div></td>{[pct(row.qrOffline.value), displayRating(row.qrOnline.value), pct(row.photos.value), pct(row.attendance.value), pct(row.usage.value), String(row.retro.submissions), pct(row.retro.value)].map((text, i) => <td key={i} className="whitespace-nowrap p-3 tabular-nums">{text}</td>)}</tr>)}
    </tbody></table></div>
    {!(group === "byProcess" ? value.byProcess : rows).length && <p className="py-6 text-center text-sm text-slate-400">Sin datos para los filtros aplicados.</p>}
    {group !== "byProcess" && <div className="flex justify-end gap-3 text-sm"><button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="disabled:opacity-30">Anterior</button><span>{current + 1} / {pages}</span><button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="disabled:opacity-30">Siguiente</button></div>}
    <p className="text-xs leading-6 text-slate-400">Igual peso para los KPI disponibles; sin muestra no se incluye en la nota. QR Online se normaliza sobre 100. Meta Retro+: 1 envío por técnico y día con actividad registrada, sin compensar días con excedentes. Se cuentan envíos, no calificaciones positivas del cliente. Proceso y proyecto Claro aplican solo a Calidad Claro.</p>
  </section>;
}
