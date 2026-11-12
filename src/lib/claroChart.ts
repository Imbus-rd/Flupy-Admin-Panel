import { CLARO_GOAL } from "./claroQuality";

export type ClaroMonth = { month: string; quality: number | null; evaluated: number };
export function claroChart(months: ClaroMonth[]) {
  const valid = months.filter(m => /^\d{4}-\d{2}$/.test(m.month)).sort((a, b) => a.month.localeCompare(b.month));
  const entries: ClaroMonth[] = [];
  if (valid.length) {
    const byMonth = new Map(valid.map(m => [m.month, m]));
    const cursor = new Date(valid[0].month + "-01T00:00:00Z"), end = valid.at(-1)!.month;
    while (cursor.toISOString().slice(0, 7) <= end && entries.length < 122) {
      const month = cursor.toISOString().slice(0, 7);
      entries.push(byMonth.get(month) || { month, quality: null, evaluated: 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  const width = 920, height = 300, left = 58, right = 28, top = 28, bottom = 58;
  const scores = entries.flatMap(m => m.quality == null ? [] : [m.quality]);
  const min = Math.max(0, Math.min(90, Math.floor(Math.min(CLARO_GOAL, ...scores) / 10) * 10 - 10));
  const y = (value: number) => top + (100 - value) / (100 - min) * (height - top - bottom);
  const points = entries.map((m, i) => ({ ...m, x: left + (entries.length <= 1 ? 0.5 : i / (entries.length - 1)) * (width - left - right), y: m.quality == null ? null : y(m.quality) }));
  const segments: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (a.y == null || b.y == null || a.quality == null || b.quality == null) continue;
    if ((a.quality < CLARO_GOAL) !== (b.quality < CLARO_GOAL)) {
      const x = a.x + (b.x - a.x) * (CLARO_GOAL - a.quality) / (b.quality - a.quality);
      segments.push({ x1: a.x, y1: a.y, x2: x, y2: y(CLARO_GOAL), color: a.quality < CLARO_GOAL ? "#f87171" : "#2dd4bf" }, { x1: x, y1: y(CLARO_GOAL), x2: b.x, y2: b.y, color: b.quality < CLARO_GOAL ? "#f87171" : "#2dd4bf" });
    } else segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: a.quality < CLARO_GOAL ? "#f87171" : "#2dd4bf" });
  }
  return { width, height, left, right, top, bottom, min, y, goalY: y(CLARO_GOAL), points, segments, ticks: [min, min + (100 - min) / 2, 100] };
}

export async function claroChartImage(months: ClaroMonth[]) {
  const c = claroChart(months), canvas = document.createElement("canvas");
  canvas.width = c.width * 2; canvas.height = c.height * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No fue posible generar la gráfica para Excel.");
  ctx.scale(2, 2); ctx.fillStyle = "#0b111c"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = "13px Arial"; ctx.fillStyle = "#cbd5e1";
  for (const tick of c.ticks) { ctx.fillText(`${tick}%`, 8, c.y(tick) + 4); ctx.strokeStyle = "#334155"; ctx.beginPath(); ctx.moveTo(c.left, c.y(tick)); ctx.lineTo(c.width - c.right, c.y(tick)); ctx.stroke(); }
  ctx.strokeStyle = "#fbbf24"; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(c.left, c.goalY); ctx.lineTo(c.width - c.right, c.goalY); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#fbbf24"; ctx.fillText(`Meta ${CLARO_GOAL}%`, c.width - 115, 18);
  for (const s of c.segments) { ctx.strokeStyle = s.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); }
  c.points.forEach((p, i) => {
    if (p.y != null) { ctx.fillStyle = p.quality! < CLARO_GOAL ? "#f87171" : "#2dd4bf"; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI); ctx.fill(); }
    if (i % Math.max(1, Math.ceil(c.points.length / 8)) === 0 || i === c.points.length - 1) { ctx.fillStyle = "#cbd5e1"; ctx.fillText(p.month, p.x - 25, c.height - 28); }
  });
  return canvas.toDataURL("image/png");
}
