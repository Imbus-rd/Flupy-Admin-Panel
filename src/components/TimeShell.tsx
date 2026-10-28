"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./LogoMark";
import { LangSwitch } from "./LangSwitch";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthProvider";

const nav = [
  { href: "/time/dashboard", key: "navDashboard" },
  { href: "/time/employees", key: "navEmployees" },
  { href: "/time/attendance", key: "navAttendance" },
  { href: "/time/quality", key: "navQuality" },
  { href: "/time/inspections", key: "navInspections" },
  { href: "/time/geofences", key: "navGeofences" },
  { href: "/time/reports", key: "navReports" },
  { href: "/time/warehouse", key: "navWarehouse" },
  { href: "/time/profile", key: "navProfile" }
];

const supervisorPaths = new Set([
  "/time/dashboard",
  "/time/attendance",
  "/time/quality",
  "/time/inspections",
  "/time/reports",
  "/time/profile"
]);

const warehousePaths = new Set(["/time/warehouse"]);

export function TimeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { logout, employee } = useAuth();
  const visibleNav = nav.filter((item) => {
    if (employee?.role === "WAREHOUSE") return warehousePaths.has(item.href);
    if (employee?.role === "SUPERVISOR") return supervisorPaths.has(item.href);
    return item.href !== "/time/warehouse" || employee?.role === "ADMIN";
  });

  return (
    <div className="min-h-screen text-slate-100">
      <header className="ui-glass-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link
            href="/"
            className="header-brand-neon group -my-1 -ml-1 flex min-w-0 items-center gap-3 rounded-xl py-1 pl-1 pr-3"
          >
            <LogoMark />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">
                {t("brand")}
              </div>
              <div className="truncate text-[11px] text-teal-300/85 sm:text-xs">{t("portalSubtitle")}</div>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LangSwitch className="hidden sm:inline-flex" />
            <span className="hidden rounded-full border border-teal-400/25 bg-teal-400/10 px-2.5 py-1 text-[11px] font-medium tracking-wide text-teal-200/95 md:inline">
              {t("flupyTimeChip")}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur-sm transition hover:border-teal-400/30 hover:bg-white/[0.07] hover:text-white sm:text-sm"
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-0 lg:flex-row lg:gap-6 lg:px-4 lg:pb-8 lg:pt-2">
        <aside
          className="sticky top-16 z-30 w-full self-start border-b border-white/[0.06] bg-[rgba(5,8,16,0.55)] backdrop-blur-md lg:top-20 lg:mt-2 lg:w-[15.5rem] lg:shrink-0 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-white/[0.08] lg:bg-white/[0.03] lg:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] lg:backdrop-blur-xl"
          aria-label={t("sidebarTitle")}
        >
          <div className="scrollbar-thin overflow-x-auto lg:overflow-x-visible">
            <div className="flex gap-2 p-3 lg:flex-col lg:gap-0.5 lg:p-3">
              <div className="mb-2 flex items-start justify-between gap-2 px-2 lg:block">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("sidebarTitle")}</p>
                  <p className="mt-1 hidden text-[11px] leading-relaxed text-slate-500 lg:block">{t("sidebarHint")}</p>
                </div>
                <LangSwitch className="shrink-0 lg:hidden" />
              </div>
              {visibleNav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium tracking-tight transition lg:w-full ${
                      active
                        ? "bg-gradient-to-r from-teal-500/20 to-emerald-500/10 text-teal-100 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.25)]"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 hidden h-6 w-0.5 -translate-y-1/2 rounded-full bg-teal-400 lg:block"
                        aria-hidden
                      />
                    )}
                    {t(item.key)}
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-2 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
