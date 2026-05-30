"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBase } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/** Session LRU of object URLs so revisiting photos / prev-next does not re-download full JPEGs. */
const QUALITY_IMG_CACHE_MAX = 28;
const qualityImgBlobCache = new Map<string, string>();

function rememberBlobUrl(cacheKey: string, objectUrl: string) {
  if (qualityImgBlobCache.has(cacheKey)) {
    const prev = qualityImgBlobCache.get(cacheKey)!;
    URL.revokeObjectURL(prev);
    qualityImgBlobCache.delete(cacheKey);
  }
  qualityImgBlobCache.set(cacheKey, objectUrl);
  while (qualityImgBlobCache.size > QUALITY_IMG_CACHE_MAX) {
    const k = qualityImgBlobCache.keys().next().value as string;
    const u = qualityImgBlobCache.get(k);
    if (u) URL.revokeObjectURL(u);
    qualityImgBlobCache.delete(k);
  }
}

function prefetchQualityImage(qualityId: string, photoId: string, token: string | null) {
  const cacheKey = `${qualityId}:${photoId}`;
  if (qualityImgBlobCache.has(cacheKey)) return;
  const url = `${getApiBase()}/admin/quality/${qualityId}/photos/${photoId}/image`;
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  void fetch(url, { headers, cache: "default" })
    .then((res) => (res.ok ? res.blob() : null))
    .then((blob) => {
      if (!blob) return;
      rememberBlobUrl(cacheKey, URL.createObjectURL(blob));
    })
    .catch(() => {});
}

export type LightboxPhoto = {
  id: string;
  photoUrl: string;
  photoType?: string;
  employeeCode?: string | null;
  customerMobile?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capturedAt?: string | null;
  inspectorDecision?: string;
  /** Validator comment when marking FE or ERROR */
  inspectorComment?: string | null;
  /** Employee marked this photo as out of standard at upload (FE). */
  fe?: boolean;
  /** Mandatory technician comment when out of standard; visible to administrators. */
  feComment?: string | null;
};

type Props = {
  open: boolean;
  qualityId: string;
  /** Work order / case number shown at the top while viewing photos */
  orderId?: string | null;
  token: string | null;
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  /** Persists the decision for this photo only. Returns true if saved; lightbox advances to the next photo on success. */
  onPhotoDecision: (
    photoId: string,
    decision: "FE" | "ERROR" | "OK",
    comment?: string | null
  ) => Promise<boolean>;
  busy?: boolean;
};

function decisionBadge(t: (k: string) => string, d: string | undefined) {
  const u = String(d || "NONE").toUpperCase();
  if (u === "OK") return { label: t("uiStatusOk"), className: "text-teal-300" };
  if (u === "FE") return { label: t("uiStatusFe"), className: "text-amber-200" };
  if (u === "ERROR") return { label: t("uiStatusError"), className: "text-rose-300" };
  return { label: t("qualityPhotoNotReviewed"), className: "text-slate-500" };
}

export function QualityLightbox({
  open,
  qualityId,
  orderId,
  token,
  photos,
  index,
  onClose,
  onIndexChange,
  onPhotoDecision,
  busy
}: Props) {
  const { t } = useI18n();
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  const photo = photos[index];
  const photoId = photo?.id;
  const badge = photo ? decisionBadge(t, photo.inspectorDecision) : { label: "", className: "" };
  const employeeComment = photo?.feComment?.trim() ?? "";
  const showTechnicianNonCompliance = Boolean(photo?.fe) || employeeComment.length > 0;
  const coordinatesLabel =
    photo.latitude != null && photo.longitude != null
      ? `${Number(photo.latitude).toFixed(6)}, ${Number(photo.longitude).toFixed(6)}`
      : "N/A";

  useEffect(() => {
    if (!open) return;
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, [open, index]);

  useEffect(() => {
    setReviewComment(photo?.inspectorComment?.trim() ?? "");
    setCommentError(null);
  }, [photo?.id, photo?.inspectorComment, open]);

  useEffect(() => {
    if (!open || !photoId || !qualityId) {
      setBlobUrl(null);
      setImgErr(false);
      return;
    }
    if (!token) {
      setBlobUrl(null);
      setImgErr(true);
      return;
    }

    const cacheKey = `${qualityId}:${photoId}`;
    const cached = qualityImgBlobCache.get(cacheKey);
    if (cached) {
      setBlobUrl(cached);
      setImgErr(false);
      const next = photos[index + 1];
      const prev = photos[index - 1];
      if (next?.id) prefetchQualityImage(qualityId, next.id, token);
      if (prev?.id) prefetchQualityImage(qualityId, prev.id, token);
      return;
    }

    let cancelled = false;
    setBlobUrl(null);
    setImgErr(false);

    const url = `${getApiBase()}/admin/quality/${qualityId}/photos/${photoId}/image`;
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${token}`);
    fetch(url, { headers, cache: "default" })
      .then((res) => {
        if (!res.ok) throw new Error("bad status");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        rememberBlobUrl(cacheKey, objectUrl);
        setBlobUrl(objectUrl);
        const next = photos[index + 1];
        const prev = photos[index - 1];
        if (next?.id) prefetchQualityImage(qualityId, next.id, token);
        if (prev?.id) prefetchQualityImage(qualityId, prev.id, token);
      })
      .catch(() => {
        if (!cancelled) setImgErr(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, photoId, qualityId, token, index, photos]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setScale((s) => Math.min(4, Math.max(0.5, s + delta)));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && index < photos.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, photos.length, onClose, onIndexChange]);

  const applyDecision = useCallback(
    async (decision: "FE" | "ERROR" | "OK") => {
      if (!photo) return;
      const trimmed = reviewComment.trim();
      if ((decision === "FE" || decision === "ERROR") && !trimmed) {
        setCommentError(t("qualityInspectorCommentRequired"));
        return;
      }
      setCommentError(null);
      const ok = await onPhotoDecision(photo.id, decision, decision === "OK" ? null : trimmed);
      if (ok && index < photos.length - 1) onIndexChange(index + 1);
    },
    [photo, onPhotoDecision, index, photos.length, onIndexChange, reviewComment, t]
  );

  if (!open || !photo) return null;

  const inspectorDecU = String(photo.inspectorDecision || "").toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-md"
      role="dialog"
      aria-modal
      aria-label={t("openImage")}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] bg-black/20 px-3 py-2 sm:px-4">
        <div className="min-w-0 text-xs text-slate-400 sm:text-sm">
          {orderId != null && String(orderId).trim() !== "" && (
            <div className="mb-1 truncate font-mono text-sm font-semibold tracking-tight text-teal-200/95">
              <span className="font-sans text-[11px] font-normal uppercase tracking-wide text-slate-500">
                {t("filterOrderId")}{" "}
              </span>
              {String(orderId).trim()}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {photo.photoType && <span className="text-teal-300/90">{photo.photoType}</span>}
            <span className="text-slate-500">
              {index + 1} / {photos.length}
            </span>
            <span className={`font-medium ${badge.className}`}>· {badge.label}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setScale((s) => Math.min(4, s + 0.25))}
            className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-2 py-1.5 text-xs text-white transition hover:bg-white/[0.08] disabled:opacity-40"
          >
            {t("zoomIn")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-2 py-1.5 text-xs text-white transition hover:bg-white/[0.08] disabled:opacity-40"
          >
            {t("zoomOut")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setScale(1);
              setPos({ x: 0, y: 0 });
            }}
            className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-2 py-1.5 text-xs text-white transition hover:bg-white/[0.08] disabled:opacity-40"
          >
            {t("resetZoom")}
          </button>
          <button
            type="button"
            disabled={busy || index <= 0}
            onClick={() => onIndexChange(index - 1)}
            className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-2 py-1.5 text-xs text-white transition hover:bg-white/[0.08] disabled:opacity-40"
          >
            {t("prev")}
          </button>
          <button
            type="button"
            disabled={busy || index >= photos.length - 1}
            onClick={() => onIndexChange(index + 1)}
            className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-2 py-1.5 text-xs text-white transition hover:bg-white/[0.08] disabled:opacity-40"
          >
            {t("next")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/[0.12] bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.12]"
          >
            {t("close")}
          </button>
        </div>
      </div>

      <div className="border-b border-white/[0.06] bg-black/25 px-4 py-2">
        <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span className="text-slate-500">{t("filterEmployeeCode")}: </span>
            <span className="font-mono text-slate-300">{photo.employeeCode || "N/A"}</span>
          </p>
          <p>
            <span className="text-slate-500">{t("customerMobile")}: </span>
            <span className="font-mono text-slate-300">{photo.customerMobile || "N/A"}</span>
          </p>
          <p>
            <span className="text-slate-500">{t("coords")}: </span>
            <span className="font-mono text-slate-300">{coordinatesLabel}</span>
          </p>
          <p>
            <span className="text-slate-500">{t("occurredAt")}: </span>
            <span className="text-slate-300">{photo.capturedAt || "N/A"}</span>
          </p>
        </div>
      </div>

      {showTechnicianNonCompliance && (
        <div className="border-b border-amber-500/20 bg-amber-950/35 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">
            {t("qualityTechnicianNonCompliance")}
          </p>
          {employeeComment ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-amber-50/95">{employeeComment}</p>
          ) : (
            <p className="mt-2 text-xs text-rose-300/90">{t("qualityTechnicianCommentMissing")}</p>
          )}
        </div>
      )}

      {(inspectorDecU === "FE" || inspectorDecU === "ERROR") &&
        (photo.inspectorComment?.trim() ?? "").length > 0 && (
          <div className="border-b border-sky-500/20 bg-sky-950/30 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-200/90">
              {t("qualityInspectorSavedNote")}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-sky-50/95">
              {photo.inspectorComment?.trim()}
            </p>
          </div>
        )}

      <div
        className="relative flex flex-1 cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={(e) => {
          drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y };
        }}
        onMouseMove={(e) => {
          if (!drag.current) return;
          setPos({
            x: drag.current.px + (e.clientX - drag.current.sx),
            y: drag.current.py + (e.clientY - drag.current.sy)
          });
        }}
        onMouseUp={() => {
          drag.current = null;
        }}
        onMouseLeave={() => {
          drag.current = null;
        }}
      >
        {imgErr && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-sm text-rose-300">
            {t("qualityImageLoadError")}
          </p>
        )}
        {!imgErr && !blobUrl && (
          <p className="text-sm text-slate-500">{t("loading")}</p>
        )}
        {blobUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL from authenticated fetch */}
            <img
              src={blobUrl}
              alt=""
              className="max-h-[calc(100vh-180px)] max-w-full select-none object-contain shadow-2xl"
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                transition: drag.current ? "none" : "transform 0.08s ease-out"
              }}
              draggable={false}
            />
          </>
        ) : null}
      </div>

      <p className="border-t border-white/[0.06] px-4 py-2 text-center text-[11px] text-slate-500">
        {t("fullscreenHint")}
      </p>

      <p className="border-t border-white/5 px-4 py-1.5 text-center text-[11px] text-slate-500">
        {t("qualityPerPhotoHint")}
      </p>

      <div className="border-t border-white/[0.08] bg-black/40 px-4 py-3">
        <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-400" htmlFor="quality-inspector-comment">
          {t("qualityInspectorCommentLabel")}
        </label>
        <textarea
          id="quality-inspector-comment"
          rows={3}
          value={reviewComment}
          onChange={(e) => {
            setReviewComment(e.target.value);
            setCommentError(null);
          }}
          disabled={busy}
          placeholder={t("qualityInspectorCommentPlaceholder")}
          className="mt-2 w-full resize-y rounded-xl border border-white/[0.12] bg-[rgba(3,6,14,0.75)] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/15 disabled:opacity-50"
        />
        <p className="mt-1.5 text-[11px] text-slate-500">{t("qualityInspectorCommentHint")}</p>
        {commentError && <p className="mt-2 text-xs text-rose-400">{commentError}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/[0.08] bg-black/35 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          disabled={busy}
          onClick={() => void applyDecision("FE")}
          className="rounded-xl bg-amber-500/90 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-400 disabled:opacity-50"
        >
          {t("actionFe")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void applyDecision("ERROR")}
          className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-rose-500 disabled:opacity-50"
        >
          {t("actionError")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void applyDecision("OK")}
          className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/25 transition hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50"
        >
          {t("actionOk")}
        </button>
      </div>
    </div>
  );
}
