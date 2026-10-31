"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import { CalendarDateField } from "@/components/CalendarDateField";
import { QualityLightbox, type LightboxPhoto } from "@/components/QualityLightbox";
import { WifiAdvisoryReviewDialog, type WifiAdvisoryDetail } from "@/components/WifiAdvisoryReviewDialog";
import { WifiAdvisoryConfigPanel } from "@/components/WifiAdvisoryConfigPanel";
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
  wifiRequired: boolean;
  wifiStatus: string;
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
  const { token, employee: authEmployee } = useAuth();
  const readOnly = authEmployee?.role === "SUPERVISOR";
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
  const [wifiReview, setWifiReview] = useState<{
    qualityId: string;
    orderId: string;
    technician: string;
    detail: WifiAdvisoryDetail;
  } | null>(null);

  const scopedRegion = useMemo(() => {
    const r = authEmployee?.region;
    return r != null && String(r).trim() !== "" ? String(r).trim() : null;
  }, [authEmployee?.region]);

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

  const exportWifiExcel = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ limit: "1000" });
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (filterEmployeeCode.trim()) params.set("employeeCode", filterEmployeeCode.trim());
      if (filterOrderId.trim()) params.set("orderNumber", filterOrderId.trim());
      const response = await apiFetch<{ items: Array<Record<string, unknown>> }>(`/admin/wifi-advisories?${params}`, { token });
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Asesorías WiFi");
      sheet.columns = [
        { header: "Fecha", key: "created_at", width: 22 },
        { header: "Orden", key: "order_number", width: 18 },
        { header: "Técnico", key: "technician_name", width: 28 },
        { header: "Tarjeta", key: "employee_code", width: 14 },
        { header: "Región", key: "region_name", width: 16 },
        { header: "Tipo de trabajo", key: "work_type", width: 28 },
        { header: "Estado", key: "status", width: 24 },
        { header: "Puntos", key: "point_count", width: 10 },
        { header: "Señal más débil (dBm)", key: "weakest_rssi", width: 22 },
        { header: "Respuesta del cliente", key: "client_response", width: 22 },
        { header: "Diagnóstico", key: "diagnosis", width: 50 },
        { header: "Recomendación", key: "recommendation", width: 50 }
      ];
      response.items.forEach((item) => sheet.addRow(item));
      sheet.getRow(1).font = { bold: true };
      sheet.autoFilter = { from: "A1", to: "L1" };
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `flupy-asesorias-wifi-${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : "No se pudo exportar el reporte WiFi.");
    } finally {
      setBusy(false);
    }
  }, [token, fromDate, toDate, filterEmployeeCode, filterOrderId]);

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

  const openWifiReview = useCallback(async (q: QItem) => {
    if (!token) return;
    setErr(null);
    try {
      const detail = await apiFetch<{ wifiAdvisory?: WifiAdvisoryDetail | null }>(`/admin/quality/${q.id}`, { token });
      if (!detail.wifiAdvisory) {
        setErr("La asesoría WiFi todavía no ha sido iniciada para esta orden.");
        return;
      }
      setWifiReview({ qualityId: q.id, orderId: q.orderId, technician: q.technicianName, detail: detail.wifiAdvisory });
    } catch (cause) {
      setErr(cause instanceof ApiError ? cause.message : t("errorLoad"));
    }
  }, [token, t]);

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
          {scopedRegion && (
            <p className="mt-2 text-xs text-amber-200/90">
              {t("qualityScopedBanner", { region: scopedRegion })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void exportWifiExcel()}
            disabled={busy}
            className="self-start rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm text-sky-200 transition hover:bg-sky-400/20 disabled:opacity-50"
          >
            Exportar WiFi a Excel
          </button>
          <button
            type="button"
            onClick={() =>
              void fetchItems(fromDate, toDate, filterUserId, filterEmployeeCode, filterOrderId, filterUiStatus, filterInspectorDecision)
            }
            className="self-start rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-slate-200 backdrop-blur-sm transition hover:border-teal-400/30"
          >
            {t("retry")}
          </button>
        </div>
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

      {authEmployee?.role === "ADMIN" && token && <WifiAdvisoryConfigPanel token={token} />}

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
                    <div className="flex justify-end gap-2">
                      {q.wifiRequired && (
                        <button
                          type="button"
                          onClick={() => void openWifiReview(q)}
                          className="rounded-lg border border-sky-400/35 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-200 transition hover:bg-sky-400/20"
                        >
                          WiFi · {q.wifiStatus === "APPROVED" ? "Aprobada" : q.wifiStatus === "REJECTED" ? "Rechazada" : "Pendiente"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void openGallery(q)}
                        className="rounded-lg border border-teal-400/35 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-200 transition hover:bg-teal-400/18"
                      >
                        {t("qualityClickRow")}
                      </button>
                    </div>
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
              {q.wifiRequired && (
                <button
                  type="button"
                  onClick={() => void openWifiReview(q)}
                  className="mt-2 w-full rounded-xl border border-sky-400/35 bg-sky-400/10 py-2.5 text-sm font-medium text-sky-200 transition hover:bg-sky-400/20"
                >
                  Asesoría WiFi · {q.wifiStatus === "APPROVED" ? "Aprobada" : q.wifiStatus === "REJECTED" ? "Rechazada" : "Pendiente"}
                </button>
              )}
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
          readOnly={readOnly}
          busy={busy}
        />
      )}
      {wifiReview && (
        <WifiAdvisoryReviewDialog
          open
          token={token}
          orderId={wifiReview.orderId}
          technician={wifiReview.technician}
          detail={wifiReview.detail}
          readOnly={readOnly}
          onClose={() => setWifiReview(null)}
          onReviewed={(status) => {
            setWifiReview((current) => current ? { ...current, detail: { ...current.detail, status } } : current);
            void fetchItems(fromDate, toDate, filterUserId, filterEmployeeCode, filterOrderId, filterUiStatus, filterInspectorDecision);
          }}
        />
      )}
    </div>
  );
}
