"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

export default function AttendanceError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("[AttendancePage]", error);
  }, [error]);

  return (
    <div className="ui-card mx-auto max-w-lg space-y-4 rounded-2xl p-6 text-center">
      <h1 className="text-lg font-semibold text-white">{t("attendanceTitle")}</h1>
      <p className="text-sm text-rose-300">{t("errorLoad")}</p>
      <p className="text-xs text-slate-500 break-words">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950"
      >
        {t("retry")}
      </button>
    </div>
  );
}
