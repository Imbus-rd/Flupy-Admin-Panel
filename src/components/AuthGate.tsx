"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { useI18n } from "@/lib/i18n";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { token, employee, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      const next = encodeURIComponent(pathname || "/time/dashboard");
      router.replace(`/time/login?next=${next}`);
    }
  }, [ready, token, router, pathname]);

  useEffect(() => {
    if (!ready || !token || !employee) return;
    if (employee.role === "WAREHOUSE" && !pathname.startsWith("/time/warehouse")) {
      router.replace("/time/warehouse");
    }
    if (employee.role === "SUPERVISOR") {
      const allowed = ["/time/dashboard", "/time/attendance", "/time/quality", "/time/inspections", "/time/reports", "/time/profile"];
      if (!allowed.some((prefix) => pathname.startsWith(prefix))) router.replace("/time/dashboard");
    }
  }, [ready, token, employee, pathname, router]);

  if (!ready || !token) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400/80" aria-hidden />
          {t("loading")}
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
