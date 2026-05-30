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

type AttendanceStatus = "ON_TIME" | "LATE" | "MOVEMENT";
type AttendanceStatusFilter = "ALL" | AttendanceStatus;

const REPORTING_TIME_ZONE = "America/Santo_Domingo";
const ON_TIME_CUTOFF_SECONDS = 8 * 60 * 60 + 5 * 60;

function normalizeAttendanceRows(raw: unknown): AttRow[] {
  if (!raw || typeof raw !== "object" || !("items" in raw)) return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? `row-${index}`);
      const fullName = String(r.fullName ?? r.full_name ?? "").trim() || "-";
      const employeeCode = String(r.employeeCode ?? r.employee_code ?? "").trim() || "-";
      const eventType = String(r.eventType ?? r.event_type ?? "").trim() || "UNKNOWN";
      const occurredAt = String(r.occurredAt ?? r.occurred_at ?? "").trim();
      const workdayDate = String(r.workdayDate ?? r.workday_date ?? "").trim();
      const onTime = r.onTime === true || r.onTime === 1 || r.on_time === 1;
      return { id, fullName, employeeCode, eventType, occurredAt, workdayDate, onTime };
    })
    .filter((row): row is AttRow => row != null);
}

function buildAttendanceQuery(fromDate: string, toDate: string): string {
  const qs = new URLSearchParams();
  qs.set("limit", "120");
  if (fromDate) qs.set("fromDate", fromDate);
  if (toDate) qs.set("toDate", toDate);
  const q = qs.toString();
  return q ? `?${q}` : "";
}

function getReportingTimeSeconds(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORTING_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");
  if (![hour, minute, second].every(Number.isFinite)) return null;
  return hour * 60 * 60 + minute * 60 + second;
}

function attendanceStatus(row: AttRow): AttendanceStatus {
  if (row.eventType !== "CHECK_IN") return "MOVEMENT";
  const seconds = getReportingTimeSeconds(row.occurredAt);
  if (seconds == null) return row.onTime ? "ON_TIME" : "LATE";
  return seconds <= ON_TIME_CUTOFF_SECONDS ? "ON_TIME" : "LATE";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function AttendancePage() {
  const { t, locale } = useI18n();
  const { token, employee: authEmployee } = useAuth();
  const [items, setItems] = useState<AttRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatusFilter>("ALL");

  const scopedRegion = useMemo(() => {
    const r = authEmployee?.region;
    return r != null && String(r).trim() !== "" ? String(r).trim() : null;
  }, [authEmployee?.region]);

  const fetchWithParams = useCallback(
    async (from: string, to: string) => {
      if (!token) return;
      setErr(null);
      try {
        const query = buildAttendanceQuery(from, to);
        const data = await apiFetch<unknown>(`/admin/attendance/recent${query}`, { token });
        setItems(normalizeAttendanceRows(data));
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : t("errorLoad"));
      }
    },
    [token, t]
  );

  useEffect(() => {
    if (token) void fetchWithParams("", "");
  }, [token, fetchWithParams]);

  const applyFilters = useCallback(() => {
    void fetchWithParams(fromDate, toDate);
  }, [fetchWithParams, fromDate, toDate]);

  const clearFilters = useCallback(() => {
    setFromDate("");
    setToDate("");
    setStatusFilter("ALL");
    void fetchWithParams("", "");
  }, [fetchWithParams]);

  function eventLabel(type: string) {
    const key = `event${type}` as const;
    const v = t(key);
    return v === key ? type : v;
  }

  function fmtDate(iso: string) {
    return formatReportingDateTime(iso, locale, { includeSeconds: true });
  }

  function statusLabel(status: AttendanceStatus) {
    if (status === "ON_TIME") return t("onTime");
    if (status === "LATE") return t("late");
    return t("attendanceMovements");
  }

  const filteredItems = useMemo(
    () => items.filter((row) => statusFilter === "ALL" || attendanceStatus(row) === statusFilter),
    [items, statusFilter]
  );

  function exportToExcel() {
    const headers = [t("name"), t("employeeCode"), t("eventType"), t("status"), t("occurredAt")];
    const rows = filteredItems.map((row) => {
      const status = attendanceStatus(row);
      return [
        row.fullName,
        row.employeeCode,
        eventLabel(row.eventType),
        statusLabel(status),
        fmtDate(row.occurredAt)
      ];
    });
    const tableRows = [headers, ...rows]
      .map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`)
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${tableRows}</table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `asistencia-${stamp}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
          onClick={() => void fetchWithParams(fromDate, toDate)}
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
          <div>
            <label htmlFor="att-status" className="block text-xs font-medium text-slate-400">
              {t("attendanceStatusFilter")}
            </label>
            <select
              id="att-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AttendanceStatusFilter)}
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
            >
              <option value="ALL">{t("attendanceStatusAll")}</option>
              <option value="ON_TIME">{t("onTime")}</option>
              <option value="LATE">{t("late")}</option>
              <option value="MOVEMENT">{t("attendanceMovements")}</option>
            </select>
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
            <button
              type="button"
              onClick={exportToExcel}
              disabled={filteredItems.length === 0}
              className="rounded-xl border border-teal-400/30 bg-teal-400/10 px-4 py-2.5 text-sm font-medium text-teal-100 transition hover:bg-teal-400/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("attendanceExportExcel")}
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
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  {t("noData")}
                </td>
              </tr>
            )}
            {filteredItems.map((row) => {
              const status = attendanceStatus(row);
              return (
                <tr key={row.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-white">{row.fullName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-teal-200/80">{row.employeeCode}</td>
                  <td className="px-4 py-3">{eventLabel(row.eventType)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        status === "ON_TIME"
                          ? "bg-teal-500/15 text-teal-200"
                          : status === "LATE"
                            ? "bg-amber-500/15 text-amber-200"
                            : "bg-slate-500/10 text-slate-300"
                      }`}
                    >
                      {statusLabel(status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{fmtDate(row.occurredAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
