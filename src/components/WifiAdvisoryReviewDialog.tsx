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

export function WifiAdvisoryReviewDialog(props: Props) {
  const { detail, token, readOnly, onClose, onReviewed } = props;
  const [reason, setReason] = useState("");
  const [observations, setObservations] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!props.open) return null;

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
