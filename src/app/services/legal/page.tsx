"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ServicesShell } from "@/components/ServicesShell";
import { getServicesApiBase, servicesFetch, ServicesApiError } from "@/lib/servicesApi";
import { useServicesAuth } from "@/lib/ServicesAuthProvider";

type LegalDoc = {
  slug: string;
  title: string;
  body: string;
  version: string;
  public_path: string;
  is_published?: boolean;
  updated_at?: string;
};

type AcceptanceRow = {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  document_slug: string;
  document_title: string;
  document_version: string;
  source: string;
  ip_address: string | null;
  accepted_at: string;
};

type RegistrationSanity = {
  ok: boolean;
  unified_version: string | null;
  required_slugs: string[];
  documents: LegalDoc[];
  issues: Array<{
    code: string;
    slug?: string;
    message: string;
    versions?: Array<{ slug: string; version: string | null }>;
  }>;
};

const DOC_META: Array<{ slug: string; label: string; sitePath: string }> = [
  { slug: "terms_and_conditions", label: "Términos y condiciones", sitePath: "/terms" },
  { slug: "use_policy", label: "Políticas de uso", sitePath: "/use-policy" },
  { slug: "privacy_policy", label: "Política de privacidad", sitePath: "/privacy" },
  { slug: "liability_disclaimer", label: "Descargo de responsabilidad", sitePath: "/disclaimer" },
  { slug: "cookies_policy", label: "Política de cookies", sitePath: "/cookies" },
  { slug: "copyright_notice", label: "Copyright", sitePath: "/copyright" },
];

function errMessage(e: unknown): string {
  if (e instanceof ServicesApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Error desconocido";
}

export default function ServicesLegalPage() {
  const { token } = useServicesAuth();
  const [tab, setTab] = useState<"documents" | "acceptances">("documents");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [activeSlug, setActiveSlug] = useState(DOC_META[0].slug);
  const [docs, setDocs] = useState<Record<string, LegalDoc>>({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [version, setVersion] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptances, setAcceptances] = useState<AcceptanceRow[]>([]);
  const [acceptancesLoading, setAcceptancesLoading] = useState(false);
  const [userFilter, setUserFilter] = useState("");
  const [registrationSanity, setRegistrationSanity] = useState<RegistrationSanity | null>(null);

  const activeMeta = useMemo(
    () => DOC_META.find((d) => d.slug === activeSlug) ?? DOC_META[0],
    [activeSlug],
  );

  const loadRegistrationSanity = useCallback(async () => {
    if (!token) return;
    try {
      const report = await servicesFetch<RegistrationSanity>("/api/admin/legal/registration-sanity", {
        token,
      });
      setRegistrationSanity(report);
    } catch {
      setRegistrationSanity(null);
    }
  }, [token]);

  const loadDocs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await servicesFetch<LegalDoc[]>("/api/admin/legal/documents", { token });
      const map: Record<string, LegalDoc> = {};
      for (const row of rows) map[row.slug] = row;
      setDocs(map);
      await loadRegistrationSanity();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, [token, loadRegistrationSanity]);

  const loadAcceptances = useCallback(async () => {
    if (!token) return;
    setAcceptancesLoading(true);
    setError(null);
    try {
      const q = userFilter.trim() ? `?user_id=${encodeURIComponent(userFilter.trim())}` : "";
      const rows = await servicesFetch<AcceptanceRow[]>(`/api/admin/legal/acceptances${q}`, { token });
      setAcceptances(rows);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setAcceptancesLoading(false);
    }
  }, [token, userFilter]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    if (tab !== "acceptances") return;
    void loadAcceptances();
  }, [tab, loadAcceptances]);

  useEffect(() => {
    const doc = docs[activeSlug];
    if (!doc) return;
    setTitle(doc.title);
    setBody(doc.body);
    setVersion(doc.version);
  }, [activeSlug, docs]);

  async function saveDoc() {
    if (!token) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await servicesFetch<LegalDoc>(`/api/admin/legal/documents/${activeSlug}`, {
        token,
        method: "PUT",
        body: JSON.stringify({
          title,
          body,
          version,
          public_path: activeMeta.sitePath,
          is_published: true,
        }),
      });
      setDocs((prev) => ({ ...prev, [activeSlug]: saved }));
      setMessage("Documento guardado. La versión anterior quedó en el historial de revisiones.");
      await loadRegistrationSanity();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function importSeed(force = false) {
    if (!token) return;
    if (
      force &&
      !window.confirm(
        "¿Importar textos oficiales? Solo rellena documentos vacíos salvo que confirmes forzar (crea revisión del contenido previo al sobrescribir).",
      )
    ) {
      return;
    }
    setImporting(true);
    setMessage(null);
    setError(null);
    try {
      const url = force
        ? "/api/admin/legal/documents/import-seed?force=1"
        : "/api/admin/legal/documents/import-seed";
      const res = await servicesFetch<{ imported: number; message: string }>(url, {
        token,
        method: "POST",
        body: JSON.stringify({ force }),
      });
      setMessage(`${res.message} (${res.imported} documentos).`);
      await loadDocs();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setImporting(false);
    }
  }

  function certificatePath(userId: number, download = false) {
    const base = `/api/admin/legal/acceptances/${userId}/certificate`;
    return download ? `${base}?download=1` : base;
  }

  async function openCertificate(userId: number, download: boolean) {
    if (!token) return;
    const url = `${getServicesApiBase()}${certificatePath(userId, download)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      setError("No se pudo generar el certificado.");
      return;
    }
    const html = await res.text();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    if (download) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `flupy-legal-acceptance-user-${userId}.html`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      return;
    }
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <ServicesShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Legal</h1>
          <p className="mt-1 text-sm text-slate-400">
            Administra textos legales del sitio flupy.io y consulta aceptaciones registradas al crear cuenta en la app.
          </p>
        </div>

        {registrationSanity && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              registrationSanity.ok
                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
                : "border-amber-500/40 bg-amber-500/10 text-amber-100"
            }`}
          >
            {registrationSanity.ok ? (
              <p>
                Registro en app: los 3 documentos obligatorios están publicados con versión unificada{" "}
                <strong className="font-semibold">{registrationSanity.unified_version}</strong>.
              </p>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">Revisa la configuración legal antes de publicar cambios en la app:</p>
                <ul className="list-disc pl-5">
                  {registrationSanity.issues.map((issue, idx) => (
                    <li key={`${issue.code}-${issue.slug ?? idx}`}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("documents")}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              tab === "documents"
                ? "bg-teal-500/20 text-teal-100"
                : "bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            Documentos
          </button>
          <button
            type="button"
            onClick={() => setTab("acceptances")}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              tab === "acceptances"
                ? "bg-teal-500/20 text-teal-100"
                : "bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            Aceptaciones
          </button>
        </div>

        {message ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {tab === "documents" ? (
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <aside className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              {DOC_META.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => setActiveSlug(item.slug)}
                  className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm ${
                    activeSlug === item.slug
                      ? "bg-teal-500/15 text-teal-100"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                  }`}
                >
                  {item.label}
                  <span className="mt-0.5 block text-[11px] text-slate-500">{item.sitePath}</span>
                </button>
              ))}
              <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => importSeed(false)}
                  className="w-full rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                >
                  {importing ? "Importando…" : "Importar faltantes"}
                </button>
              </div>
            </aside>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              {loading ? (
                <p className="text-sm text-slate-400">Cargando documentos…</p>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{activeMeta.label}</h2>
                      <p className="text-xs text-slate-500">
                        Público:{" "}
                        <a
                          className="text-teal-300 hover:underline"
                          href={`https://flupy.io${activeMeta.sitePath}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          flupy.io{activeMeta.sitePath}
                        </a>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveDoc()}
                      className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
                    >
                      {saving ? "Guardando…" : "Guardar cambios"}
                    </button>
                  </div>

                  <label className="mb-4 block">
                    <span className="mb-1 block text-xs font-medium text-slate-400">Título</span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                    />
                  </label>

                  <label className="mb-4 block">
                    <span className="mb-1 block text-xs font-medium text-slate-400">Versión (incrementa al publicar cambios)</span>
                    <input
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-400">Contenido (Markdown / texto)</span>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={18}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm text-white"
                    />
                  </label>
                </>
              )}
            </section>
          </div>
        ) : (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Filtrar por user_id</span>
                <input
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  placeholder="ej. 42"
                  className="w-40 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                />
              </label>
              <button
                type="button"
                onClick={() => void loadAcceptances()}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
              >
                Buscar
              </button>
            </div>

            {acceptancesLoading ? (
              <p className="text-sm text-slate-400">Cargando aceptaciones…</p>
            ) : acceptances.length === 0 ? (
              <p className="text-sm text-slate-400">No hay registros todavía.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-2">Usuario</th>
                      <th className="px-2 py-2">Documento</th>
                      <th className="px-2 py-2">Versión</th>
                      <th className="px-2 py-2">Fecha</th>
                      <th className="px-2 py-2">Certificado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acceptances.map((row) => (
                      <tr key={row.id} className="border-t border-white/5 text-slate-200">
                        <td className="px-2 py-2">
                          <div className="font-medium">{row.full_name}</div>
                          <div className="text-xs text-slate-500">
                            #{row.user_id} · {row.email}
                          </div>
                        </td>
                        <td className="px-2 py-2">{row.document_title}</td>
                        <td className="px-2 py-2">{row.document_version}</td>
                        <td className="px-2 py-2">{new Date(row.accepted_at).toLocaleString()}</td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            className="text-teal-300 hover:underline"
                            onClick={() => void openCertificate(row.user_id, false)}
                          >
                            Ver
                          </button>
                          {" · "}
                          <button
                            type="button"
                            className="text-teal-300 hover:underline"
                            onClick={() => void openCertificate(row.user_id, true)}
                          >
                            Descargar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </ServicesShell>
  );
}
