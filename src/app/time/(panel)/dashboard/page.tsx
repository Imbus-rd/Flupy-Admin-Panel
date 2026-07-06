"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import { formatReportingDateTime } from "@/lib/timezone";
import { CalendarDateField } from "@/components/CalendarDateField";
import { EMPLOYEE_REGIONS } from "@/lib/employeeRegions";

const COUNT_UP_MS = 900;

function useCountUp(target: number | null, replayKey: number) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === null) {
      setValue(0);
      return;
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setValue(target);
      return;
    }

    let cancelled = false;
    const from = 0;
    const to = target;
    const t0 = performance.now();

    setValue(0);

    const step = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - t0) / COUNT_UP_MS);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setValue(to);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, replayKey]);

  return target === null ? null : value;
}

type Summary = {
  activeEmployees: number;
  geofences: number;
  checkInsToday: number;
  tardinessToday: number;
  workdayDate: string;
};

type AttRow = {
  id: string;
  fullName: string;
  employeeCode: string;
  eventType: string;
  occurredAt: string;
  workdayDate: string;
  onTime: boolean;
};

function normalizeAttendanceRows(raw: unknown): AttRow[] {
  if (!raw || typeof raw !== "object" || !("items" in raw)) return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id ?? `row-${index}`),
        fullName: String(r.fullName ?? r.full_name ?? "").trim() || "—",
        employeeCode: String(r.employeeCode ?? r.employee_code ?? "").trim() || "—",
        eventType: String(r.eventType ?? r.event_type ?? "").trim() || "UNKNOWN",
        occurredAt: String(r.occurredAt ?? r.occurred_at ?? "").trim(),
        workdayDate: String(r.workdayDate ?? r.workday_date ?? "").trim(),
        onTime: r.onTime === true || r.onTime === 1 || r.on_time === 1
      };
    })
    .filter((row): row is AttRow => row != null);
}

type ActRow = {
  id: string;
  eventType: string;
  occurredAt: string;
  employeeName: string;
  officeName: string;
  index: number;
};

type QualityReviewerStats = {
  items: {
    inspectorId: string;
    inspectorCode: string;
    inspectorName: string;
    reviewedOrders: number;
    reviewedPhotos: number;
    okPhotos: number;
    fePhotos: number;
    errorPhotos: number;
    lastReviewedAt: string | null;
  }[];
  totalReviewedOrders: number;
  totalReviewedPhotos: number;
  region: string | null;
};

function StatCard({
  label,
  target,
  replayKey
}: {
  label: string;
  target: number | null;
  replayKey: number;
}) {
  const display = useCountUp(target, replayKey);
  return (
    <div className="ui-card p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 bg-gradient-to-br from-white to-slate-300 bg-clip-text text-3xl font-bold tabular-nums text-transparent sm:text-4xl">
        {display === null ? "—" : display}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const { token, employee: authEmployee } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [activity, setActivity] = useState<ActRow[]>([]);
  const [qualityStats, setQualityStats] = useState<QualityReviewerStats | null>(null);
  const [qualityFromDate, setQualityFromDate] = useState("");
  const [qualityToDate, setQualityToDate] = useState("");
  const [qualityRegion, setQualityRegion] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [qualityErr, setQualityErr] = useState<string | null>(null);
  const [statsReplayKey, setStatsReplayKey] = useState(0);

  const scopedRegion = useMemo(() => {
    const r = authEmployee?.region;
    return r != null && String(r).trim() !== "" ? String(r).trim() : null;
  }, [authEmployee?.region]);

  const effectiveQualityRegion = scopedRegion || qualityRegion;

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [s, a, act] = await Promise.all([
        apiFetch<Summary>("/admin/dashboard/summary", { token }),
        apiFetch<unknown>("/admin/attendance/recent?limit=30", { token }),
        apiFetch<{ items: ActRow[] }>("/admin/activity/recent?limit=12", { token })
      ]);
      setSummary(s);
      setStatsReplayKey((k) => k + 1);
      setAttendance(normalizeAttendanceRows(a));
      setActivity(act.items || []);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("errorLoad"));
    }
  }, [token, t]);

  const loadQualityStats = useCallback(async () => {
    if (!token) return;
    setQualityErr(null);
    try {
      const qs = new URLSearchParams();
      if (qualityFromDate) qs.set("fromDate", qualityFromDate);
      if (qualityToDate) qs.set("toDate", qualityToDate);
      if (effectiveQualityRegion) qs.set("region", effectiveQualityRegion);
      const query = qs.toString();
      const data = await apiFetch<QualityReviewerStats>(
        `/admin/quality/reviewer-stats${query ? `?${query}` : ""}`,
        { token }
      );
      setQualityStats(data);
    } catch (e) {
      setQualityErr(e instanceof ApiError ? e.message : t("errorLoad"));
    }
  }, [token, t, qualityFromDate, qualityToDate, effectiveQualityRegion]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadQualityStats();
  }, [loadQualityStats]);

  function eventLabel(type: string) {
    const key = `event${type}` as const;
    const v = t(key);
    return v === key ? type : v;
  }

  function fmtDate(iso: string) {
    return formatReportingDateTime(iso, locale);
  }

  function applyQualityFilters() {
    void loadQualityStats();
  }

  function clearQualityFilters() {
    setQualityFromDate("");
    setQualityToDate("");
    if (!scopedRegion) setQualityRegion("");
  }

  const maxReviewedOrders = Math.max(
    1,
    ...(qualityStats?.items || []).map((row) => row.reviewedOrders)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t("dashboardTitle")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">{t("dashboardSubtitle")}</p>
          {summary?.workdayDate && (
            <p className="mt-1 text-xs text-slate-500">
              {locale === "es" ? "Día operativo" : "Workday"}: {summary.workdayDate}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 backdrop-blur-sm transition hover:border-teal-400/30 hover:bg-white/[0.07]"
          >
            {t("retry")}
          </button>
          <button
            type="button"
            className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/25 transition hover:from-teal-400 hover:to-emerald-400"
          >
            {t("newAction")}
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-rose-400">{err}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("activeEmployees")} target={summary?.activeEmployees ?? null} replayKey={statsReplayKey} />
        <StatCard label={t("checkInsToday")} target={summary?.checkInsToday ?? null} replayKey={statsReplayKey} />
        <StatCard label={t("tardiness")} target={summary?.tardinessToday ?? null} replayKey={statsReplayKey} />
        <StatCard label={t("geofences")} target={summary?.geofences ?? null} replayKey={statsReplayKey} />
      </div>

      <section className="ui-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">{t("qualityReviewerStatsTitle")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("qualityReviewerStatsSubtitle")}</p>
            {qualityStats?.region && (
              <p className="mt-2 text-xs text-amber-200/90">
                {t("qualityReviewerStatsRegion", { region: qualityStats.region })}
              </p>
            )}
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-3xl xl:grid-cols-4">
            <CalendarDateField
              id="quality-reviewer-from"
              label={t("filterFromDate")}
              value={qualityFromDate}
              onChange={setQualityFromDate}
              openLabel={`${t("openCalendar")} — ${t("filterFromDate")}`}
            />
            <CalendarDateField
              id="quality-reviewer-to"
              label={t("filterToDate")}
              value={qualityToDate}
              onChange={setQualityToDate}
              openLabel={`${t("openCalendar")} — ${t("filterToDate")}`}
            />
            <div>
              <label htmlFor="quality-reviewer-region" className="block text-xs font-medium text-slate-400">
                {t("employeesRegion")}
              </label>
              <select
                id="quality-reviewer-region"
                value={scopedRegion || qualityRegion}
                disabled={Boolean(scopedRegion)}
                onChange={(e) => setQualityRegion(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{t("qualityReviewerAllRegions")}</option>
                {EMPLOYEE_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={applyQualityFilters}
                className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:from-teal-400 hover:to-emerald-400"
              >
                {t("filterApply")}
              </button>
              <button
                type="button"
                onClick={clearQualityFilters}
                className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:border-teal-400/30"
              >
                {t("filterClear")}
              </button>
            </div>
          </div>
        </div>

        {qualityErr && <p className="mt-4 text-sm text-rose-400">{qualityErr}</p>}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t("qualityReviewedOrders")}
            </p>
            <p className="mt-2 text-3xl font-bold text-white tabular-nums">
              {qualityStats?.totalReviewedOrders ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t("qualityReviewedPhotos")}
            </p>
            <p className="mt-2 text-3xl font-bold text-white tabular-nums">
              {qualityStats?.totalReviewedPhotos ?? 0}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {(qualityStats?.items || []).length === 0 && (
            <p className="rounded-2xl border border-dashed border-white/[0.1] py-10 text-center text-sm text-slate-500">
              {t("noData")}
            </p>
          )}
          {(qualityStats?.items || []).map((row) => {
            const pct = Math.max(6, Math.round((row.reviewedOrders / maxReviewedOrders) * 100));
            return (
              <div key={row.inspectorId} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">{row.inspectorName}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{row.inspectorCode}</p>
                  </div>
                  <div className="text-sm text-slate-400">
                    <span className="font-semibold text-teal-200">{row.reviewedOrders}</span>{" "}
                    {t("qualityReviewedOrdersShort")} · {row.reviewedPhotos} {t("qualityReviewedPhotosShort")}
                  </div>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-900/80 ring-1 ring-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-300 shadow-[0_0_18px_rgba(45,212,191,0.35)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>OK: {row.okPhotos}</span>
                  <span>FE: {row.fePhotos}</span>
                  <span>Error: {row.errorPhotos}</span>
                  {row.lastReviewedAt && <span>{t("qualityLastReview")}: {fmtDate(row.lastReviewedAt)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ui-card p-4 sm:p-5">
          <h2 className="text-lg font-semibold tracking-tight text-white">{t("recentAttendance")}</h2>
          <div className="mt-4 overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-2 font-medium">{t("name")}</th>
                  <th className="pb-3 pr-2 font-medium">{t("type")}</th>
                  <th className="pb-3 pr-2 font-medium">{t("status")}</th>
                  <th className="pb-3 font-medium">{t("date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      {t("noData")}
                    </td>
                  </tr>
                )}
                {attendance.map((row) => (
                  <tr key={row.id} className="text-slate-300">
                    <td className="py-3 pr-2 font-medium text-white">{row.fullName}</td>
                    <td className="py-3 pr-2">{eventLabel(row.eventType)}</td>
                    <td className="py-3 pr-2">
                      {row.eventType === "CHECK_IN" ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            row.onTime ? "bg-teal-500/15 text-teal-200" : "bg-amber-500/15 text-amber-200"
                          }`}
                        >
                          {row.onTime ? t("onTime") : t("late")}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 text-slate-400">{fmtDate(row.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ui-card p-4 sm:p-5">
          <h2 className="text-lg font-semibold tracking-tight text-white">{t("recentActivity")}</h2>
          <ul className="mt-4 space-y-3">
            {activity.length === 0 && <li className="text-slate-500">{t("noData")}</li>}
            {activity.map((row) => (
              <li
                key={row.id}
                className="ui-card-soft rounded-xl px-4 py-3 text-sm text-slate-300"
              >
                <p>
                  {t("activityLine", {
                    name: row.employeeName,
                    event: eventLabel(row.eventType),
                    office: row.officeName || "—"
                  })}
                </p>
                <p className="mt-1 text-xs text-slate-500">{t("updateN", { n: row.index })}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
