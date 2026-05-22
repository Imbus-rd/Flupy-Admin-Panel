"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import { CalendarDateField } from "@/components/CalendarDateField";
import { formatReportingDateTime } from "@/lib/timezone";

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
      const id = String(r.id ?? `row-${index}`);
      const fullName = String(r.fullName ?? r.full_name ?? "").trim() || "—";
      const employeeCode = String(r.employeeCode ?? r.employee_code ?? "").trim() || "—";
      const eventType = String(r.eventType ?? r.event_type ?? "").trim() || "UNKNOWN";
      const occurredAt = String(r.occurredAt ?? r.occurred_at ?? "").trim();
      const workdayDate = String(r.workdayDate ?? r.workday_date ?? "").trim();
      const onTime = r.onTime === true || r.onTime === 1 || r.on_time === 1;
      return { id, fullName, employeeCode, eventType, occurredAt, workdayDate, onTime };
    })
    .filter((row): row is AttRow => row != null);
}

function buildAttendanceQuery(fromDate: string, toDate: string, lateOnly: boolean): string {
  const qs = new URLSearchParams();
  qs.set("limit", "120");
  if (fromDate) qs.set("fromDate", fromDate);
  if (toDate) qs.set("toDate", toDate);
  if (lateOnly) qs.set("lateOnly", "true");
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export default function AttendancePage() {
  const { t, locale } = useI18n();
  const { token, employee: authEmployee } = useAuth();
  const [items, setItems] = useState<AttRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [lateOnly, setLateOnly] = useState(false);

  const scopedRegion = useMemo(() => {
    const r = authEmployee?.region;
    return r != null && String(r).trim() !== "" ? String(r).trim() : null;
  }, [authEmployee?.region]);

  const fetchWithParams = useCallback(
    async (from: string, to: string, late: boolean) => {
      if (!token) return;
      setErr(null);
      try {
        const query = buildAttendanceQuery(from, to, late);
        const data = await apiFetch<unknown>(`/admin/attendance/recent${query}`, { token });
        setItems(normalizeAttendanceRows(data));
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : t("errorLoad"));
      }
    },
    [token, t]
  );

  useEffect(() => {
    if (token) void fetchWithParams("", "", false);
  }, [token, fetchWithParams]);

  const applyFilters = useCallback(() => {
    void fetchWithParams(fromDate, toDate, lateOnly);
  }, [fetchWithParams, fromDate, toDate, lateOnly]);

  const clearFilters = useCallback(() => {
    setFromDate("");
    setToDate("");
    setLateOnly(false);
    void fetchWithParams("", "", false);
  }, [fetchWithParams]);

  function eventLabel(type: string) {
    const key = `event${type}` as const;
    const v = t(key);
    return v === key ? type : v;
  }

  function fmtDate(iso: string) {
    return formatReportingDateTime(iso, locale, { includeSeconds: true });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("attendanceTitle")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("attendanceSubtitle")}</p>
          {scopedRegion && (
            <p className="mt-2 text-xs text-amber-200/90">
              {t("attendanceScopedBanner", { region: scopedRegion })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void fetchWithParams(fromDate, toDate, lateOnly)}
          className="self-start rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-slate-200 backdrop-blur-sm transition hover:border-teal-400/30"
        >
          {t("retry")}
        </button>
      </div>
      {err && <p className="text-sm text-rose-400">{err}</p>}

      <section className="ui-card space-y-4 rounded-2xl p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CalendarDateField
            id="att-from"
            label={t("attendanceFilterFromDate")}
            value={fromDate}
            onChange={setFromDate}
            openLabel={t("openCalendar")}
          />
          <CalendarDateField
            id="att-to"
            label={t("attendanceFilterToDate")}
            value={toDate}
            onChange={setToDate}
            openLabel={t("openCalendar")}
          />
          <div className="flex flex-col justify-end sm:col-span-2 lg:col-span-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={lateOnly}
                onChange={(e) => setLateOnly(e.target.checked)}
                className="rounded border-white/20 bg-[rgba(3,6,14,0.8)] text-teal-400"
              />
              {t("attendanceLateOnly")}
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={() => void applyFilters()}
              className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:from-teal-400 hover:to-emerald-400"
            >
              {t("attendanceApplyFilters")}
            </button>
            <button
              type="button"
              onClick={() => {
                clearFilters();
              }}
              className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:border-teal-400/30"
            >
              {t("attendanceClearFilters")}
            </button>
          </div>
        </div>
      </section>

      <div className="ui-table-wrap scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-medium">{t("name")}</th>
              <th className="px-4 py-3 font-medium">{t("employeeCode")}</th>
              <th className="px-4 py-3 font-medium">{t("eventType")}</th>
              <th className="px-4 py-3 font-medium">{t("status")}</th>
              <th className="px-4 py-3 font-medium">{t("occurredAt")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  {t("noData")}
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 font-medium text-white">{row.fullName}</td>
                <td className="px-4 py-3 font-mono text-xs text-teal-200/80">{row.employeeCode}</td>
                <td className="px-4 py-3">{eventLabel(row.eventType)}</td>
                <td className="px-4 py-3">
                  {row.eventType === "CHECK_IN" ? (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        row.onTime ? "bg-teal-500/15 text-teal-200" : "bg-amber-500/15 text-amber-200"
                      }`}
                    >
                      {row.onTime ? t("onTime") : t("late")}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400">{fmtDate(row.occurredAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
