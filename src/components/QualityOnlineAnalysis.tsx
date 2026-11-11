"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { displayRating, type IntelligenceReport } from "@/lib/qualityIntelligence";

const status: Record<string, string> = { DRAFT: "Borrador", IN_PROGRESS: "En proceso", COMPLETED: "Completada", CANCELLED: "Cancelada" };
const criterion: Record<string, string> = {
  arrived_on_time: "Llegada a tiempo", punched_in: "Ponche de entrada", workday_started_timely: "Salida a tiempo",
  shirt: "Camisa", belt: "Correa", pants: "Pantalones", boots: "Botas", badge: "Carnet",
  exterior: "Exterior del vehículo", tires: "Gomas", seats: "Asientos", interior: "Interior del vehículo",
  tools_organization: "Organización de herramientas", materials_organization: "Organización de materiales",
  speed: "Velocidad", prudent_driving: "Prudencia al conducir", traffic_laws: "Leyes de tránsito",
  education: "Educación", addressing_customer: "Trato al cliente", verbal_handling: "Manejo verbal", courtesy: "Cortesía",
  communication: "Comunicación", customer_orientation: "Orientación al cliente", situation_handling: "Manejo de situaciones",
  technical_mastery: "Dominio técnico", work_organization: "Organización del trabajo", tool_use: "Uso de herramientas",
  agility: "Agilidad", problem_solving: "Resolución de problemas", time_efficiency: "Uso del tiempo", independence: "Autonomía",
  order_uploaded: "Orden subida", no_waste: "Sin desperdicios", warranty_delivered: "Garantía de servicio", nps_explained: "Explicación de encuesta NPS"
};

export function QualityOnlineAnalysis({ report }: { report: IntelligenceReport }) {
  const [page, setPage] = useState(0);
  const summary = report.summary.qrOnline;
  const pages = Math.max(1, Math.ceil(report.onlineInspections.length / 25));
  const current = Math.min(page, pages - 1);
  return <section className="space-y-6">
    <header><h2 className="font-semibold">Acompañamientos QR Online</h2><p className="mt-1 text-sm text-slate-400">{summary.accompaniments} acompañamientos · {summary.total} órdenes · {summary.evaluated} evaluadas</p></header>
    <dl className="grid gap-4 border-y border-white/10 py-4 sm:grid-cols-2 xl:grid-cols-5">{[
      ["Valoración", displayRating(summary.averageRating)], ["Con hallazgos", summary.withFindings],
      ["Sin hallazgos", summary.withoutFindings], ["En proceso", summary.inProgress], ["Canceladas", summary.cancelled]
    ].map(([label, value]) => <div key={String(label)}><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-sky-200">{value}</dd></div>)}</dl>
    {summary.total === 0 && <p role="status" className="rounded-lg border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-400">Sin inspecciones QR Online para las condiciones aplicadas. No se asigna puntuación ni se emiten conclusiones sobre acompañamientos sin muestra.</p>}
    {summary.unratedCompleted > 0 && <p className="text-sm text-amber-200">{summary.unratedCompleted} inspecciones completadas sin los ocho grupos puntuables válidos. Se mantienen fuera de la valoración agregada.</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-xs text-slate-400"><tr>{["Grupo", "Evaluaciones únicas", "Valoración / 5", "Con hallazgos"].map(label => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{summary.groups.map(group => <tr key={group.key} className="border-b border-white/5"><td className="p-3">{group.label}</td><td className="p-3 tabular-nums">{group.evaluated}</td><td className="whitespace-nowrap p-3 tabular-nums text-teal-300">{displayRating(group.averageRating)}</td><td className="p-3 tabular-nums">{group.withFindings}</td></tr>)}</tbody></table></div>
    <div className="divide-y divide-white/10">{report.onlineInspections.slice(current * 25, (current + 1) * 25).map(inspection => <details key={inspection.id} className="py-4"><summary className="cursor-pointer"><div className="inline-flex max-w-full flex-wrap items-baseline gap-x-4 gap-y-2 pl-2"><span className="font-medium text-teal-200">OT {inspection.orderNumber}</span><span className="text-sm">{inspection.technicianName} · {inspection.technicianCard}</span><span className="text-xs text-slate-400">{inspection.date} · {status[inspection.status] || inspection.status}</span><span className="text-sm text-sky-200">{displayRating(inspection.averageRating)}</span></div></summary><div className="mt-4 space-y-3 pl-5"><p className="text-xs text-slate-400">Supervisor: {inspection.supervisorName} · Auditor: {inspection.auditorName}</p>{inspection.missingTools > 0 && <p className="text-sm text-amber-200">Herramientas requeridas faltantes: {inspection.missingTools}</p>}{inspection.groups.map(group => <div key={group.key} className="border-l border-white/10 pl-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{group.label}</span><span className="text-slate-400">{group.scored ? `${group.rating} / 5` : "Contexto; no puntúa"}</span></div>{group.comment && <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-300">{group.comment}</p>}{group.scored && group.failedCriteria.length > 0 && <p className="mt-1 text-xs text-amber-200">No cumple: {group.failedCriteria.map(key => criterion[key] || key).join(" · ")}</p>}</div>)}</div></details>)}</div>
    {report.onlineInspections.length > 25 && <div className="flex justify-end gap-3"><button className="rounded-lg border border-white/10 p-2 disabled:opacity-30" title="Página anterior" aria-label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></button><span className="self-center text-xs text-slate-400">{current + 1} / {pages}</span><button className="rounded-lg border border-white/10 p-2 disabled:opacity-30" title="Página siguiente" aria-label="Página siguiente" disabled={current === pages - 1} onClick={() => setPage(current + 1)}><ChevronRight size={16} /></button></div>}
  </section>;
}
