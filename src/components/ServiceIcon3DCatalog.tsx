"use client";

import { useMemo, useState } from "react";
import type { ServiceIconAsset } from "@/lib/serviceIconCatalog";
import { slugFromIconPath } from "@/lib/serviceIconCatalog";

type ServiceIcon3DCatalogProps = {
  title?: string;
  assets: ServiceIconAsset[];
  loading: boolean;
  selectedIconPath: string;
  slugForHint?: string;
  hasAssetForSlug?: boolean;
  onSelect: (asset: ServiceIconAsset) => void;
  compact?: boolean;
};

export function ServiceIcon3DCatalog({
  title = "Catálogo de assets 3D",
  assets,
  loading,
  selectedIconPath,
  slugForHint = "",
  hasAssetForSlug = true,
  onSelect,
  compact = false,
}: ServiceIcon3DCatalogProps) {
  const [query, setQuery] = useState("");
  const selectedSlug = slugFromIconPath(selectedIconPath);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (a) => a.slug.includes(q) || a.icon.toLowerCase().includes(q)
    );
  }, [assets, query]);

  return (
    <div
      className={`rounded-xl border border-white/[0.08] bg-white/[0.02] ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {!loading && assets.length > 0 && (
          <span className="text-xs text-slate-500">{assets.length} WebP</span>
        )}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por slug…"
        className="mt-3 w-full rounded-lg border border-white/[0.1] bg-[rgba(3,6,14,0.65)] px-3 py-2 text-sm text-white outline-none transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/20"
        aria-label="Buscar asset 3D por slug"
      />

      {slugForHint.trim() && !hasAssetForSlug && !loading && (
        <p className="mt-2 text-xs text-amber-200/90">No hay asset 3D para este slug</p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Cargando catálogo…</p>
      ) : assets.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No hay assets WebP en el servidor.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Sin coincidencias para la búsqueda.</p>
      ) : (
        <ul
          className={`mt-3 grid gap-2 ${compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"}`}
          role="listbox"
          aria-label={title}
        >
          {filtered.map((asset) => {
            const selected =
              selectedSlug === asset.slug ||
              selectedIconPath === asset.icon ||
              selectedIconPath === asset.url;
            return (
              <li key={asset.slug}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(asset)}
                  className={`group flex w-full flex-col overflow-hidden rounded-lg border text-left transition ${
                    selected
                      ? "border-teal-400 ring-2 ring-teal-400/40"
                      : "border-white/[0.08] hover:border-teal-400/35"
                  }`}
                >
                  <div className="relative aspect-square bg-[rgba(3,6,14,0.5)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {selected && (
                      <span className="absolute right-1 top-1 rounded bg-teal-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                        ✓
                      </span>
                    )}
                  </div>
                  <span className="truncate px-1.5 py-1 text-[10px] font-medium text-slate-400 group-hover:text-slate-200">
                    {asset.slug}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
