"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import { CalendarDateField } from "@/components/CalendarDateField";
import { QualityLightbox, type LightboxPhoto } from "@/components/QualityLightbox";
import { formatReportingDateTime } from "@/lib/timezone";

type QItem = {
  id: string;
  userId: string;
  orderId: string;
  workType: string;
  status: string;
  inspectorDecision: string;
  technicianName: string;
  technicianCode: string;
  photoCount: number;
  anyFe: boolean;
  createdAt: string;
};

function inspectorDecisionLabel(decision: string, t: (k: string) => string) {
  const d = String(decision || "NONE").toUpperCase();
  if (d === "OK") return t("uiStatusOk");
  if (d === "FE") return t("uiStatusFe");
  if (d === "ERROR") return t("uiStatusError");
  return t("qualityPhotoNotReviewed");
}

type EmpOption = { id: string; employeeCode: string; fullName: string };

function badgeForItem(item: QItem, t: (k: string) => string) {
  if (item.status === "APPROVED" || item.inspectorDecision === "OK") {
    return { label: t("uiStatusOk"), className: "bg-teal-500/15 text-teal-200 ring-teal-500/30" };
  }
  if (item.status === "REJECTED" || item.inspectorDecision === "ERROR") {
    return { label: t("uiStatusError"), className: "bg-rose-500/15 text-rose-300 ring-rose-500/30" };
  }
  if (item.inspectorDecision === "FE" || item.anyFe) {
    return { label: t("uiStatusFe"), className: "bg-amber-500/15 text-amber-200 ring-amber-500/35" };
  }
  return { label: t("uiStatusInProgress"), className: "bg-sky-500/10 text-sky-200 ring-sky-500/25" };
}

type QualityUiStatusFilter = "" | "IN_PROGRESS" | "FE" | "ERROR" | "OK";

/** Matches `qualities.inspector_decision` (NONE = pending / not reviewed). */
type InspectorDecisionFilter = "" | "NONE" | "FE" | "ERROR" | "OK";

function buildQualityQuery(
  fromDate: string,
  toDate: string,
  userId: string,
  employeeCode: string,
  orderId: string,
  uiStatus: QualityUiStatusFilter,
  inspectorDecision: InspectorDecisionFilter
): string {
  const qs = new URLSearchParams();
  if (fromDate) qs.set("fromDate", fromDate);
  if (toDate) qs.set("toDate", toDate);
  if (userId) qs.set("employeeId", userId);
  const code = employeeCode.trim();
  if (code) qs.set("employeeCode", code);
  const ord = orderId.trim();
  if (ord) qs.set("orderId", ord);
  if (uiStatus) qs.set("uiStatus", uiStatus);
  if (inspectorDecision) qs.set("inspectorDecision", inspectorDecision);
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export default function QualityPage() {
  const { t, locale } = useI18n();
  const { token } = useAuth();
  const [items, setItems] = useState<QItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmpOption[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterEmployeeCode, setFilterEmployeeCode] = useState("");
  const [filterOrderId, setFilterOrderId] = useState("");
  const [filterUiStatus, setFilterUiStatus] = useState<QualityUiStatusFilter>("");
  const [filterInspectorDecision, setFilterInspectorDecision] = useState<InspectorDecisionFilter>("");
  const [lightbox, setLightbox] = useState<{
    qualityId: string;
    orderId: string;
    photos: LightboxPhoto[];
    index: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchItems = useCallback(
    async (
      from: string,
      to: string,
      user: string,
      employeeCode: string,
      orderId: string,
      status: QualityUiStatusFilter,
      inspectorDecision: InspectorDecisionFilter
    ) => {
      if (!token) return;
      setErr(null);
      try {
        const query = buildQualityQuery(from, to, user, employeeCode, orderId, status, inspectorDecision);
        const data = await apiFetch<{ items: QItem[] }>(`/admin/quality/items${query}`, { token });
        setItems(data.items || []);
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : t("errorLoad"));
      }
    },
    [token, t]
  );

  const fetchItemsRef = useRef(fetchItems);
  fetchItemsRef.current = fetchItems;

  useEffect(() => {
    if (!token) return;
    void fetchItemsRef.current("", "", "", "", "", "", "");
  }, [token]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ items: EmpOption[] }>("/employees", { token })
      .then((d) => setEmployees(d.items || []))
      .catch(() => setEmployees([]));
  }, [token]);

  const applyFilters = useCallback(() => {
    void fetchItems(
      fromDate,
      toDate,
      filterUserId,
      filterEmployeeCode,
      filterOrderId,
      filterUiStatus,
      filterInspectorDecision
    );
  }, [
    fetchItems,
    fromDate,
    toDate,
    filterUserId,
    filterEmployeeCode,
    filterOrderId,
    filterUiStatus,
    filterInspectorDecision
  ]);

  const clearFilters = useCallback(() => {
    setFromDate("");
    setToDate("");
    setFilterUserId("");
    setFilterEmployeeCode("");
    setFilterOrderId("");
    setFilterUiStatus("");
    setFilterInspectorDecision("");
    void fetchItems("", "", "", "", "", "", "");
  }, [fetchItems]);

  const openGallery = useCallback(
    async (q: QItem) => {
      if (!token) return;
      setErr(null);
      try {
        const detail = await apiFetch<{
          id: string;
          orderId?: string;
          customerMobile?: string | null;
          photos: {
            id: string;
            photoUrl: string;
            photoType: string;
            employeeCode?: string | null;
            latitude?: number | null;
            longitude?: number | null;
            capturedAt?: string | null;
            inspectorDecision?: string;
            inspectorComment?: string | null;
            fe?: boolean;
            feComment?: string | null;
          }[];
        }>(`/admin/quality/${q.id}`, { token });
        const photos = (detail.photos || []).map((p) => ({
          id: p.id,
          photoUrl: p.photoUrl,
          photoType: p.photoType,
          employeeCode: p.employeeCode ?? q.technicianCode,
          customerMobile: detail.customerMobile ?? null,
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          capturedAt: p.capturedAt ?? null,
          inspectorDecision: String(p.inspectorDecision || "NONE").toUpperCase(),
          inspectorComment: p.inspectorComment ?? null,
          fe: Boolean(p.fe),
          feComment: p.feComment ?? null
        }));
        if (!photos.length) {
          setErr(t("qualityNoPhotos"));
          return;
        }
        const oid = String(detail.orderId ?? q.orderId ?? "").trim();
        setLightbox({ qualityId: detail.id, orderId: oid, photos, index: 0 });
      } catch {
        setErr(t("errorLoad"));
      }
    },
    [token, t]
  );

  const onPhotoDecision = useCallback(
    async (
      photoId: string,
      decision: "FE" | "ERROR" | "OK",
      comment?: string | null
    ): Promise<boolean> => {
      if (!token || !lightbox) return false;
      setBusy(true);
      try {
        await apiFetch(`/admin/quality/${lightbox.qualityId}/review`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            photoId,
            decision,
            ...(decision === "OK" ? {} : { comment: comment ?? "" })
          })
        });
        setLightbox((s) => {
          if (!s) return s;
          return {
            ...s,
            photos: s.photos.map((p) =>
              p.id === photoId
                ? {
                    ...p,
                    inspectorDecision: decision,
                    inspectorComment: decision === "OK" ? null : (comment ?? "").trim()
                  }
                : p
            )
          };
        });
        await fetchItems(
          fromDate,
          toDate,
          filterUserId,
          filterEmployeeCode,
          filterOrderId,
          filterUiStatus,
          filterInspectorDecision
        );
        return true;
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : t("errorLoad"));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [
      token,
      lightbox,
      fetchItems,
      t,
      fromDate,
      toDate,
      filterUserId,
      filterEmployeeCode,
      filterOrderId,
      filterUiStatus,
      filterInspectorDecision
    ]
  );

  function fmt(iso: string) {
    return formatReportingDateTime(iso, locale);
  }

  const inputClass =
    "mt-1.5 w-full min-h-[44px] rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("qualityTitle")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("qualitySubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            void fetchItems(
              fromDate,
              toDate,
              filterUserId,
              filterEmployeeCode,
              filterOrderId,
              filterUiStatus,
              filterInspectorDecision
            )
          }
          className="self-start rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-slate-200 backdrop-blur-sm transition hover:border-teal-400/30"
        >
          {t("retry")}
        </button>
      </div>

      <section className="ui-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <CalendarDateField
            id="quality-filter-from"
            label={t("filterFromDate")}
            value={fromDate}
            onChange={setFromDate}
            openLabel={`${t("openCalendar")} — ${t("filterFromDate")}`}
          />
          <CalendarDateField
            id="quality-filter-to"
            label={t("filterToDate")}
            value={toDate}
            onChange={setToDate}
            openLabel={`${t("openCalendar")} — ${t("filterToDate")}`}
          />
          <div>
            <label className="block text-xs font-medium text-slate-400">{t("filterEmployeeCode")}</label>
            <input
              type="text"
              value={filterEmployeeCode}
              onChange={(e) => setFilterEmployeeCode(e.target.value)}
              placeholder={t("filterEmployeeCodePlaceholder")}
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">{t("filterOrderId")}</label>
            <input
              type="text"
              value={filterOrderId}
              onChange={(e) => setFilterOrderId(e.target.value)}
              placeholder={t("filterOrderIdPlaceholder")}
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">{t("filterEmployee")}</label>
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className={inputClass}
            >
              <option value="">{t("filterAllEmployees")}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.employeeCode})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">{t("filterStatus")}</label>
            <select
              value={filterUiStatus}
              onChange={(e) => setFilterUiStatus(e.target.value as QualityUiStatusFilter)}
              className={inputClass}
            >
              <option value="">{t("filterStatusAll")}</option>
              <option value="IN_PROGRESS">{t("uiStatusInProgress")}</option>
              <option value="FE">{t("uiStatusFe")}</option>
              <option value="ERROR">{t("uiStatusError")}</option>
              <option value="OK">{t("uiStatusOk")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">{t("filterInspectorDecision")}</label>
            <select
              value={filterInspectorDecision}
              onChange={(e) => setFilterInspectorDecision(e.target.value as InspectorDecisionFilter)}
              className={inputClass}
            >
              <option value="">{t("filterInspectorDecisionAll")}</option>
              <option value="NONE">{t("filterInspectorDecisionPending")}</option>
              <option value="FE">{t("uiStatusFe")}</option>
              <option value="ERROR">{t("uiStatusError")}</option>
              <option value="OK">{t("uiStatusOk")}</option>
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-2 xl:justify-end">
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/25 transition hover:from-teal-400 hover:to-emerald-400"
            >
              {t("filterApply")}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 backdrop-blur-sm transition hover:border-teal-400/30"
            >
              {t("filterClear")}
            </button>
          </div>
        </div>
      </section>

      {err && <p className="text-sm text-rose-400">{err}</p>}

      {/* Desktop: table — no thumbnails; open row to load photos */}
      <div className="ui-table-wrap hidden md:block">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-medium">{t("filterStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("date")}</th>
              <th className="px-4 py-3 font-medium">{t("filterOrderId")}</th>
              <th className="px-4 py-3 font-medium">{t("workType")}</th>
              <th className="px-4 py-3 font-medium">{t("inspectorDecision")}</th>
              <th className="px-4 py-3 font-medium">{t("filterEmployeeCode")}</th>
              <th className="px-4 py-3 font-medium">{t("technician")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("qualityPhotoCount")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                  {t("noData")}
                </td>
              </tr>
            )}
            {items.map((q) => {
              const b = badgeForItem(q, t);
              return (
                <tr key={q.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${b.className}`}>
                      {b.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-400">{fmt(q.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-teal-200/90">{q.orderId}</td>
                  <td className="px-4 py-3 text-slate-400">{q.workType}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {inspectorDecisionLabel(q.inspectorDecision, t)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{q.technicianCode}</td>
                  <td className="px-4 py-3 text-white">{q.technicianName}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{q.photoCount}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void openGallery(q)}
                      className="rounded-lg border border-teal-400/35 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-200 transition hover:bg-teal-400/18"
                    >
                      {t("qualityClickRow")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: compact cards, no images */}
      <div className="space-y-3 md:hidden">
        {items.length === 0 && (
          <p className="rounded-3xl border border-dashed border-white/[0.1] py-16 text-center text-slate-500">
            {t("noData")}
          </p>
        )}
        {items.map((q) => {
          const b = badgeForItem(q, t);
          return (
            <article
              key={q.id}
              className="ui-card-soft rounded-2xl p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${b.className}`}>
                  {b.label}
                </span>
                <span className="text-xs text-slate-500">{fmt(q.createdAt)}</span>
              </div>
              <p className="mt-2 font-mono text-sm text-teal-200/90">
                {t("filterOrderId")}: {q.orderId}
              </p>
              <p className="text-xs text-slate-400">{q.workType}</p>
              <p className="text-xs text-slate-500">
                {t("inspectorDecision")}: {inspectorDecisionLabel(q.inspectorDecision, t)}
              </p>
              <div className="mt-2 border-t border-white/5 pt-2">
                <p className="text-xs text-slate-500">
                  {q.technicianName} · <span className="font-mono">{q.technicianCode}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t("qualityPhotoCount")}: {q.photoCount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void openGallery(q)}
                className="mt-3 w-full rounded-xl border border-teal-400/35 bg-teal-400/10 py-2.5 text-sm font-medium text-teal-200 transition hover:bg-teal-400/18"
              >
                {t("qualityClickRow")}
              </button>
            </article>
          );
        })}
      </div>

      {lightbox && (
        <QualityLightbox
          open
          qualityId={lightbox.qualityId}
          orderId={lightbox.orderId}
          token={token}
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox((s) => (s ? { ...s, index: i } : s))}
          onPhotoDecision={onPhotoDecision}
          busy={busy}
        />
      )}
    </div>
  );
}
