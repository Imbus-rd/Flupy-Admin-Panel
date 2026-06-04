"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogoMark } from "./LogoMark";
import { useServicesAuth } from "@/lib/ServicesAuthProvider";

const nav = [
  { href: "/services/dashboard", label: "Resumen" },
  { href: "/services/dashboard?tab=services", label: "Servicios" },
  { href: "/services/dashboard?tab=plans", label: "Planes" },
  { href: "/services/dashboard?tab=providers", label: "Proveedores" },
  { href: "/services/dashboard?tab=orders", label: "Ordenes" },
];

export function ServicesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, ready, logout, admin } = useServicesAuth();

  useEffect(() => {
    if (!ready) return;
    if (!token) router.replace("/services/login");
  }, [ready, token, router]);

  if (!ready || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Cargando panel...
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100">
      <header className="ui-glass-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link href="/" className="header-brand-neon group -my-1 -ml-1 flex min-w-0 items-center gap-3 rounded-xl py-1 pl-1 pr-3">
            <LogoMark />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">Flupy Services</div>
              <div className="truncate text-[11px] text-teal-300/85 sm:text-xs">Panel administrativo</div>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full border border-teal-400/25 bg-teal-400/10 px-2.5 py-1 text-[11px] font-medium tracking-wide text-teal-200/95 md:inline">
              {admin?.full_name || "Admin"}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur-sm transition hover:border-teal-400/30 hover:bg-white/[0.07] hover:text-white sm:text-sm"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-0 lg:flex-row lg:gap-6 lg:px-4 lg:pb-8 lg:pt-2">
        <aside className="sticky top-16 z-30 w-full self-start border-b border-white/[0.06] bg-[rgba(5,8,16,0.55)] backdrop-blur-md lg:top-20 lg:mt-2 lg:w-[15.5rem] lg:shrink-0 lg:rounded-2xl lg:border lg:border-white/[0.08] lg:bg-white/[0.03]">
          <div className="scrollbar-thin overflow-x-auto lg:overflow-x-visible">
            <div className="flex gap-2 p-3 lg:flex-col lg:gap-0.5">
              <div className="mb-2 hidden px-2 lg:block">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Operaciones</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Servicios, proveedores, planes y ordenes.</p>
              </div>
              {nav.map((item) => {
                const active = pathname === item.href.split("?")[0] && (item.href.includes("?") ? false : true);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium tracking-tight transition lg:w-full ${
                      active
                        ? "bg-gradient-to-r from-teal-500/20 to-emerald-500/10 text-teal-100"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                    }`}
                  >
                    {item.label}
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
