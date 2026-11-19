import type { ClaroFilters, ClaroReport } from "./claroQuality";

export type ClaroYearComparison = Pick<ClaroReport, "filters" | "monthly">;

export function shiftClaroYear(date: string, years: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fecha de comparación no válida.");
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.toISOString().slice(0, 10) !== date) throw new Error("Fecha de comparación no válida.");
  const lastDay = new Date(Date.UTC(year + years, month, 0)).getUTCDate();
  return new Date(Date.UTC(year + years, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function claroPreviousYearFilters(report: ClaroYearComparison): ClaroFilters | null {
  const months = report.monthly.map(m => m.month).sort();
  const from = report.filters.fromDate || (months.length ? months[0] + "-01" : report.filters.toDate);
  const lastMonth = months.at(-1);
  const to = report.filters.toDate || (lastMonth
    ? new Date(Date.UTC(Number(lastMonth.slice(0, 4)), Number(lastMonth.slice(5, 7)), 0)).toISOString().slice(0, 10)
    : from);
  if (!from || !to) return null;
  let previousTo = shiftClaroYear(to, -1);
  const end = new Date(to + "T00:00:00Z");
  const monthEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  if (end.getUTCDate() === monthEnd) previousTo = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { ...report.filters, fromDate: shiftClaroYear(from, -1), toDate: previousTo };
}
