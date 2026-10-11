"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { LangSwitch } from "@/components/LangSwitch";
import { PasswordInput } from "@/components/PasswordInput";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import type { AdminEmployee } from "@/lib/auth";

type CompanyRow = { id: string; name: string };

function LoginForm() {
  const { t } = useI18n();
  const { setAuth, token, ready } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/time/dashboard";

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (token) {
      router.replace(nextPath.startsWith("/") ? nextPath : "/time/dashboard");
    }
  }, [ready, token, router, nextPath]);

  useEffect(() => {
    apiFetch<{ items: CompanyRow[] }>("/auth/companies")
      .then((r) => setCompanies(r.items || []))
      .catch(() => setCompanies([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, string> = { employeeCode: employeeCode.trim(), password };
      if (companyId) body.companyId = companyId;

      const data = await apiFetch<{ token: string; employee: AdminEmployee }>("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify(body)
      });
      setAuth(data.token, {
        ...data.employee,
        companyName: data.employee.companyName
      });
      const roleHome = data.employee.role === "WAREHOUSE" ? "/time/warehouse" : "/time/dashboard";
      router.push(nextPath.startsWith("/") && nextPath !== "/time/dashboard" ? nextPath : roleHome);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2.5 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20";

  return (
    <div className="min-h-screen text-slate-100">
      <header className="ui-glass-header">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <LogoMark />
            <div>
              <div className="text-sm font-semibold tracking-tight">{t("brand")}</div>
              <div className="text-xs text-slate-500">{t("flupyTimeTitle")}</div>
            </div>
          </Link>
          <LangSwitch />
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-12 sm:py-20">
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("loginTitle")}</h1>
        <p className="mt-2 text-sm text-slate-500">{t("loginSubtitle")}</p>

        <form onSubmit={onSubmit} className="ui-card mt-8 space-y-4 rounded-3xl p-6 sm:p-7">
          <div>
            <label className="block text-xs font-medium text-slate-500">{t("company")}</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className={fieldClass}
            >
              <option value="">{t("selectCompany")}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-600">{t("companyOptional")}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">{t("employeeId")}</label>
            <input
              required
              autoComplete="username"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              className={fieldClass}
              placeholder="ADM001"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-xs font-medium text-slate-500">
              {t("password")}
            </label>
            <PasswordInput
              id="login-password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
              disabled={loading}
              wrapperClassName="mt-1.5"
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/25 transition hover:from-teal-400 hover:to-emerald-400 disabled:opacity-60"
          >
            {loading ? t("signingIn") : t("signIn")}
          </button>
        </form>

        <Link href="/" className="mt-6 block text-center text-sm text-teal-400/90 transition hover:text-teal-300">
          {t("backToPortal")}
        </Link>
      </div>
    </div>
  );
}

export default function TimeLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 text-slate-500">…</div>}>
      <LoginForm />
    </Suspense>
  );
}
