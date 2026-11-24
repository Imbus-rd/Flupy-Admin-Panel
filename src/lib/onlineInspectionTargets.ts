export type OnlineTargetFilters = { period: "MONTH" | "WEEK" | "DAY"; date: string; region: string; auditorId: string[]; process: string };
export type OnlineTargetRow = {
  id: string; card: string; name: string; region: string; historical: boolean;
  completed: number; target: number | null; remaining: number | null; percent: number | null;
  daily: { date: string; target: number; completed: number }[];
};
export type OnlineTargets = {
  monthlyGoal: number; filters: OnlineTargetFilters;
  period: { fromDate: string; toDate: string; workdays: number; targetPerAuditor: number | null };
  summary: { auditors: number; completed: number; target: number | null; percent: number | null; atGoal: number };
  options: { regions: string[]; auditors: { id: string; card: string; name: string }[] };
  rows: OnlineTargetRow[];
};

export function onlineTargetQuery(filters: OnlineTargetFilters) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) [...new Set(value)].filter(Boolean).forEach(v => query.append(key, v));
    else if (value) query.set(key, value);
  });
  return query.toString();
}

export function onlineTargetScale(rows: OnlineTargetRow[]) {
  const max = Math.max(1, ...rows.map(r => Math.max(r.target ?? 0, r.completed)));
  return { maximum: max, width: (value: number) => Math.max(0, Math.min(100, value / max * 100)) };
}

export function onlineTargetExport(data: OnlineTargets) {
  const headings = ["Auditor", "Tarjeta", "Región", "Desde", "Hasta", "Meta mensual", "Días lunes a viernes",
    "Meta del período", "QR Online completados", "Cumplimiento %", "Faltantes", "Registro histórico", "Proceso"];
  const process = ({ INSTALLATION: "Instalación", REPAIR: "Avería", UNCLASSIFIED: "Sin clasificar" } as Record<string, string>)[data.filters.process] || "Todos";
  const rows = data.rows.map(r => [r.name, r.card, r.region, data.period.fromDate, data.period.toDate,
    data.monthlyGoal, data.period.workdays, r.target, r.completed, r.percent, r.remaining, r.historical ? "Sí" : "No", process]);
  const daily = data.rows.flatMap(r => r.daily.map(d => [r.name, r.card, r.region, d.date, d.target, d.completed, process]));
  return { headings, rows, daily };
}

export function onlineTargetToday() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "America/Santo_Domingo", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)?.value).join("-");
}
