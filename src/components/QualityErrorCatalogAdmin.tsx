"use client";

import { useCallback,useEffect,useRef,useState } from "react";
import { ListChecks,Pencil,Plus,RefreshCw,X } from "lucide-react";
import { apiFetch,ApiError } from "@/lib/api";

type Entry={code:string;description:string;groupName:string;status:"C"|"NC"|"X";active:boolean;revision:string};
type Draft={code:string;description:string;groupName:string;status:Entry["status"]|"";active:boolean};
const empty:Draft={code:"",description:"",groupName:"",status:"",active:true};
const severity={C:"Crítico",NC:"No crítico",X:"No imputable"};

export function QualityErrorCatalogAdmin({token}:{token:string}) {
  const [open,setOpen]=useState(false),[entries,setEntries]=useState<Entry[]>([]),[loaded,setLoaded]=useState(false);
  const [editing,setEditing]=useState<Entry|null>(null),[draft,setDraft]=useState<Draft>(empty);
  const [search,setSearch]=useState(""),[showInactive,setShowInactive]=useState(false);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[conflict,setConflict]=useState(false);
  const openingButton=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null);
  const editor=useRef<HTMLFormElement>(null);
  const field="mt-1 w-full min-w-0 rounded-lg border border-white/15 bg-[#080d16] px-3 py-2 text-sm text-white outline-none focus:border-teal-400";
  const load=useCallback(async()=>{
    setBusy(true);setMessage("");
    try{const response=await apiFetch<{items:Entry[]}>("/quality-error-catalog/admin",{token});setEntries(response.items);setLoaded(true);setConflict(false);}
    catch(e){setLoaded(false);setMessage(e instanceof Error?e.message:"No se pudo cargar el catálogo.");}
    finally{setBusy(false);}
  },[token]);
  useEffect(()=>{
    if(open){dialog.current?.showModal();void load();}else{dialog.current?.close();}
  },[open,load]);
  function close(){if(busy)return;setOpen(false);setDraft(empty);setEditing(null);setMessage("");setConflict(false);openingButton.current?.focus();}
  function edit(item:Entry){setEditing(item);setDraft({code:item.code,description:item.description,groupName:item.groupName,status:item.status,active:item.active});setMessage("");setConflict(false);requestAnimationFrame(()=>editor.current?.scrollIntoView({block:"nearest"}));}
  async function save(){
    if(!loaded||!draft.status||conflict)return;setBusy(true);setMessage("");
    try{
      const response=await apiFetch<{items:Entry[]}>("/quality-error-catalog/admin"+(editing?`/${encodeURIComponent(editing.code)}`:""),{
        token,method:editing?"PATCH":"POST",body:JSON.stringify({...draft,code:draft.code.trim().toUpperCase(),description:draft.description.trim(),groupName:draft.groupName.trim(),...(editing?{expectedRevision:editing.revision}:{})})
      });
      setEntries(response.items);setEditing(null);setDraft(empty);setMessage("Error guardado.");
    }catch(e){setConflict(e instanceof ApiError&&e.status===409&&Boolean(editing));setMessage(e instanceof Error?e.message:"No se pudo guardar el error.");}
    finally{setBusy(false);}
  }
  const matches=entries.filter(item=>(showInactive||item.active)&&`${item.code} ${item.description} ${item.groupName} ${severity[item.status]}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <>
    <button ref={openingButton} type="button" onClick={()=>setOpen(true)} className="flex items-center gap-2 self-start rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:border-teal-400/40"><ListChecks size={17}/>Catálogo de errores</button>
    <dialog ref={dialog} aria-labelledby="error-catalog-title" onCancel={e=>{e.preventDefault();close();}} className="m-auto max-h-[94dvh] w-[calc(100%-24px)] max-w-6xl overflow-y-auto rounded-lg border border-white/15 bg-[#0b111b] p-5 text-white shadow-2xl backdrop:bg-black/90">
      <header className="mb-4 flex items-center justify-between gap-3"><h2 id="error-catalog-title" className="text-lg font-semibold">Catálogo de errores</h2><div className="flex items-center gap-4"><button type="button" disabled={busy} title="Actualizar catálogo" aria-label="Actualizar catálogo" onClick={()=>{if(editing){setEditing(null);setDraft(empty);}void load();}}><RefreshCw size={18} className={busy?"animate-spin":""}/></button><button type="button" disabled={busy} title="Cerrar catálogo" aria-label="Cerrar catálogo" onClick={close}><X size={20}/></button></div></header>
      {message&&<p role="status" className="mb-4 border-l-2 border-amber-300 pl-3 text-sm text-amber-200">{message}</p>}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-end gap-4"><label className="min-w-0 flex-1 text-sm">Buscar<input className={field} value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)}/>Incluir inactivos</label></div>
          <div className="max-h-[57dvh] overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-[#0b111b] text-xs text-slate-400"><tr>{["Código","Descripción / grupo","Clasificación","Estado",""].map((heading,index)=><th key={index} className="px-2 py-3">{heading}</th>)}</tr></thead>
            <tbody>{matches.map(item=><tr key={item.code} className={`border-t border-white/10 ${editing?.code===item.code?"bg-sky-400/10":""}`}><td className="px-2 py-3 font-mono text-teal-200">{item.code}</td><td className="min-w-48 break-words px-2 py-3"><span>{item.description}</span><span className="mt-1 block text-xs text-slate-400">{item.groupName}</span></td><td className={`px-2 py-3 ${item.status==="C"?"text-rose-300":item.status==="NC"?"text-amber-200":"text-sky-200"}`}>{severity[item.status]}</td><td className="px-2 py-3 text-xs text-slate-300">{item.active?"Activo":"Inactivo"}</td><td className="px-2 py-3"><button type="button" title={`Editar error ${item.code}`} aria-label={`Editar error ${item.code}`} disabled={busy} onClick={()=>edit(item)}><Pencil size={16}/></button></td></tr>)}{!matches.length&&<tr><td colSpan={5} className="p-8 text-center text-slate-400">{busy?"Cargando…":loaded?"Sin resultados":"Catálogo no disponible"}</td></tr>}</tbody></table></div>
          <p className="mt-3 text-xs text-slate-400">{matches.length} errores</p>
        </section>
        <form ref={editor} className="min-w-0 space-y-3 border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" onSubmit={e=>{e.preventDefault();void save();}}>
          <h3 className="font-semibold">{editing?`Editar error ${editing.code}`:"Nuevo error"}</h3>
          <label className="block text-sm">Código<input required disabled={Boolean(editing)||busy||!loaded} maxLength={32} pattern={"[A-Za-z0-9][A-Za-z0-9_\\-]{0,31}"} className={`${field} disabled:text-slate-400`} value={draft.code} onChange={e=>setDraft({...draft,code:e.target.value.toUpperCase()})}/></label>
          <label className="block text-sm">Descripción<textarea aria-label="Descripción" required disabled={busy||!loaded} maxLength={2000} rows={4} className={field} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
          <label className="block text-sm">Grupo<input aria-label="Grupo" required disabled={busy||!loaded} list="error-catalog-groups" maxLength={128} className={field} value={draft.groupName} onChange={e=>setDraft({...draft,groupName:e.target.value})}/><datalist id="error-catalog-groups">{[...new Set(entries.map(item=>item.groupName))].sort().map(group=><option key={group} value={group}/>)}</datalist></label>
          <label className="block text-sm">Clasificación<select aria-label="Clasificación" required disabled={busy||!loaded} className={field} value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Draft["status"]})}><option value="">Seleccionar</option><option value="C">C - Crítico</option><option value="NC">NC - No crítico</option><option value="X">X - No imputable</option></select></label>
          <label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" disabled={busy||!loaded} checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>Activo</label>
          <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy||!loaded||conflict||!draft.code.trim()||!draft.description.trim()||!draft.groupName.trim()||!draft.status} className="flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{editing?<Pencil size={16}/>:<Plus size={16}/ >}{busy?"Guardando…":editing?"Guardar cambios":"Agregar error"}</button>{editing&&<button type="button" disabled={busy} onClick={()=>{setEditing(null);setDraft(empty);setMessage("");setConflict(false);}} className="text-sm text-slate-300">Nuevo error</button>}</div>
        </form>
      </div>
    </dialog>
  </>;
}
