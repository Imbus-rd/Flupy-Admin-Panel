/** Dominican Republic — matches backend `America/Santo_Domingo` (admin filters, punch times, etc.). */
export const REPORTING_TIME_ZONE = "America/Santo_Domingo";

type ReportingFmtOpts = {
  /** Include seconds (e.g. attendance timestamps). Default false. */
  includeSeconds?: boolean;
};

/** Format an ISO / DB datetime for admins in Dominican local time (not the viewer's browser zone). */
export function formatReportingDateTime(
  iso: string | null | undefined,
  locale: string,
  opts?: ReportingFmtOpts
): string {
  const raw = iso == null ? "" : typeof iso === "string" ? iso : String(iso);
  if (!raw.trim()) return "—";
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    const loc = locale === "es" ? "es-DO" : "en-US";
    return d.toLocaleString(loc, {
      timeZone: REPORTING_TIME_ZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...(opts?.includeSeconds ? { second: "2-digit" as const } : {})
    });
  } catch {
    return raw;
  }
}
