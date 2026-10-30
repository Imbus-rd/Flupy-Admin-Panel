"use client";

import { useEffect, useMemo, useState } from "react";
import {
  assetDisplayName,
  slugFromIconPath,
  type ServiceIconAsset,
} from "@/lib/serviceIconCatalog";

type ServiceOfficialAssetPickerModalProps = {
  open: boolean;
  title?: string;
  assets: ServiceIconAsset[];
  loading: boolean;
  selectedIconPath: string;
  onClose: () => void;
  onConfirm: (asset: ServiceIconAsset) => void;
};

export function ServiceOfficialAssetPickerModal({
  open,
  title = "Seleccionar asset oficial",
  assets,
  loading,
  selectedIconPath,
  onClose,
  onConfirm,
}: ServiceOfficialAssetPickerModalProps) {
  const [query, setQuery] = useState("");
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  const selectedSlug = slugFromIconPath(selectedIconPath);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setPendingSlug(selectedSlug);
  }, [open, selectedSlug]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...assets].sort((a, b) =>
      assetDisplayName(a).localeCompare(assetDisplayName(b), "es", { sensitivity: "base" })
    );
    if (!q) return sorted;
    return sorted.filter((asset) => {
      const name = assetDisplayName(asset).toLowerCase();
      return asset.slug.includes(q) || name.includes(q);
    });
  }, [assets, query]);

  const pendingAsset = pendingSlug
    ? assets.find((asset) => asset.slug === pendingSlug) ?? null
    : null;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-asset-picker-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-white/[0.12] bg-[#0b1324] shadow-2xl shadow-black/50 sm:rounded-2xl">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div>
            <h2 id="service-asset-picker-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Assets WebP oficiales en <span className="text-slate-400">/uploads/service-icons/</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/[0.05]"
          >
            Cerrar
          </button>
        </header>

        <div className="shrink-0 border-b border-white/[0.06] px-5 py-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o slug…"
            autoFocus
            className="w-full rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-4 py-3 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
            aria-label="Buscar asset oficial"
          />
          {!loading && (
            <p className="mt-2 text-xs text-slate-500">
              {filtered.length} de {assets.length} assets
              {pendingAsset ? (
                <span className="text-slate-400">
                  {" "}
                  · Seleccionado: <span className="text-teal-300">{assetDisplayName(pendingAsset)}</span>
                </span>
              ) : null}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-500">Cargando catálogo…</p>
          ) : assets.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No hay assets WebP en el servidor.</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">Sin coincidencias para la búsqueda.</p>
          ) : (
            <ul
              className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
              role="listbox"
              aria-label={title}
            >
              {filtered.map((asset) => {
                const selected = pendingSlug === asset.slug;
                const label = assetDisplayName(asset);
                return (
                  <li key={asset.slug}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => setPendingSlug(asset.slug)}
                      className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border text-left transition ${
                        selected
                          ? "border-teal-400 ring-2 ring-teal-400/45"
                          : "border-white/[0.08] hover:border-teal-400/35 hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="relative aspect-square bg-[rgba(3,6,14,0.55)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={asset.url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-contain p-2"
                        />
                        {selected && (
                          <span
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-teal-400 text-sm font-bold text-slate-950 shadow"
                            aria-hidden
                          >
                            ✓
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5 px-3 py-2.5">
                        <p className="text-sm font-semibold leading-snug text-white">{label}</p>
                        <p className="font-mono text-[11px] text-slate-500">{asset.slug}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/[0.08] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/[0.12] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.04]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!pendingAsset}
            onClick={() => {
              if (pendingAsset) {
                onConfirm(pendingAsset);
                onClose();
              }
            }}
            className="rounded-xl bg-teal-400 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Usar este asset
          </button>
        </footer>
      </div>
    </div>
  );
}
