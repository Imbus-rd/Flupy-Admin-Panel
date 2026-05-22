"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import { formatReportingDateTime } from "@/lib/timezone";

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
  const { token } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [activity, setActivity] = useState<ActRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [statsReplayKey, setStatsReplayKey] = useState(0);

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

  useEffect(() => {
    load();
  }, [load]);

  function eventLabel(type: string) {
    const key = `event${type}` as const;
    const v = t(key);
    return v === key ? type : v;
  }

  function fmtDate(iso: string) {
    return formatReportingDateTime(iso, locale);
  }

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
