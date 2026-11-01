"use client";

import { useState } from "react";
import Image from "next/image";
import { apiFetch, mediaUrl } from "@/lib/api";

export type WifiPoint = {
  id: string;
  areaName: string;
  pointRole: string;
  representativeRssi?: number | null;
  frequencyMhz?: number | null;
  band?: string | null;
  channel?: number | null;
  sampleCount: number;
  observation?: string | null;
  measurementError?: string | null;
  measuredAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  recommendedChannels?: Array<{ band: string; channel: number; score?: number; networks?: number }>;
  photoUrl?: string | null;
};

export type WifiAdvisoryDetail = {
  id: string;
  status: string;
  diagnosis?: string | null;
  recommendation?: string | null;
  actionTaken?: string | null;
  clientResponse: string;
  clientComment?: string | null;
  points: WifiPoint[];
  reviews: Array<{
    id: string;
    decision: string;
    reason?: string | null;
    observations?: string | null;
    reviewer_name?: string | null;
    created_at?: string | null;
  }>;
};

type Props = {
  open: boolean;
  token: string | null;
  orderId: string;
  technician: string;
  detail: WifiAdvisoryDetail;
  readOnly: boolean;
  onClose: () => void;
  onReviewed: (status: string) => void;
};

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendiente",
    INCOMPLETE: "Incompleta",
    COMPLETE_PENDING_REVIEW: "Pendiente de revisión",
    APPROVED: "Aprobada",
    REJECTED: "Rechazada"
  };
  return labels[String(value || "").toUpperCase()] || value;
}

function distanceMeters(a: WifiPoint | undefined, b: WifiPoint) {
  if (a?.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function signalStyle(rssi?: number | null) {
  const width = Math.max(4, Math.min(100, (((rssi ?? -100) + 100) / 70) * 100));
  const color = rssi == null ? "bg-slate-600" : rssi >= -55 ? "bg-emerald-400" : rssi >= -65 ? "bg-green-400" : rssi >= -70 ? "bg-amber-400" : "bg-rose-500";
  return { width: `${width}%`, color };
}

export function WifiAdvisoryReviewDialog(props: Props) {
  const { detail, token, readOnly, onClose, onReviewed } = props;
  const [reason, setReason] = useState("");
  const [observations, setObservations] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!props.open) return null;
  const routerPoint = detail.points.find((point) => point.pointRole === "ROUTER");
  const channels = Array.from(
    new Map(
      detail.points.flatMap((point) => point.recommendedChannels || [])
        .map((item) => [`${item.band}-${item.channel}`, item] as const)
    ).values()
  );

  async function review(decision: "APPROVED" | "REJECTED") {
    if (!token) return;
    if (decision === "REJECTED" && !reason.trim() && !observations.trim()) {
      setError("Indique el motivo o una observación para rechazar la asesoría.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/wifi-advisories/${detail.id}/review`, {
        method: "POST",
        token,
        body: JSON.stringify({ decision, reason: reason.trim(), observations: observations.trim() })
      });
      onReviewed(decision);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la revisión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto max-w-6xl rounded-xl border border-white/10 bg-[#080d17] p-5 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Asesoría y diagnóstico WiFi</h2>
            <p className="mt-1 text-sm text-slate-400">
              Orden {props.orderId} · {props.technician}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
            Cerrar
          </button>
        </header>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase text-slate-500">Estado</p>
            <p className="mt-1 font-semibold text-teal-300">{statusLabel(detail.status)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase text-slate-500">Puntos medidos</p>
            <p className="mt-1 text-xl font-semibold text-white">{detail.points.length}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase text-slate-500">Respuesta del cliente</p>
            <p className="mt-1 font-semibold text-white">{detail.clientResponse === "ACCEPTED" ? "Aceptó" : detail.clientResponse === "REJECTED" ? "Rechazó" : "Pendiente"}</p>
          </div>
        </div>

        {detail.points.length > 0 && (
          <section className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <h3 className="font-semibold text-white">Cobertura de señal</h3>
              <p className="mt-1 text-xs text-slate-500">Comparación visual y distancia aproximada desde el router.</p>
              <div className="mt-4 space-y-3">
                {detail.points.map((point) => {
                  const signal = signalStyle(point.representativeRssi);
                  const distance = point.pointRole === "ROUTER" ? 0 : distanceMeters(routerPoint, point);
                  return (
                    <div key={`signal-${point.id}`}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-slate-200">{point.areaName}</span>
                        <span className="shrink-0 font-mono text-slate-300">
                          {point.representativeRssi != null ? `${point.representativeRssi} dBm` : "Sin dato"}
                          {distance != null ? ` · ${Math.round(distance)} m` : ""}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${signal.color}`} style={{ width: signal.width }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <h3 className="font-semibold text-white">Canales con mejor disponibilidad</h3>
              <p className="mt-1 text-xs text-slate-500">Estimación según las redes cercanas observadas.</p>
              <div className="mt-4 space-y-3">
                {channels.length === 0 && <p className="text-sm text-slate-500">Sin exploración de canales disponible.</p>}
                {Object.entries(channels.reduce<Record<string, typeof channels>>((acc, item) => {
                  (acc[item.band] ||= []).push(item);
                  return acc;
                }, {})).map(([band, options]) => (
                  <div key={band}>
                    <p className="text-xs font-semibold uppercase text-slate-500">{band}</p>
                    <p className="mt-1 text-sm text-teal-200">{(options || []).slice(0, 3).map((item) => `Canal ${item.channel}`).join(" · ")}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {detail.points.map((point) => (
            <article key={point.id} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
              {point.photoUrl ? (
                <Image unoptimized width={800} height={480} src={mediaUrl(point.photoUrl)} alt={`Evidencia ${point.areaName}`} className="h-48 w-full object-cover" />
              ) : (
                <div className="flex h-28 items-center justify-center bg-slate-900 text-sm text-slate-500">Imagen no disponible</div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{point.areaName}</h3>
                    <p className="text-xs text-slate-500">{point.pointRole.replaceAll("_", " ")}</p>
                  </div>
                  <span className="rounded-md bg-teal-400/10 px-2 py-1 font-mono text-sm text-teal-200">
                    {point.representativeRssi != null ? `${point.representativeRssi} dBm` : "Sin dato"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {[point.band, point.channel != null ? `Canal ${point.channel}` : null, `${point.sampleCount} muestras`].filter(Boolean).join(" · ")}
                </p>
                {point.observation && <p className="mt-2 text-sm text-slate-400">{point.observation}</p>}
                {point.measurementError && <p className="mt-2 text-sm text-rose-300">{point.measurementError}</p>}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h3 className="font-semibold text-white">Diagnóstico</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{detail.diagnosis || "Sin diagnóstico"}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h3 className="font-semibold text-white">Recomendación</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{detail.recommendation || "Sin recomendación"}</p>
            {detail.actionTaken && <p className="mt-3 text-sm text-slate-400"><b>Acción:</b> {detail.actionTaken}</p>}
            {detail.clientComment && <p className="mt-2 text-sm text-slate-400"><b>Cliente:</b> {detail.clientComment}</p>}
          </div>
        </section>

        {!readOnly && detail.status === "COMPLETE_PENDING_REVIEW" && (
          <section className="mt-5 rounded-lg border border-teal-400/20 bg-teal-400/[0.04] p-4">
            <h3 className="font-semibold text-white">Revisión del analista</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white" />
              <textarea value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Observaciones" className="min-h-20 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white" />
            </div>
            {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => void review("REJECTED")} className="rounded-lg bg-rose-500 px-4 py-2 font-semibold text-white disabled:opacity-50">Rechazar</button>
              <button type="button" disabled={busy} onClick={() => void review("APPROVED")} className="rounded-lg bg-teal-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">Aprobar</button>
            </div>
          </section>
        )}

        {detail.reviews.length > 0 && (
          <section className="mt-5 border-t border-white/10 pt-4">
            <h3 className="font-semibold text-white">Historial de revisión</h3>
            {detail.reviews.map((review) => (
              <p key={review.id} className="mt-2 text-sm text-slate-400">
                {statusLabel(review.decision)} · {review.reviewer_name || "Analista"} · {review.reason || review.observations || "Sin comentario"}
              </p>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
