"use client";

import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { LangSwitch } from "@/components/LangSwitch";
import { useI18n } from "@/lib/i18n";

export default function PortalPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen text-slate-100">
      <header className="ui-glass-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <LogoMark />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-tight">{t("brand")}</div>
              <div className="truncate text-xs text-slate-500">{t("portalSubtitle")}</div>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-500 md:flex">
            <span className="cursor-default transition hover:text-slate-300">{t("navHome")}</span>
            <span className="cursor-default transition hover:text-slate-300">{t("navApps")}</span>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <LangSwitch />
            <Link
              href="#apps"
              className="hidden rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:from-teal-400 hover:to-emerald-400 sm:inline-block"
            >
              {t("enterPortal")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-12 lg:py-16">
        <section>
          <p className="mb-4 inline-flex rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-teal-200/90 sm:text-xs">
            {t("simBadge")}
          </p>
          <h1 className="text-balance text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-[2.35rem]">
            {t("portalHero")}
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-sm leading-relaxed text-slate-500 sm:text-base">
            {t("portalDesc")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#apps"
              className="rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-teal-500/20 transition hover:from-teal-400 hover:to-emerald-400"
            >
              {t("viewApps")}
            </a>
            <button
              type="button"
              onClick={() => alert(t("comingSoon"))}
              className="rounded-2xl border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-sm font-medium text-slate-200 backdrop-blur-sm transition hover:border-white/[0.15] hover:bg-white/[0.07]"
            >
              {t("tryFlupyAppLogin")}
            </button>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {[
              { title: t("cardAppsTitle"), body: t("cardAppsBody") },
              { title: t("cardPortalTitle"), body: t("cardPortalBody") },
              { title: t("cardAdminTitle"), body: t("cardAdminBody") }
            ].map((c) => (
              <div key={c.title} className="ui-card-soft rounded-2xl p-4">
                <p className="text-sm font-semibold tracking-tight text-white">{c.title}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="apps" className="ui-card rounded-3xl p-5 sm:p-6">
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">{t("choosePanel")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{t("choosePanelHint")}</p>

          <div className="mt-6 flex flex-col gap-4">
            <article className="ui-card-soft rounded-2xl p-4 sm:p-5">
              <h3 className="text-base font-semibold text-white">{t("flupyAppTitle")}</h3>
              <p className="mt-2 text-sm text-slate-500">{t("flupyAppDesc")}</p>
              <Link
                href="/services/login"
                className="mt-4 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/25 transition hover:from-teal-400 hover:to-emerald-400"
              >
                {t("enterAsAdmin")}
              </Link>
            </article>

            <article className="relative overflow-hidden rounded-2xl border border-teal-400/25 bg-gradient-to-br from-teal-500/15 via-white/[0.03] to-transparent p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] sm:p-5">
              <h3 className="text-base font-semibold text-teal-100">{t("flupyTimeTitle")}</h3>
              <p className="mt-2 text-sm text-slate-400">{t("flupyTimeDesc")}</p>
              <Link
                href="/time/login"
                className="mt-4 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/25 transition hover:from-teal-400 hover:to-emerald-400"
              >
                {t("enterAsAdmin")}
              </Link>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-slate-600">
        Flupy Time
      </footer>
    </div>
  );
}
