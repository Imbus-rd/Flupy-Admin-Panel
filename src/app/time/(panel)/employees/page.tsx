"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import { EMPLOYEE_REGIONS, normalizeEmployeeRegionFormValue } from "@/lib/employeeRegions";

type Emp = {
  id: string;
  employeeCode: string;
  fullName: string;
  role: string;
  active: boolean;
  region?: string | null;
};

type EmpDetail = {
  id: string;
  employeeCode: string;
  fullName: string;
  role: string;
  email: string | null;
  geofenceKey: string | null;
  employeeType: string;
  supervisorId: string | null;
  isSupervisor: boolean;
  active: boolean;
  region: string | null;
};

type GfOpt = { geofenceKey: string; officeName: string };

const ROLES = ["EMPLOYEE", "SUPERVISOR", "INSPECTOR", "ADMIN"] as const;
const TYPES = ["CENTRALIZED", "DECENTRALIZED"] as const;

function roleLabel(t: (k: string) => string, role: string) {
  const m: Record<string, string> = {
    EMPLOYEE: t("roleEMPLOYEE"),
    SUPERVISOR: t("roleSUPERVISOR"),
    INSPECTOR: t("roleINSPECTOR"),
    ADMIN: t("roleADMIN")
  };
  return m[role] || role;
}

export default function EmployeesPage() {
  const { t } = useI18n();
  const { token, employee: authEmployee } = useAuth();
  const [items, setItems] = useState<Emp[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [geofences, setGeofences] = useState<GfOpt[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmpDetail | null>(null);
  const [loadDetailErr, setLoadDetailErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "EMPLOYEE" as string,
    employeeType: "CENTRALIZED",
    geofenceKey: "",
    supervisorId: "",
    isSupervisor: false,
    active: true,
    password: "",
    region: ""
  });
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const scopedRegion = useMemo(() => {
    const r = authEmployee?.region;
    return r != null && String(r).trim() !== "" ? String(r).trim() : null;
  }, [authEmployee?.region]);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (searchApplied.trim()) qs.set("search", searchApplied.trim());
      qs.set("includeInactive", "true");
      const data = await apiFetch<{ items: Emp[] }>(`/employees?${qs.toString()}`, { token });
      setItems((data.items || []).map((e) => ({ ...e, active: e.active !== false })));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("errorLoad"));
    }
  }, [token, t, searchApplied]);

  useEffect(() => {
    load();
  }, [load]);

  const supervisors = useMemo(
    () => items.filter((e) => e.role === "SUPERVISOR"),
    [items]
  );

  const openEdit = useCallback(
    async (id: string) => {
      if (!token) return;
      setEditId(id);
      setDetail(null);
      setLoadDetailErr(null);
      setSaveMsg(null);
      try {
        const [empData, gfData] = await Promise.all([
          apiFetch<EmpDetail>(`/employees/${id}`, { token }),
          apiFetch<{ items: GfOpt[] }>("/geofences", { token }).catch(() => ({ items: [] as GfOpt[] }))
        ]);
        setGeofences(gfData.items || []);
        setDetail(empData);
        setForm({
          fullName: empData.fullName || "",
          email: empData.email || "",
          role: empData.role,
          employeeType: empData.employeeType || "CENTRALIZED",
          geofenceKey: empData.geofenceKey || "",
          supervisorId: empData.supervisorId || "",
          isSupervisor: empData.isSupervisor,
          active: empData.active !== false,
          password: "",
          region: normalizeEmployeeRegionFormValue(empData.region)
        });
      } catch (e) {
        setLoadDetailErr(e instanceof ApiError ? e.message : t("errorLoad"));
      }
    },
    [token, t]
  );

  const closeEdit = useCallback(() => {
    setEditId(null);
    setDetail(null);
    setLoadDetailErr(null);
    setSaveMsg(null);
  }, []);

  const submitEdit = useCallback(async () => {
    if (!token || !editId || !form.fullName.trim()) return;
    const pw = form.password.trim();
    if (pw && pw.length < 6) {
      setSaveMsg(t("passwordMin6"));
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, unknown> = {
        fullName: form.fullName.trim(),
        email: form.email.trim() ? form.email.trim() : null,
        role: form.role,
        employeeType: form.employeeType,
        geofenceKey: form.geofenceKey.trim() || null,
        isSupervisor: form.isSupervisor,
        active: form.active
      };
      body.region = form.region.trim() ? form.region.trim() : null;
      if (form.role === "EMPLOYEE") {
        if (!form.supervisorId) {
          setSaveMsg(t("selectSupervisor"));
          setSaving(false);
          return;
        }
        body.supervisorId = form.supervisorId;
      }
      if (pw) body.password = pw;

      await apiFetch(`/employees/${editId}`, {
        method: "PUT",
        token,
        body: JSON.stringify(body)
      });
      setSaveMsg(t("saveSuccess"));
      await load();
      closeEdit();
    } catch (e) {
      setSaveMsg(e instanceof ApiError ? e.message : t("errorLoad"));
    } finally {
      setSaving(false);
    }
  }, [token, editId, form, t, load, closeEdit]);

  const inputClass =
    "mt-1 w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2 text-sm text-white outline-none focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("employeesTitle")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("employeesSubtitle")}</p>
          {scopedRegion && (
            <p className="mt-2 text-xs text-amber-200/90">
              {t("employeesScopedBanner", { region: scopedRegion })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          className="self-start rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-slate-200 backdrop-blur-sm transition hover:border-teal-400/30"
        >
          {t("retry")}
        </button>
      </div>
      {err && <p className="text-sm text-rose-400">{err}</p>}

      <div className="ui-card flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="emp-search" className="block text-xs font-medium text-slate-400">
            {t("employeesSearchPlaceholder")}
          </label>
          <input
            id="emp-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearchApplied(searchInput);
              }
            }}
            className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
          />
        </div>
        <button
          type="button"
          onClick={() => setSearchApplied(searchInput)}
          className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:from-teal-400 hover:to-emerald-400"
        >
          {t("employeesSearchApply")}
        </button>
      </div>

      <div className="ui-table-wrap scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-medium">{t("employeeCode")}</th>
              <th className="px-4 py-3 font-medium">{t("name")}</th>
              <th className="px-4 py-3 font-medium">{t("employeesRegion")}</th>
              <th className="px-4 py-3 font-medium">{t("role")}</th>
              <th className="px-4 py-3 font-medium">{t("status")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  {t("noData")}
                </td>
              </tr>
            )}
            {items.map((e) => (
              <tr key={e.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 font-mono text-teal-200/90">{e.employeeCode}</td>
                <td className="px-4 py-3 font-medium text-white">{e.fullName}</td>
                <td className="max-w-[140px] truncate px-4 py-3 text-slate-400" title={e.region || ""}>
                  {e.region || "—"}
                </td>
                <td className="px-4 py-3 text-slate-400">{roleLabel(t, e.role)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      e.active ? "bg-teal-500/15 text-teal-200" : "bg-rose-500/15 text-rose-200"
                    }`}
                  >
                    {e.active ? t("employeeStatusActive") : t("employeeStatusInactive")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => void openEdit(e.id)}
                    className="rounded-lg border border-teal-400/35 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-200 transition hover:bg-teal-400/18"
                  >
                    {t("edit")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="emp-edit-title"
        >
          <div className="ui-modal max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 scrollbar-thin">
            <h2 id="emp-edit-title" className="text-lg font-semibold text-white">
              {t("editEmployee")}
            </h2>
            {loadDetailErr && <p className="mt-2 text-sm text-rose-400">{loadDetailErr}</p>}
            {!detail && !loadDetailErr && (
              <p className="mt-4 text-slate-400">{t("loading")}</p>
            )}
            {detail && (
              <>
                <p className="mt-2 font-mono text-xs text-slate-500">
                  {t("employeeCode")}: {detail.employeeCode}
                </p>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-400">{t("name")}</label>
                    <input
                      className={inputClass}
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400">{t("email")}</label>
                    <input
                      type="email"
                      className={inputClass}
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400">{t("employeesRegion")}</label>
                    <select
                      className={inputClass}
                      value={form.region}
                      onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                    >
                      <option value="">{t("employeeRegionNone")}</option>
                      {EMPLOYEE_REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">{t("employeesRegionHint")}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400">{t("role")}</label>
                    <select
                      className={inputClass}
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(t, r)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400">{t("employeeTypeLabel")}</label>
                    <select
                      className={inputClass}
                      value={form.employeeType}
                      onChange={(e) => setForm((f) => ({ ...f, employeeType: e.target.value }))}
                    >
                      {TYPES.map((ty) => (
                        <option key={ty} value={ty}>
                          {ty === "CENTRALIZED" ? t("typeCentralized") : t("typeDecentralized")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400">{t("geofenceAssign")}</label>
                    <select
                      className={inputClass}
                      value={form.geofenceKey}
                      onChange={(e) => setForm((f) => ({ ...f, geofenceKey: e.target.value }))}
                    >
                      <option value="">{t("geofenceClear")}</option>
                      {geofences.map((g) => (
                        <option key={g.geofenceKey} value={g.geofenceKey}>
                          {g.officeName}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.role === "EMPLOYEE" && (
                    <div>
                      <label className="text-xs font-medium text-slate-400">{t("supervisor")}</label>
                      <select
                        className={inputClass}
                        value={form.supervisorId}
                        onChange={(e) => setForm((f) => ({ ...f, supervisorId: e.target.value }))}
                      >
                        <option value="">{t("selectSupervisor")}</option>
                        {supervisors
                          .filter((s) => s.id !== detail.id)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.fullName} ({s.employeeCode})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.isSupervisor}
                      onChange={(e) => setForm((f) => ({ ...f, isSupervisor: e.target.checked }))}
                      className="rounded border-white/20 bg-[rgba(3,6,14,0.8)] text-teal-400"
                    />
                    {t("isSupervisorFlag")}
                  </label>
                  <div>
                    <label className="text-xs font-medium text-slate-400">{t("employeeStatusLabel")}</label>
                    <select
                      className={inputClass}
                      value={form.active ? "ACTIVE" : "INACTIVE"}
                      onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "ACTIVE" }))}
                    >
                      <option value="ACTIVE">{t("employeeStatusActive")}</option>
                      <option value="INACTIVE">{t("employeeStatusInactive")}</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">{t("employeeStatusHint")}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400">{t("passwordNewOptional")}</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className={inputClass}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">{t("passwordLeaveBlank")}</p>
                  </div>
                </div>
                {saveMsg && <p className="mt-3 text-sm text-rose-400">{saveMsg}</p>}
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:border-white/[0.15]"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={saving || !form.fullName.trim()}
                    onClick={() => void submitEdit()}
                    className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50"
                  >
                    {saving ? t("saving") : t("save")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
