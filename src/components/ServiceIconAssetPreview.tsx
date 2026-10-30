"use client";

import {
  assetDisplayName,
  slugFromIconPath,
  type ServiceIconAsset,
} from "@/lib/serviceIconCatalog";

type ServiceIconAssetPreviewProps = {
  asset: ServiceIconAsset | null;
  iconPath: string;
  onChangeAsset: () => void;
  onClear: () => void;
};

export function ServiceIconAssetPreview({
  asset,
  iconPath,
  onChangeAsset,
  onClear,
}: ServiceIconAssetPreviewProps) {
  if (!asset && !iconPath.trim()) return null;

  const slug = asset?.slug ?? slugFromIconPath(iconPath) ?? "";
  const name = asset ? assetDisplayName(asset) : slug;
  const imageUrl = asset?.url ?? "";

  return (
    <div className="rounded-2xl border border-teal-400/25 bg-teal-400/[0.06] p-4">
      <div className="flex gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-[rgba(3,6,14,0.55)] sm:h-28 sm:w-28">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-contain p-1.5" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">Sin vista</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-300/90">Vista previa del asset</p>
          <p className="mt-1 text-base font-semibold text-white">{name || "Asset seleccionado"}</p>
          {slug ? <p className="mt-0.5 font-mono text-xs text-slate-500">{slug}</p> : null}
          {iconPath.trim() ? (
            <p className="mt-2 break-all text-[11px] leading-snug text-slate-400">{iconPath.trim()}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onChangeAsset}
              title="Cambiar asset"
              className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-teal-400/35"
            >
              Cambiar asset
            </button>
            <button
              type="button"
              onClick={onClear}
              title="Quitar selección"
              className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            >
              Quitar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
