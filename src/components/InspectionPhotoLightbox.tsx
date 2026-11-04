"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Photo = { id: string; photoType: string; photoUrl: string };

export function InspectionPhotoLightbox({
  photos,
  initialIndex,
  imageUrl,
  photoLabel,
  closeLabel,
  onClose
}: {
  photos: Photo[];
  initialIndex: number;
  imageUrl: (photo: Photo) => string;
  photoLabel: (photo: Photo) => string;
  closeLabel: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const photo = photos[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setIndex((value) => (value - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight") setIndex((value) => (value + 1) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, photos.length]);

  useEffect(() => setZoom(1), [index]);
  if (!photo) return null;

  return <div className="fixed inset-0 z-[70] flex flex-col bg-black/95" onClick={onClose}>
    <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#070b13] px-4 py-3" onClick={(event) => event.stopPropagation()}>
      <div><p className="font-semibold text-white">{photoLabel(photo)}</p><p className="text-xs text-slate-400">{index + 1} / {photos.length}</p></div>
      <div className="flex gap-2">
        <button title="Alejar" onClick={() => setZoom((value) => Math.max(1, value - 0.5))} className="h-10 w-10 rounded-lg border border-white/10 text-xl text-white">−</button>
        <button title="Restablecer zoom" onClick={() => setZoom(1)} className="h-10 min-w-10 rounded-lg border border-white/10 px-3 text-sm text-white">1:1</button>
        <button title="Acercar" onClick={() => setZoom((value) => Math.min(4, value + 0.5))} className="h-10 w-10 rounded-lg border border-white/10 text-xl text-white">+</button>
        <button onClick={onClose} className="rounded-lg border border-white/10 px-4 text-sm text-white">{closeLabel}</button>
      </div>
    </div>
    <div className="relative flex flex-1 items-center justify-center overflow-auto p-6" onClick={(event) => event.stopPropagation()}>
      <Image
        unoptimized
        src={imageUrl(photo)}
        alt={photoLabel(photo)}
        width={1800}
        height={1350}
        className="max-h-[78vh] w-auto max-w-none object-contain transition-transform duration-150"
        style={{ transform: `scale(${zoom})` }}
      />
      {photos.length > 1 && <>
        <button title="Anterior" onClick={() => setIndex((value) => (value - 1 + photos.length) % photos.length)} className="fixed left-4 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full border border-white/15 bg-black/70 text-2xl text-white">‹</button>
        <button title="Siguiente" onClick={() => setIndex((value) => (value + 1) % photos.length)} className="fixed right-4 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full border border-white/15 bg-black/70 text-2xl text-white">›</button>
      </>}
    </div>
  </div>;
}
