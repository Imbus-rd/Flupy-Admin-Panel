"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { apiFetch, ApiError, getApiBase } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { CalendarDateField } from "@/components/CalendarDateField";

type SerialRow = {
  id: string;
  comparisonStatus: "MATCHED" | "REGISTERED_ONLY" | "IMPORTED_ONLY";
  serialNumber: string;
  equipmentType: string;
  registeredEquipmentType?: string | null;
  importedEquipmentType?: string | null;
  orderId?: string | null;
  orderLatitude?: number | null;
  orderLongitude?: number | null;
  workType?: string | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  region?: string | null;
  supervisorId?: string | null;
  supervisorCode?: string | null;
  supervisorName?: string | null;
  capturedAt?: string | null;
  serialMethod?: string | null;
  serialConfidence?: number | null;
  qualityId?: string | null;
  photoId?: string | null;
  imageAvailable: boolean;
  importSourceFilename?: string | null;
};

type Options = {
  regions: string[];
  equipmentTypes: string[];
  supervisors: { id: string; employeeCode: string; fullName: string }[];
  workTypes: string[];
};

type Filters = {
  fromDate: string;
  toDate: string;
  orderId: string;
  employeeCode: string;
  region: string;
  supervisorId: string;
  equipmentType: string;
  workType: string;
  comparisonStatus: string;
};

const emptyFilters: Filters = {
  fromDate: "", toDate: "", orderId: "", employeeCode: "", region: "",
  supervisorId: "", equipmentType: "", workType: "", comparisonStatus: ""
};

function headerKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function pick(row: Record<string, unknown>, aliases: string[]) {
  const wanted = new Set(aliases.map(headerKey));
  const entry = Object.entries(row).find(([key]) => wanted.has(headerKey(key)));
  return entry ? String(entry[1] ?? "").trim() : "";
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const delimiter = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ";" : ",";
  const parseLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) { current += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) { cells.push(current.trim()); current = ""; }
      else current += char;
    }
    cells.push(current.trim());
    return cells;
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((h, i) => [h, parseLine(line)[i] || ""])));
}

function buildQuery(filters: Filters) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value.trim()) qs.set(key, value.trim()); });
  return qs.toString();
}

export default function WarehousePage() {
  const { t, locale } = useI18n();
  const { token } = useAuth();
  const [rows, setRows] = useState<SerialRow[]>([]);
  const [options, setOptions] = useState<Options>({ regions: [], equipmentTypes: [], supervisors: [], workTypes: [] });
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRegion, setImportRegion] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (next: Filters) => {
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      const query = buildQuery(next);
      const data = await apiFetch<{ items: SerialRow[] }>(`/warehouse/serials${query ? `?${query}` : ""}`, { token });
      setRows(data.items || []);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : t("errorLoad"));
    } finally { setBusy(false); }
  }, [token, t]);

  const loadOptions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<Options>("/warehouse/options", { token });
      setOptions(data);
    } catch {
      setOptions({ regions: [], equipmentTypes: [], supervisors: [], workTypes: [] });
    }
  }, [token]);

  const refresh = useCallback(async () => {
    await Promise.all([loadOptions(), load(filters)]);
  }, [filters, load, loadOptions]);

  useEffect(() => {
    if (!token) return;
    void loadOptions();
    void load(emptyFilters);
  }, [token, load, loadOptions]);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const summary = useMemo(() => ({
    matched: rows.filter((r) => r.comparisonStatus === "MATCHED").length,
    registered: rows.filter((r) => r.comparisonStatus === "REGISTERED_ONLY").length,
    imported: rows.filter((r) => r.comparisonStatus === "IMPORTED_ONLY").length
  }), [rows]);

  async function readImport(file: File) {
    let rawRows: Record<string, unknown>[] = [];
    if (file.name.toLowerCase().endsWith(".csv")) {
      rawRows = parseCsv(await file.text());
    } else {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) return [];
      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell, col) => { headers[col - 1] = String(cell.text || "").trim(); });
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const item: Record<string, unknown> = {};
        headers.forEach((header, index) => { item[header] = row.getCell(index + 1).text; });
        rawRows.push(item);
      });
    }
    return rawRows.map((row) => ({
      serialNumber: pick(row, ["serial", "serie", "serial number", "numero de serie", "sn", "s/n"]),
      region: pick(row, ["region", "zona"]) || importRegion,
      equipmentType: pick(row, ["equipment type", "tipo de equipo", "equipo", "tipo"]),
      orderId: pick(row, ["order", "orden", "numero de orden", "order id"])
    })).filter((row) => row.serialNumber && row.region);
  }

  async function submitImport() {
    if (!token || !importFile) return;
    setBusy(true);
    setMessage(null);
    try {
      const parsed = await readImport(importFile);
      if (!parsed.length) throw new Error(t("warehouseImportNoValidRows"));
      const result = await apiFetch<{ imported: number; skipped: number }>("/warehouse/imports", {
        method: "POST", token,
        body: JSON.stringify({ sourceFilename: importFile.name, region: importRegion, rows: parsed })
      });
      setMessage(t("warehouseImportSuccess", { count: result.imported, skipped: result.skipped }));
      setImportOpen(false); setImportFile(null); if (inputRef.current) inputRef.current.value = "";
      await load(filters);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("errorLoad"));
    } finally { setBusy(false); }
  }

  async function exportExcel() {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(t("warehouseSheetName"));
    sheet.columns = [
      { header: t("warehouseComparison"), key: "status", width: 20 },
      { header: t("warehouseSerial"), key: "serial", width: 24 },
      { header: t("warehouseEquipmentType"), key: "equipment", width: 22 },
      { header: t("order"), key: "order", width: 18 },
      { header: t("warehouseCoordinates"), key: "coordinates", width: 26 },
      { header: t("workType"), key: "work", width: 30 },
      { header: t("employeeCode"), key: "employee", width: 18 },
      { header: t("employeesRegion"), key: "region", width: 18 },
      { header: t("supervisor"), key: "supervisor", width: 28 },
      { header: t("date"), key: "date", width: 22 },
      { header: t("warehouseImageStatus"), key: "image", width: 18 }
    ];
    rows.forEach((row) => sheet.addRow({
      status: t(`warehouseStatus${row.comparisonStatus}`), serial: row.serialNumber,
      equipment: row.equipmentType, order: row.orderId || "", work: row.workType || "",
      coordinates: row.orderLatitude != null && row.orderLongitude != null
        ? `${row.orderLatitude}, ${row.orderLongitude}`
        : "",
      employee: row.employeeCode || "", region: row.region || "",
      supervisor: row.supervisorName
        ? `${row.supervisorName}${row.supervisorCode ? ` (${row.supervisorCode})` : ""}`
        : "",
      date: row.capturedAt ? new Date(row.capturedAt).toLocaleString(locale) : "",
      image: row.imageAvailable ? t("warehouseImageAvailable") : t("warehouseImageUnavailable")
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: "A1", to: `K${Math.max(1, rows.length + 1)}` };
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `flupy-series-${new Date().toISOString().slice(0, 10)}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
  }

  async function openImage(row: SerialRow) {
    if (!token || !row.photoId || !row.imageAvailable) { setImageUnavailable(true); setImageUrl(null); return; }
    setImageUnavailable(false);
    try {
      const response = await fetch(`${getApiBase()}/warehouse/serials/${row.photoId}/image`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error();
      setImageUrl(URL.createObjectURL(await response.blob()));
    } catch { setImageUnavailable(true); setImageUrl(null); }
  }

  const field = "min-h-[42px] w-full rounded-lg border border-white/[0.1] bg-[rgba(3,6,14,0.7)] px-3 py-2 text-sm text-white outline-none focus:border-teal-400/40";
  return <div className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold text-white">{t("warehouseTitle")}</h1><p className="mt-1 text-sm text-slate-400">{t("warehouseSubtitle")}</p></div>
      <div className="flex gap-2">
        <button onClick={() => void refresh()} disabled={busy} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:border-teal-400/30 disabled:opacity-40">{busy ? t("loading") : t("warehouseRefresh")}</button>
        <button onClick={() => setImportOpen(true)} className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400">{t("warehouseImport")}</button>
        <button onClick={() => void exportExcel()} disabled={!rows.length} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:border-teal-400/30 disabled:opacity-40">{t("warehouseExport")}</button>
      </div>
    </header>

    <section className="grid gap-3 sm:grid-cols-3">
      {[["MATCHED", summary.matched, "text-teal-300"], ["REGISTERED_ONLY", summary.registered, "text-amber-300"], ["IMPORTED_ONLY", summary.imported, "text-sky-300"]].map(([status, value, color]) =>
        <div key={String(status)} className="ui-card p-4"><p className="text-xs uppercase text-slate-500">{t(`warehouseStatus${status}`)}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>)}
    </section>

    <section className="ui-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <CalendarDateField id="warehouse-from" label={t("filterFromDate")} value={filters.fromDate} onChange={(v) => setFilters((f) => ({ ...f, fromDate: v }))} openLabel={t("openCalendar")} />
        <CalendarDateField id="warehouse-to" label={t("filterToDate")} value={filters.toDate} onChange={(v) => setFilters((f) => ({ ...f, toDate: v }))} openLabel={t("openCalendar")} />
        <input className={field} placeholder={t("filterOrderId")} value={filters.orderId} onChange={(e) => setFilters((f) => ({ ...f, orderId: e.target.value }))} />
        <input className={field} placeholder={t("filterEmployeeCode")} value={filters.employeeCode} onChange={(e) => setFilters((f) => ({ ...f, employeeCode: e.target.value }))} />
        <select className={field} value={filters.region} onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))}><option value="">{t("warehouseAllRegions")}</option>{options.regions.map((v) => <option key={v}>{v}</option>)}</select>
        <select className={field} value={filters.supervisorId} onChange={(e) => setFilters((f) => ({ ...f, supervisorId: e.target.value }))}><option value="">{t("warehouseAllSupervisors")}</option>{options.supervisors.map((v) => <option key={v.id} value={v.id}>{v.fullName} ({v.employeeCode})</option>)}</select>
        <select className={field} value={filters.equipmentType} onChange={(e) => setFilters((f) => ({ ...f, equipmentType: e.target.value }))}><option value="">{t("warehouseAllEquipment")}</option>{options.equipmentTypes.map((v) => <option key={v}>{v}</option>)}</select>
        <select className={field} value={filters.workType} onChange={(e) => setFilters((f) => ({ ...f, workType: e.target.value }))}><option value="">{t("warehouseAllWorkTypes")}</option>{options.workTypes.map((v) => <option key={v}>{v}</option>)}</select>
        <select className={field} value={filters.comparisonStatus} onChange={(e) => setFilters((f) => ({ ...f, comparisonStatus: e.target.value }))}><option value="">{t("warehouseAllStatuses")}</option>{["MATCHED", "REGISTERED_ONLY", "IMPORTED_ONLY"].map((v) => <option key={v} value={v}>{t(`warehouseStatus${v}`)}</option>)}</select>
      </div>
      <div className="mt-4 flex gap-2"><button onClick={() => void load(filters)} disabled={busy} className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950">{t("filterApply")}</button><button onClick={() => { setFilters(emptyFilters); void load(emptyFilters); }} className="rounded-lg border border-white/10 px-4 py-2 text-sm">{t("filterClear")}</button></div>
      {message && <p className="mt-3 text-sm text-amber-200">{message}</p>}
    </section>

    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-white/[0.04] text-xs uppercase text-slate-500"><tr>{["warehouseComparison", "warehouseSerial", "warehouseEquipmentType", "order", "warehouseCoordinates", "workType", "employeeCode", "employeesRegion", "supervisor", "date", "photos"].map((key) => <th key={key} className="px-3 py-3">{t(key)}</th>)}</tr></thead>
      <tbody className="divide-y divide-white/[0.06]">{rows.map((row) => <tr key={row.id} className="hover:bg-white/[0.025]"><td className="px-3 py-3"><span className="whitespace-nowrap rounded-full bg-white/[0.06] px-2 py-1 text-xs">{t(`warehouseStatus${row.comparisonStatus}`)}</span></td><td className="px-3 py-3 font-mono text-teal-200">{row.serialNumber}</td><td className="px-3 py-3">{row.equipmentType}</td><td className="px-3 py-3">{row.orderId || "—"}</td><td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-300">{row.orderLatitude != null && row.orderLongitude != null ? `${row.orderLatitude}, ${row.orderLongitude}` : "—"}</td><td className="px-3 py-3">{row.workType || "—"}</td><td className="px-3 py-3">{row.employeeCode || "—"}</td><td className="px-3 py-3">{row.region || "—"}</td><td className="px-3 py-3">{row.supervisorName ? `${row.supervisorName}${row.supervisorCode ? ` (${row.supervisorCode})` : ""}` : "—"}</td><td className="whitespace-nowrap px-3 py-3">{row.capturedAt ? new Date(row.capturedAt).toLocaleString(locale) : "—"}</td><td className="px-3 py-3">{row.photoId ? <button onClick={() => void openImage(row)} className="text-teal-300 hover:text-teal-200">{row.imageAvailable ? t("openImage") : t("warehouseImageUnavailable")}</button> : <span className="text-slate-600">{t("warehouseImageUnavailable")}</span>}</td></tr>)}</tbody></table></div>
      {!rows.length && <p className="p-8 text-center text-sm text-slate-500">{busy ? t("loading") : t("noData")}</p>}
    </section>

    {importOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="ui-card w-full max-w-lg p-6"><h2 className="text-lg font-semibold">{t("warehouseImportTitle")}</h2><p className="mt-1 text-sm text-slate-400">{t("warehouseImportHint")}</p><select className={`${field} mt-4`} value={importRegion} onChange={(e) => setImportRegion(e.target.value)}><option value="">{t("warehouseRegionFromFile")}</option>{options.regions.map((v) => <option key={v}>{v}</option>)}</select><input ref={inputRef} type="file" accept=".xlsx,.csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="mt-4 block w-full text-sm text-slate-300"/><div className="mt-5 flex justify-end gap-2"><button onClick={() => setImportOpen(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm">{t("cancel")}</button><button onClick={() => void submitImport()} disabled={!importFile || busy} className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{t("warehouseImport")}</button></div></div></div>}

    {(imageUrl || imageUnavailable) && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={() => { if (imageUrl) URL.revokeObjectURL(imageUrl); setImageUrl(null); setImageUnavailable(false); }}><div className="max-h-[90vh] max-w-5xl" onClick={(e) => e.stopPropagation()}>{imageUnavailable ? <div className="rounded-xl border border-rose-400/20 bg-slate-950 p-10 text-center text-rose-300">{t("warehouseImageUnavailable")}</div> : <Image unoptimized src={imageUrl || ""} alt={t("warehouseSerialImage")} width={1600} height={1200} className="max-h-[85vh] max-w-full object-contain" />}</div></div>}
  </div>;
}
