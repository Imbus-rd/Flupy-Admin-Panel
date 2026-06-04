"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/LogoMark";
import { PasswordInput } from "@/components/PasswordInput";
import { servicesFetch, ServicesApiError } from "@/lib/servicesApi";
import { useServicesAuth, type ServicesAdmin } from "@/lib/ServicesAuthProvider";

export default function ServicesLoginPage() {
  const router = useRouter();
  const { setAuth } = useServicesAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await servicesFetch<{ token: string; admin: ServicesAdmin }>("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setAuth(data.token, data.admin);
      router.push("/services/dashboard");
    } catch (err) {
      setError(err instanceof ServicesApiError ? err.message : "No se pudo iniciar sesion");
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
              <div className="text-sm font-semibold tracking-tight">Flupy Services</div>
              <div className="text-xs text-slate-500">Panel administrativo</div>
            </div>
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-12 sm:py-20">
        <h1 className="text-2xl font-bold tracking-tight text-white">Acceso administrativo</h1>
        <p className="mt-2 text-sm text-slate-500">Gestiona servicios, planes, proveedores y estadisticas globales.</p>

        <form onSubmit={onSubmit} className="ui-card mt-8 space-y-4 rounded-3xl p-6 sm:p-7">
          <div>
            <label className="block text-xs font-medium text-slate-500">Email</label>
            <input
              required
              autoComplete="username"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              placeholder="admin@flupy.io"
            />
          </div>
          <div>
            <label htmlFor="services-password" className="block text-xs font-medium text-slate-500">
              Password
            </label>
            <PasswordInput
              id="services-password"
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
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <Link href="/" className="mt-6 block text-center text-sm text-teal-400/90 transition hover:text-teal-300">
          Volver al portal
        </Link>
      </div>
    </div>
  );
}
