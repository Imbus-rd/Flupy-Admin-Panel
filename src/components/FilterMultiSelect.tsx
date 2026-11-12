"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

type Option = { id: string; name: string };
export function FilterMultiSelect({ label, options, value, onChange, disabled = false }: {
  label: string; options: Option[]; value: string[]; onChange: (values: string[]) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), searchInput = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    searchInput.current?.focus();
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const visible = options.filter(option => normalize(option.name).includes(normalize(search)));
  const selected = options.filter(option => value.includes(option.id));
  return <div ref={root} className="relative min-w-0 space-y-1 text-xs text-slate-400">
    <span id={id + "-label"}>{label}</span>
    <button ref={trigger} type="button" aria-label={label} aria-expanded={open} aria-controls={id} disabled={disabled}
      onClick={() => { setOpen(!open); setSearch(""); }}
      title={selected.map(option => option.name).join("; ")}
      className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#080d15] px-3 text-left text-sm text-white focus:border-teal-400 focus:outline-none disabled:opacity-40">
      <span className="truncate">{!value.length ? "Todos" : value.length === 1 ? selected[0]?.name || value[0] : value.length + " seleccionados"}</span><ChevronDown size={16} className="shrink-0" />
    </button>
    {open && <div id={id} role="group" aria-labelledby={id + "-label"} className="absolute left-0 right-0 top-full z-40 mt-1 min-w-0 rounded-lg border border-white/20 bg-[#101823] p-2 text-slate-100 shadow-xl">
      <div className="flex items-center gap-2 border-b border-white/10 pb-2"><Search size={15} className="shrink-0" /><input ref={searchInput} aria-label={"Buscar " + label} placeholder="Buscar" value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-full min-w-0 bg-transparent text-sm outline-none" /><button type="button" aria-label={"Limpiar " + label} title="Limpiar selección" disabled={!value.length} onClick={() => onChange([])} className="p-1 disabled:opacity-30"><X size={16} /></button></div>
      <div className="max-h-60 overflow-y-auto overscroll-contain py-1">
        {!visible.length && <p className="p-2 text-slate-400">Sin opciones</p>}
        {visible.map(option => <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-white/5">
          <input type="checkbox" checked={value.includes(option.id)} disabled={!value.includes(option.id) && value.length >= 200} onChange={e => onChange(e.target.checked ? [...value, option.id] : value.filter(item => item !== option.id))} className="mt-0.5 accent-teal-400" />
          <span className="min-w-0 break-words leading-5">{option.name}</span>
        </label>)}
      </div>
    </div>}
  </div>;
}
