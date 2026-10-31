"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type ConfigRow = {
  work_type: string;
  required: number | boolean;
  min_points: number;
  require_photo_per_point: number | boolean;
  active: number | boolean;
};

export function WifiAdvisoryConfigPanel({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ConfigRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    apiFetch<{ items: ConfigRow[] }>("/admin/wifi-advisory/config", { token })
      .then((response) => setItems(response.items || []))
      .catch((error) => setMessage(error instanceof Error ? error.message : "No se pudo cargar la configuración."));
  }, [open, token]);

  async function save(item: ConfigRow) {
    setMessage(null);
    try {
      await apiFetch(`/admin/wifi-advisory/config/${encodeURIComponent(item.work_type)}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          required: Boolean(item.required),
          minPoints: Number(item.min_points) || 3,
          requirePhotoPerPoint: Boolean(item.require_photo_per_point),
          active: Boolean(item.active)
        })
      });
      setMessage(`Configuración guardada para ${item.work_type}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la configuración.");
    }
  }

  return (
    <section className="rounded-xl border border-sky-400/20 bg-sky-400/[0.04] p-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="font-semibold text-sky-200">
        {open ? "Ocultar configuración WiFi" : "Configurar asesoría WiFi por tipo de trabajo"}
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-400">Solo los tipos habilitados exigirán mediciones antes de que Calidad pueda quedar aprobada.</p>
          {items.map((item, index) => (
            <div key={item.work_type} className="grid items-center gap-3 rounded-lg border border-white/10 bg-slate-950/70 p-3 md:grid-cols-[1fr_auto_auto_auto]">
              <label className="flex items-center gap-2 text-sm text-white">
                <input type="checkbox" checked={Boolean(item.required)} onChange={(event) => setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, required: event.target.checked } : row))} />
                {item.work_type}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                Puntos mínimos
                <input type="number" min={1} max={20} value={item.min_points} onChange={(event) => setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, min_points: Number(event.target.value) } : row))} className="w-16 rounded-md border border-white/10 bg-slate-950 px-2 py-1" />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={Boolean(item.require_photo_per_point)} onChange={(event) => setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, require_photo_per_point: event.target.checked } : row))} />
                Foto por punto
              </label>
              <button type="button" onClick={() => void save(item)} className="rounded-lg bg-sky-400 px-3 py-2 text-sm font-semibold text-slate-950">Guardar</button>
            </div>
          ))}
          {message && <p className="text-sm text-sky-200">{message}</p>}
        </div>
      )}
    </section>
  );
}
