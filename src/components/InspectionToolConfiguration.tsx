"use client";
import { useState } from "react";
import { Pencil, Plus, Settings, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
type Configuration = {
  revision: string;
  profiles: { id: string; name: string; active: number }[];
  tools: { id: string; name: string; active: number }[];
  links: { profileId: string; toolId: string; active: number; required: number; displayOrder: number }[];
};
export function InspectionToolConfiguration({ token }: { token: string }) {
  const [open,setOpen]=useState(false),[data,setData]=useState<Configuration|null>(null);
  const [profile,setProfile]=useState(""),[selected,setSelected]=useState<Record<string,boolean>>({});
  const [name,setName]=useState(""),[editing,setEditing]=useState<string|null>(null),[search,setSearch]=useState("");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const field="rounded-lg border border-white/15 bg-[#080d16] px-3 py-2 text-sm text-white";
  function selectProfile(id:string,next:Configuration) {
    setProfile(id);setSelected(Object.fromEntries(next.links.filter(l=>l.profileId===id&&Number(l.active)&&next.tools.some(t=>t.id===l.toolId&&Number(t.active))).sort((a,b)=>a.displayOrder-b.displayOrder).map(l=>[l.toolId,Boolean(Number(l.required))])));
  }
  async function show() {
    setOpen(true);setBusy(true);setMessage("");
    try{const next=await apiFetch<Configuration>("/quality-inspections/config/tools",{token});setData(next);selectProfile(next.profiles.find(p=>Number(p.active))?.id||"",next);}
    catch(e){setMessage(e instanceof Error?e.message:"No se pudo cargar la configuración.");}finally{setBusy(false);}
  }
  async function save(path:string,method:string,body:object) {
    if(!data)return;setBusy(true);setMessage("");
    try{const next=await apiFetch<Configuration>(path,{token,method,body:JSON.stringify({...body,expectedRevision:data.revision})});setData(next);selectProfile(profile,next);setName("");setEditing(null);setMessage("Cambios guardados.");}
    catch(e){setMessage(e instanceof Error?e.message:"No se pudo guardar.");}finally{setBusy(false);}
  }
  return <>
    <button type="button" onClick={()=>void show()} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm"><Settings size={17}/>Herramientas</button>
    {open&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3" onClick={()=>{if(!busy)setOpen(false);}}>
      <section role="dialog" aria-modal="true" aria-label="Administrar herramientas" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/15 bg-[#0b111b] p-5" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Herramientas por perfil</h2><button title="Cerrar" aria-label="Cerrar" disabled={busy} onClick={()=>setOpen(false)}><X size={20}/></button></div>
        {message&&<p role="status" className="my-3 text-sm text-amber-200">{message}</p>}
        {data&&<>
          <form className="my-4 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void save("/quality-inspections/config/tools"+(editing?`/${editing}`:""),editing?"PATCH":"POST",{name});}}>
            <input aria-label="Nombre de herramienta" className={`${field} min-w-0 flex-1`} maxLength={128} required value={name} onChange={e=>setName(e.target.value)}/>
            <button disabled={busy} className="flex items-center gap-2 rounded-lg bg-teal-400 px-3 py-2 text-sm font-semibold text-slate-950">{editing?<Pencil size={16}/>:<Plus size={16}/ >}{editing?"Guardar nombre":"Agregar"}</button>
            {editing&&<button type="button" disabled={busy} onClick={()=>{setEditing(null);setName("");}} className={field}>Cancelar</button>}
          </form>
          <div className="flex flex-wrap gap-3 border-y border-white/10 py-4">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">Perfil<select disabled={busy} className={field} value={profile} onChange={e=>selectProfile(e.target.value,data)}>{data.profiles.filter(p=>Number(p.active)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">Buscar<input className={field} value={search} onChange={e=>setSearch(e.target.value)}/></label>
          </div>
          <div className="max-h-[42vh] overflow-y-auto divide-y divide-white/10">
            {data.tools.filter(t=>t.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(tool=><div key={tool.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <label className="flex min-w-0 flex-1 items-center gap-2"><input type="checkbox" disabled={busy||!Number(tool.active)||!profile} checked={tool.id in selected} onChange={e=>setSelected(current=>{const next={...current};if(e.target.checked)next[tool.id]=true;else delete next[tool.id];return next;})}/><span className="break-words">{tool.name}{!Number(tool.active)&&" (inactiva)"}</span></label>
              {tool.id in selected&&<label className="flex items-center gap-2"><input type="checkbox" disabled={busy} checked={selected[tool.id]} onChange={e=>setSelected({...selected,[tool.id]:e.target.checked})}/>Requerida</label>}
              <button title="Editar nombre" aria-label={`Editar ${tool.name}`} disabled={busy} onClick={()=>{setEditing(tool.id);setName(tool.name);}}><Pencil size={16}/></button>
              <button className="text-xs text-sky-200" disabled={busy} onClick={()=>void save(`/quality-inspections/config/tools/${tool.id}`,"PATCH",{active:!Number(tool.active)})}>{Number(tool.active)?"Desactivar":"Activar"}</button>
            </div>)}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3"><span className="text-sm text-slate-300">{Object.keys(selected).length} seleccionadas</span><button disabled={busy||!profile||Object.keys(selected).length<5} onClick={()=>void save(`/quality-inspections/config/profiles/${profile}/tools`,"PUT",{tools:Object.entries(selected).map(([toolId,required])=>({toolId,required}))})} className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">Guardar checklist</button></div>
        </>}
      </section>
    </div>}
  </>;
}
