"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ServicesShell } from "@/components/ServicesShell";
import { Snackbar } from "@/components/Snackbar";
import {
  servicesFetch,
  servicesUploadFile,
  resolveServicesMediaUrl,
  ServicesApiError,
} from "@/lib/servicesApi";
import { useServicesAuth } from "@/lib/ServicesAuthProvider";

type PlatformAdRow = {
  id: number;
  title: string | null;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  cta_label: string | null;
  play_store_url: string | null;
  app_store_url: string | null;
  ad_type: "promotion" | "announcement" | "app_promotion";
  placement: string;
  country: string | null;
  rotation_seconds: number;
  entrance_effect: string;
  text_effect: string;
  cta_effect: string;
  background_effect: string;
  transition_style: string;
  is_permanent: number;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  status: "ACTIVE" | "INACTIVE";
};

type AdForm = {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  ctaLabel: string;
  playStoreUrl: string;
  appStoreUrl: string;
  adType: PlatformAdRow["ad_type"];
  placement: string;
  country: string;
  rotationSeconds: number;
  entranceEffect: string;
  textEffect: string;
  ctaEffect: string;
  backgroundEffect: string;
  transitionStyle: string;
  isPermanent: boolean;
  startsAt: string;
  endsAt: string;
  priority: number;
};

const EMPTY_FORM: AdForm = {
  title: "",
  subtitle: "",
  imageUrl: "",
  linkUrl: "",
  ctaLabel: "",
  playStoreUrl: "",
  appStoreUrl: "",
  adType: "promotion",
  placement: "home",
  country: "",
  rotationSeconds: 8,
  entranceEffect: "fade_up",
  textEffect: "fade_in",
  ctaEffect: "pulse",
  backgroundEffect: "none",
  transitionStyle: "elegant",
  isPermanent: false,
  startsAt: "",
  endsAt: "",
  priority: 0,
};

function formatDate(str: string | null) {
  if (!str) return "";
  const d = str.split("T")[0];
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function calcDuration(start: string, end: string) {
  if (!start || !end) return "";
  const diff = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Fecha fin anterior al inicio";
  if (diff < 7) return `${diff} días`;
  if (diff < 30) return `${Math.round(diff / 7)} semana(s)`;
  if (diff < 365) return `${Math.round(diff / 30)} mes(es)`;
  return `${Math.round(diff / 365)} año(s)`;
}

function rowToForm(ad: PlatformAdRow): AdForm {
  return {
    title: ad.title || "",
    subtitle: ad.subtitle || "",
    imageUrl: ad.image_url || "",
    linkUrl: ad.link_url || "",
    ctaLabel: ad.cta_label || "",
    playStoreUrl: ad.play_store_url || "",
    appStoreUrl: ad.app_store_url || "",
    adType: ad.ad_type,
    placement: ad.placement || "home",
    country: ad.country || "",
    rotationSeconds: ad.rotation_seconds || 8,
    entranceEffect: ad.entrance_effect || "fade_up",
    textEffect: ad.text_effect || "fade_in",
    ctaEffect: ad.cta_effect || "pulse",
    backgroundEffect: ad.background_effect || "none",
    transitionStyle: ad.transition_style || "elegant",
    isPermanent: !!ad.is_permanent,
    startsAt: ad.starts_at ? ad.starts_at.split("T")[0] : "",
    endsAt: ad.ends_at ? ad.ends_at.split("T")[0] : "",
    priority: ad.priority || 0,
  };
}

export default function ServicesAdsPage() {
  const { token } = useServicesAuth();
  const [ads, setAds] = useState<PlatformAdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AdForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [snack, setSnack] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await servicesFetch<PlatformAdRow[]>("/api/admin/ads", { token });
      setAds(Array.isArray(data) ? data : []);
    } catch (e) {
      setAds([]);
      if (e instanceof ServicesApiError) setSnack(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: ads.length,
      active: ads.filter((a) => a.status === "ACTIVE").length,
      permanent: ads.filter((a) => a.is_permanent).length,
    }),
    [ads]
  );

  const vigenciaPreview = useMemo(() => {
    if (form.isPermanent) return "⏱ Permanente — activo hasta desactivación manual";
    if (form.startsAt && form.endsAt) {
      return `📅 Del ${formatDate(form.startsAt)} al ${formatDate(form.endsAt)} (${calcDuration(form.startsAt, form.endsAt)})`;
    }
    if (form.startsAt) return `📅 Comienza el ${formatDate(form.startsAt)} sin vencimiento`;
    if (form.endsAt) return `📅 Activo ahora hasta el ${formatDate(form.endsAt)}`;
    return "📅 Comienza ahora sin vencimiento";
  }, [form]);

  const setField = <K extends keyof AdForm>(key: K, value: AdForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (ad: PlatformAdRow) => {
    setEditingId(ad.id);
    setForm(rowToForm(ad));
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!token) return;
    setError("");
    if (!form.isPermanent && form.startsAt && form.endsAt && new Date(form.endsAt) < new Date(form.startsAt)) {
      setError("La fecha de fin debe ser posterior a la fecha de inicio.");
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, status: editingId ? undefined : "ACTIVE" };
      if (editingId) {
        await servicesFetch(`/api/admin/ads/${editingId}`, {
          method: "PUT",
          token,
          body: JSON.stringify(body),
        });
        setSnack("Campaña actualizada");
      } else {
        await servicesFetch("/api/admin/ads", {
          method: "POST",
          token,
          body: JSON.stringify(body),
        });
        setSnack("Campaña creada");
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof ServicesApiError ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleImageFile = async (file: File | null) => {
    if (!file || !token) return;
    if (!file.type.startsWith("image/")) {
      setError("Solo imágenes JPG, PNG, GIF o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no puede superar 5 MB.");
      return;
    }
    setError("");
    setUploadingImage(true);
    try {
      const data = await servicesUploadFile<{ imageUrl: string }>(
        "/api/admin/ads/upload-image",
        file,
        token
      );
      setField("imageUrl", data.imageUrl);
      setSnack("Imagen subida");
    } catch (e) {
      setError(e instanceof ServicesApiError ? e.message : "Error al subir imagen");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!token || !window.confirm("¿Desactivar esta campaña?")) return;
    try {
      await servicesFetch(`/api/admin/ads/${id}/deactivate`, { method: "PATCH", token });
      setSnack("Campaña desactivada");
      await load();
    } catch (e) {
      setSnack(e instanceof ServicesApiError ? e.message : "Error al desactivar");
    }
  };

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-teal-400/30 focus:border-teal-400/40 focus:ring-2";
  const labelClass = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400";

  return (
    <ServicesShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Anuncios y promociones</h1>
            <p className="mt-1 text-sm text-slate-400">
              Banners dinámicos en la app móvil (debajo de la barra de búsqueda en Inicio).
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20"
          >
            + Nueva campaña
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total campañas", val: stats.total },
            { label: "Activas", val: stats.active },
            { label: "Permanentes", val: stats.permanent },
          ].map(({ label, val }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-1 text-3xl font-bold text-white">{val}</div>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <h2 className="text-base font-bold text-white">{editingId ? "Editar campaña" : "Nueva campaña"}</h2>
            {error ? (
              <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Titular público</label>
                <input className={inputClass} value={form.title} onChange={(e) => setField("title", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Texto descriptivo</label>
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  rows={3}
                  value={form.subtitle}
                  onChange={(e) => setField("subtitle", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Imagen del banner</label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <label
                    className={`inline-flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-teal-400/40 bg-teal-500/10 px-4 py-3 text-sm font-semibold text-teal-200 transition hover:bg-teal-500/15 ${
                      uploadingImage ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    {uploadingImage ? "Subiendo…" : "Subir imagen"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="sr-only"
                      disabled={uploadingImage}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        void handleImageFile(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {form.imageUrl ? (
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveServicesMediaUrl(form.imageUrl)}
                        alt="Vista previa"
                        className="h-20 w-32 shrink-0 rounded-lg border border-white/10 object-cover"
                      />
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-400"
                        onClick={() => setField("imageUrl", "")}
                      >
                        Quitar imagen
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">JPG, PNG, WebP o GIF — máx. 5 MB</p>
                  )}
                </div>
                <label className={`${labelClass} mt-3`}>O URL de imagen (opcional)</label>
                <input
                  className={inputClass}
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => setField("imageUrl", e.target.value)}
                  placeholder="https://... o /uploads/platform-ads/..."
                />
              </div>
              <div>
                <label className={labelClass}>Etiqueta CTA</label>
                <input className={inputClass} value={form.ctaLabel} onChange={(e) => setField("ctaLabel", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Tipo</label>
                <select className={inputClass} value={form.adType} onChange={(e) => setField("adType", e.target.value as AdForm["adType"])}>
                  <option value="promotion">Promoción</option>
                  <option value="announcement">Anuncio</option>
                  <option value="app_promotion">App (tiendas)</option>
                </select>
              </div>
              {form.adType === "app_promotion" ? (
                <>
                  <div>
                    <label className={labelClass}>Google Play</label>
                    <input className={inputClass} type="url" value={form.playStoreUrl} onChange={(e) => setField("playStoreUrl", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>App Store</label>
                    <input className={inputClass} type="url" value={form.appStoreUrl} onChange={(e) => setField("appStoreUrl", e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <label className={labelClass}>Enlace externo</label>
                  <input className={inputClass} type="url" value={form.linkUrl} onChange={(e) => setField("linkUrl", e.target.value)} />
                </div>
              )}
              <div>
                <label className={labelClass}>Duración en pantalla (s)</label>
                <input
                  className={inputClass}
                  type="number"
                  min={3}
                  max={30}
                  value={form.rotationSeconds}
                  onChange={(e) => setField("rotationSeconds", parseInt(e.target.value, 10) || 8)}
                />
              </div>
              <div>
                <label className={labelClass}>Prioridad (0 = primero)</label>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={form.priority}
                  onChange={(e) => setField("priority", parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div>
                <label className={labelClass}>País (opcional)</label>
                <input className={inputClass} value={form.country} onChange={(e) => setField("country", e.target.value)} placeholder="DR" />
              </div>
              <div>
                <label className={labelClass}>Ubicación</label>
                <input className={inputClass} value={form.placement} onChange={(e) => setField("placement", e.target.value)} />
              </div>

              <div className="sm:col-span-2 rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-200">Efectos visuales</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Entrada</label>
                    <select className={inputClass} value={form.entranceEffect} onChange={(e) => setField("entranceEffect", e.target.value)}>
                      <option value="fade_up">Fade up</option>
                      <option value="slide_up">Slide up</option>
                      <option value="none">Sin efecto</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Texto</label>
                    <select className={inputClass} value={form.textEffect} onChange={(e) => setField("textEffect", e.target.value)}>
                      <option value="typewriter">Typewriter</option>
                      <option value="fade_in">Fade in</option>
                      <option value="none">Sin efecto</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>CTA</label>
                    <select className={inputClass} value={form.ctaEffect} onChange={(e) => setField("ctaEffect", e.target.value)}>
                      <option value="pulse">Pulse</option>
                      <option value="none">Sin efecto</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Fondo</label>
                    <select className={inputClass} value={form.backgroundEffect} onChange={(e) => setField("backgroundEffect", e.target.value)}>
                      <option value="none">Sin efecto</option>
                      <option value="warm_glow">Brillo cálido</option>
                      <option value="sparkle">Destellos</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className={labelClass}>Transición</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: "fast", l: "Rápida" },
                      { v: "elegant", l: "Elegante" },
                      { v: "none", l: "Directa" },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setField("transitionStyle", o.v)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                          form.transitionStyle === o.v
                            ? "bg-orange-500 text-white"
                            : "border border-white/10 bg-white/5 text-slate-300"
                        }`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-200">Vigencia</p>
                <label className="mb-3 flex cursor-pointer items-center gap-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.isPermanent}
                    onChange={(e) => setField("isPermanent", e.target.checked)}
                    className="h-4 w-4 rounded border-white/20"
                  />
                  Permanente hasta desactivación manual
                </label>
                {!form.isPermanent ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Inicio</label>
                      <input className={inputClass} type="date" value={form.startsAt} onChange={(e) => setField("startsAt", e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Fin</label>
                      <input className={inputClass} type="date" value={form.endsAt} onChange={(e) => setField("endsAt", e.target.value)} />
                    </div>
                  </div>
                ) : null}
                <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                  {vigenciaPreview}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear campaña"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {["Campaña", "Tipo", "Duración", "Vigencia", "Estado", "Acciones"].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              ) : ads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No hay campañas. Crea la primera.
                  </td>
                </tr>
              ) : (
                ads.map((ad) => (
                  <tr key={ad.id} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{ad.title || "(Sin titular)"}</div>
                      {ad.subtitle ? (
                        <div className="max-w-xs truncate text-xs text-slate-500">{ad.subtitle}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {ad.ad_type === "promotion" ? "Promoción" : ad.ad_type === "announcement" ? "Anuncio" : "App"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{ad.rotation_seconds}s</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {ad.is_permanent
                        ? "∞ Permanente"
                        : ad.ends_at
                          ? `→ ${formatDate(ad.ends_at)}`
                          : "Sin vencimiento"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          ad.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        {ad.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button type="button" className="text-xs font-semibold text-orange-400" onClick={() => openEdit(ad)}>
                          Editar
                        </button>
                        {ad.status === "ACTIVE" ? (
                          <button type="button" className="text-xs font-semibold text-red-400" onClick={() => handleDeactivate(ad.id)}>
                            Desactivar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Snackbar open={!!snack} message={snack || ""} onClose={() => setSnack(null)} />
    </ServicesShell>
  );
}
