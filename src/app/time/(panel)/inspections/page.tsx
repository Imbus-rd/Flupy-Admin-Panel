"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CalendarDateField } from "@/components/CalendarDateField";
import { apiFetch, ApiError, mediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { useI18n } from "@/lib/i18n";

type GroupKey =
  | "ATTENDANCE" | "PROFESSIONAL_IMAGE" | "VEHICLE" | "TOOLS" | "DRIVING"
  | "CUSTOMER_SERVICE" | "FIELD_SKILLS" | "EXTERNAL_LIMITATIONS" | "WORK_CLOSURE";

type InspectionRow = {
  id: string;
  mode: string;
  status: string;
  employeeStatus: string;
  technicianCard: string;
  technicianName: string;
  supervisorCard: string;
  supervisorName: string;
  auditorCard: string;
  auditorName: string;
  profileName: string;
  region: string;
  orderNumber: string;
  inspectionDate: string;
  startedAt: string;
  completedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  completedGroups: number;
  averageRating?: number | null;
  lowRatingGroups: number;
  photoCount: number;
  missingTools: number;
  groupRatings: Record<GroupKey, number | null>;
};

type ReportResponse = {
  items: InspectionRow[];
  truncated?: boolean;
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    cancelled: number;
    withFindings: number;
    averageRating?: number | null;
  };
};

type Options = {
  regions: string[];
  supervisors: PersonOption[];
  auditors: PersonOption[];
  profiles: { id: string; name: string }[];
  statuses: string[];
};

type PersonOption = { id: string; employee_code: string; full_name: string };

type InspectionDetail = {
  inspection: InspectionRow;
  groups: {
    id: string;
    groupKey: GroupKey;
    rating: number;
    comment?: string | null;
    answers: {
      criterionKey: string;
      valueText?: string | null;
      valueBoolean?: boolean | null;
      valueNumber?: number | null;
    }[];
  }[];
  photos: { id: string; photoType: string; photoUrl: string; capturedAt: string }[];
  tools: { toolId: string; toolName: string; required: boolean; hasTool: boolean }[];
};

type Filters = {
  fromDate: string;
  toDate: string;
  orderNumber: string;
  technician: string;
  supervisorId: string;
  auditorId: string;
  region: string;
  profileId: string;
  status: string;
};

const emptyFilters: Filters = {
  fromDate: "", toDate: "", orderNumber: "", technician: "", supervisorId: "",
  auditorId: "", region: "", profileId: "", status: ""
};

const emptyOptions: Options = { regions: [], supervisors: [], auditors: [], profiles: [], statuses: [] };

const groupKeys: GroupKey[] = [
  "ATTENDANCE", "PROFESSIONAL_IMAGE", "VEHICLE", "TOOLS", "DRIVING",
  "CUSTOMER_SERVICE", "FIELD_SKILLS", "EXTERNAL_LIMITATIONS", "WORK_CLOSURE"
];

function buildQuery(filters: Filters) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value.trim()) query.set(key, value.trim()); });
  return query.toString();
}

function statusTone(status: string) {
  if (status === "COMPLETED") return "bg-teal-400/10 text-teal-200";
  if (status === "CANCELLED") return "bg-rose-400/10 text-rose-200";
  return "bg-amber-400/10 text-amber-200";
}

export default function InspectionsPage() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [summary, setSummary] = useState<ReportResponse["summary"]>({
    total: 0, completed: 0, inProgress: 0, cancelled: 0, withFindings: 0, averageRating: null
  });
  const [options, setOptions] = useState<Options>(emptyOptions);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [detail, setDetail] = useState<InspectionDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const loadOptions = useCallback(async () => {
    if (!token) return;
    try {
      setOptions(await apiFetch<Options>("/quality-inspection-reports/options", { token }));
    } catch {
      setOptions(emptyOptions);
    }
  }, [token]);

  const load = useCallback(async (next: Filters) => {
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      const query = buildQuery(next);
      const data = await apiFetch<ReportResponse>(`/quality-inspection-reports${query ? `?${query}` : ""}`, { token });
      setRows(data.items || []);
      setSummary(data.summary);
      setTruncated(Boolean(data.truncated));
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : t("errorLoad"));
    } finally {
      setBusy(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (!token) return;
    void loadOptions();
    void load(emptyFilters);
  }, [token, load, loadOptions]);

  async function refresh() {
    await Promise.all([loadOptions(), load(filters)]);
  }

  async function openDetail(id: string) {
    if (!token) return;
    setDetailBusy(true);
    setMessage(null);
    try {
      setDetail(await apiFetch<InspectionDetail>(`/quality-inspections/${id}`, { token }));
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : t("errorLoad"));
    } finally {
      setDetailBusy(false);
    }
  }

  async function exportExcel() {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(t("inspectionSheetName"));
    sheet.columns = [
      { header: t("date"), key: "date", width: 15 },
      { header: t("order"), key: "order", width: 18 },
      { header: t("inspectionTechnician"), key: "technician", width: 30 },
      { header: t("employeeCode"), key: "technicianCard", width: 16 },
      { header: t("supervisor"), key: "supervisor", width: 28 },
      { header: t("inspectionAuditor"), key: "auditor", width: 28 },
      { header: t("employeesRegion"), key: "region", width: 18 },
      { header: t("inspectionProfile"), key: "profile", width: 34 },
      { header: t("status"), key: "status", width: 18 },
      { header: t("inspectionAverage"), key: "average", width: 15 },
      { header: t("inspectionFindings"), key: "findings", width: 16 },
      { header: t("inspectionMissingTools"), key: "missingTools", width: 18 },
      { header: t("inspectionPhotos"), key: "photos", width: 14 },
      { header: t("inspectionCoordinates"), key: "coordinates", width: 26 },
      ...groupKeys.map((key) => ({ header: t(`inspectionGroup${key}`), key, width: 24 }))
    ];
    rows.forEach((row) => sheet.addRow({
      date: row.inspectionDate,
      order: row.orderNumber,
      technician: row.technicianName,
      technicianCard: row.technicianCard,
      supervisor: `${row.supervisorName} (${row.supervisorCard})`,
      auditor: `${row.auditorName} (${row.auditorCard})`,
      region: row.region,
      profile: row.profileName,
      status: t(`inspectionStatus${row.status}`),
      average: row.averageRating ?? "",
      findings: row.lowRatingGroups,
      missingTools: row.missingTools,
      photos: row.photoCount,
      coordinates: row.latitude != null && row.longitude != null ? `${row.latitude}, ${row.longitude}` : "",
      ...Object.fromEntries(groupKeys.map((key) => [key, row.groupRatings[key] ?? ""]))
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).height = 28;
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + sheet.columnCount)}${Math.max(1, rows.length + 1)}` };
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `flupy-inspecciones-${new Date().toISOString().slice(0, 10)}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function formatAnswer(answer: InspectionDetail["groups"][number]["answers"][number]) {
    if (answer.valueBoolean != null) {
      return answer.valueBoolean ? t("inspectionComplies") : t("inspectionDoesNotComply");
    }
    if (answer.valueNumber != null) {
      return answer.criterionKey.endsWith("_minutes")
        ? t("inspectionMinutesValue", { value: answer.valueNumber })
        : String(answer.valueNumber);
    }
    if (answer.criterionKey === "limitations" && answer.valueText) {
      try {
        const values = JSON.parse(answer.valueText);
        if (Array.isArray(values)) {
          return values.map((value) => t(`inspectionLimitation${String(value)}`)).join(", ");
        }
      } catch {
        return answer.valueText;
      }
    }
    return answer.valueText || "—";
  }

  const field = "min-h-[42px] w-full rounded-lg border border-white/[0.1] bg-[rgba(3,6,14,0.7)] px-3 py-2 text-sm text-white outline-none focus:border-teal-400/40";
  const cards = [
    ["inspectionTotal", summary.total, "text-white"],
    ["inspectionCompleted", summary.completed, "text-teal-300"],
    ["inspectionInProgress", summary.inProgress, "text-amber-300"],
    ["inspectionWithFindings", summary.withFindings, "text-rose-300"],
    ["inspectionAverage", summary.averageRating == null ? "—" : `${summary.averageRating}/5`, "text-sky-300"]
  ];

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("inspectionsTitle")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("inspectionsSubtitle")}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => void refresh()} disabled={busy} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:border-teal-400/30 disabled:opacity-40">{busy ? t("loading") : t("inspectionRefresh")}</button>
        <button onClick={() => void exportExcel()} disabled={!rows.length} className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-40">{t("inspectionExport")}</button>
      </div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(([key, value, color]) => <div key={String(key)} className="ui-card p-4"><p className="text-xs uppercase text-slate-500">{t(String(key))}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>)}
    </section>

    <section className="ui-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <CalendarDateField id="inspection-from" label={t("filterFromDate")} value={filters.fromDate} onChange={(value) => setFilters((current) => ({ ...current, fromDate: value }))} openLabel={t("openCalendar")} />
        <CalendarDateField id="inspection-to" label={t("filterToDate")} value={filters.toDate} onChange={(value) => setFilters((current) => ({ ...current, toDate: value }))} openLabel={t("openCalendar")} />
        <input className={field} placeholder={t("order")} value={filters.orderNumber} onChange={(event) => setFilters((current) => ({ ...current, orderNumber: event.target.value }))} />
        <input className={field} placeholder={t("inspectionTechnicianFilter")} value={filters.technician} onChange={(event) => setFilters((current) => ({ ...current, technician: event.target.value }))} />
        <select className={field} value={filters.supervisorId} onChange={(event) => setFilters((current) => ({ ...current, supervisorId: event.target.value }))}><option value="">{t("warehouseAllSupervisors")}</option>{options.supervisors.map((person) => <option key={person.id} value={person.id}>{person.full_name} ({person.employee_code})</option>)}</select>
        <select className={field} value={filters.auditorId} onChange={(event) => setFilters((current) => ({ ...current, auditorId: event.target.value }))}><option value="">{t("inspectionAllAuditors")}</option>{options.auditors.map((person) => <option key={person.id} value={person.id}>{person.full_name} ({person.employee_code})</option>)}</select>
        <select className={field} value={filters.region} onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value }))}><option value="">{t("warehouseAllRegions")}</option>{options.regions.map((region) => <option key={region}>{region}</option>)}</select>
        <select className={field} value={filters.profileId} onChange={(event) => setFilters((current) => ({ ...current, profileId: event.target.value }))}><option value="">{t("inspectionAllProfiles")}</option>{options.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select>
        <select className={field} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">{t("inspectionAllStatuses")}</option>{options.statuses.map((status) => <option key={status} value={status}>{t(`inspectionStatus${status}`)}</option>)}</select>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => void load(filters)} className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400">{t("filterApply")}</button>
        <button onClick={() => { setFilters(emptyFilters); void load(emptyFilters); }} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:border-teal-400/30">{t("filterClear")}</button>
      </div>
    </section>

    {message && <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{message}</div>}
    {truncated && <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">{t("inspectionResultsLimited")}</div>}

    <section className="ui-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase text-slate-500"><tr>{["date", "order", "inspectionTechnician", "supervisor", "inspectionAuditor", "employeesRegion", "inspectionProfile", "status", "inspectionAverage", "inspectionFindings", "actions"].map((key) => <th key={key} className="px-3 py-3">{t(key)}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((row) => <tr key={row.id} className="hover:bg-white/[0.025]">
              <td className="whitespace-nowrap px-3 py-3">{new Date(row.inspectionDate).toLocaleDateString(locale)}</td>
              <td className="px-3 py-3 font-mono text-teal-200">{row.orderNumber}</td>
              <td className="px-3 py-3"><div>{row.technicianName}</div><div className="text-xs text-slate-500">{row.technicianCard}</div></td>
              <td className="px-3 py-3"><div>{row.supervisorName}</div><div className="text-xs text-slate-500">{row.supervisorCard}</div></td>
              <td className="px-3 py-3"><div>{row.auditorName}</div><div className="text-xs text-slate-500">{row.auditorCard}</div></td>
              <td className="px-3 py-3">{row.region}</td>
              <td className="min-w-56 px-3 py-3">{row.profileName}</td>
              <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs ${statusTone(row.status)}`}>{t(`inspectionStatus${row.status}`)}</span></td>
              <td className="px-3 py-3 font-semibold">{row.averageRating == null ? "—" : `${row.averageRating}/5`}</td>
              <td className="px-3 py-3">{row.lowRatingGroups || row.missingTools ? <span className="text-rose-300">{row.lowRatingGroups + row.missingTools}</span> : <span className="text-teal-300">0</span>}</td>
              <td className="px-3 py-3"><button onClick={() => void openDetail(row.id)} disabled={detailBusy} className="whitespace-nowrap text-teal-300 hover:text-teal-200">{t("inspectionView")}</button></td>
            </tr>)}
            {!rows.length && !busy && <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-500">{t("inspectionNoResults")}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4" onClick={() => setDetail(null)}>
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-white/[0.12] bg-[#070b13] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{t("inspectionDetailTitle")}</h2><p className="mt-1 text-sm text-slate-400">{detail.inspection.technicianName} · {detail.inspection.orderNumber}</p></div><button onClick={() => setDetail(null)} className="rounded-lg border border-white/10 px-3 py-2 text-sm">{t("close")}</button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
          [t("inspectionTechnician"), `${detail.inspection.technicianName} (${detail.inspection.technicianCard})`],
          [t("supervisor"), detail.inspection.supervisorName], [t("inspectionAuditor"), detail.inspection.auditorName],
          [t("employeesRegion"), detail.inspection.region], [t("inspectionProfile"), detail.inspection.profileName],
          [t("status"), t(`inspectionStatus${detail.inspection.status}`)], [t("date"), new Date(detail.inspection.inspectionDate).toLocaleDateString(locale)],
          [t("inspectionCoordinates"), detail.inspection.latitude != null && detail.inspection.longitude != null ? `${detail.inspection.latitude}, ${detail.inspection.longitude}` : "—"]
        ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/[0.08] bg-[#0b111b] p-3"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-1 text-sm text-slate-100">{value}</p></div>)}</div>
        <h3 className="mt-6 text-base font-semibold">{t("inspectionGroupResults")}</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{detail.groups.map((group) => <div key={group.id} className="rounded-lg border border-white/[0.08] bg-[#0b111b] p-4"><div className="flex items-center justify-between"><p className="font-medium">{t(`inspectionGroup${group.groupKey}`)}</p><span className="text-lg font-bold text-teal-300">{group.rating}/5</span></div><p className="mt-2 text-sm text-slate-400">{group.comment || t("inspectionNoComment")}</p><div className="mt-3 space-y-1 text-xs text-slate-500">{group.answers.map((answer) => <div key={answer.criterionKey} className="flex justify-between gap-3"><span>{t(`inspectionCriterion${answer.criterionKey}`)}</span><span className="text-right text-slate-300">{formatAnswer(answer)}</span></div>)}</div></div>)}</div>
        {!!detail.tools.length && <><h3 className="mt-6 text-base font-semibold">{t("inspectionTools")}</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{detail.tools.map((tool) => <div key={tool.toolId} className={`rounded-lg border bg-[#0b111b] px-3 py-2 text-sm ${tool.hasTool ? "border-teal-400/20 text-teal-200" : "border-rose-400/20 text-rose-200"}`}>{tool.toolName}: {tool.hasTool ? t("yes") : t("no")}</div>)}</div></>}
        {!!detail.photos.length && <><h3 className="mt-6 text-base font-semibold">{t("inspectionPhotos")}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{detail.photos.map((photo) => <div key={photo.id} className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#0b111b]"><Image unoptimized src={mediaUrl(photo.photoUrl)} alt={t(`inspectionPhoto${photo.photoType}`)} width={900} height={650} className="aspect-[4/3] w-full object-cover" /><div className="p-2 text-xs text-slate-400">{t(`inspectionPhoto${photo.photoType}`)}</div></div>)}</div></>}
      </div>
    </div>}
  </div>;
}
