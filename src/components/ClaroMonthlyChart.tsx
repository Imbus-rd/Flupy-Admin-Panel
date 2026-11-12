import { claroChart, type ClaroMonth } from "@/lib/claroChart";
import { CLARO_GOAL, claroPercent } from "@/lib/claroQuality";

export function ClaroMonthlyChart({ months }: { months: ClaroMonth[] }) {
  const c = claroChart(months);
  if (!months.length) return <p className="py-8 text-sm text-slate-400">Sin muestras en el período.</p>;
  return <div className="overflow-x-auto"><svg role="img" aria-label="Gráfica lineal mensual de calidad. Meta 96 por ciento" viewBox={`0 0 ${c.width} ${c.height}`} className="w-full" style={{ minWidth: c.width }}>
    <title>Calidad mensual · meta {CLARO_GOAL}%</title>
    {c.ticks.map(t => <g key={t}><line x1={c.left} x2={c.width - c.right} y1={c.y(t)} y2={c.y(t)} stroke="#334155" /><text x={8} y={c.y(t) + 4} fill="#94a3b8" fontSize={12}>{t}%</text></g>)}
    <line x1={c.left} x2={c.width - c.right} y1={c.goalY} y2={c.goalY} stroke="#fbbf24" strokeDasharray="6 4" /><text x={c.width - 115} y={18} fill="#fbbf24" fontSize={12}>Meta {CLARO_GOAL}%</text>
    {c.segments.map((s, i) => <line key={i} {...s} stroke={s.color} strokeWidth={3} />)}
    {c.points.map(p => <g key={p.month}>
      {p.y != null && <circle cx={p.x} cy={p.y} r={5} fill={p.color}><title>{p.month}: {claroPercent(p.quality)} · {p.evaluated} evaluadas</title></circle>}
      <text x={p.x} y={p.labelY} textAnchor="middle" fill={p.color} stroke="#080d15" strokeWidth={4} paintOrder="stroke" fontSize={12} fontWeight={600}>{p.label}</text>
      <text x={p.x} y={c.height - 28} textAnchor="middle" fill="#94a3b8" fontSize={12}>{p.month}</text>
    </g>)}
  </svg></div>;
}
