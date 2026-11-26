"use client";

import {useCallback,useEffect,useRef,useState} from 'react';
import {Plus,RefreshCw,X,Mail,Phone,Trash2} from 'lucide-react';
import {useAuth} from '@/lib/AuthProvider';
import {apiFetch} from '@/lib/api';
import {CalendarDateField} from '@/components/CalendarDateField';

type Order={productionId:number;id?:string;orderNumber:string;workDate:string|null;technicianCard:string;technicianName:string;technicianEmail:string|null;supervisorName:string;supervisorCard:string;region:string;process:string;workName:string;customerName:string;contact1:string;contact2:string;contact3:string;priority:string;status?:string;inspectionId?:string|null};
type Pool={id:string;title:string;notes:string|null;region:string;status:string;assigneeName:string;assigneeRole:string;total?:number;pending?:number;completed?:number;inProgress?:number};
type Options={assignees:{id:string;card:string;name:string;role:string;region:string|null}[];facets:{region:string;process:string;supervisorCard:string;supervisorName:string}[];scopedRegion:string|null};
const initial={fromDate:'',toDate:'',order:'',technician:'',supervisor:'',region:'',process:''};
const field='h-11 min-w-0 w-full rounded-lg border border-white/10 bg-[#080d15] px-3 text-sm text-white';
const labels:Record<string,string>={ACTIVE:'Activo',CANCELLED:'Cancelado',COMPLETED:'Completada',IN_PROGRESS:'En proceso',PENDING:'Pendiente',UNAVAILABLE:'No disponible',ADMIN:'Administrador',SUPERVISOR:'Supervisor',INSPECTOR:'Inspector',WAREHOUSE:'Almacén (consulta)'};
function date(value:string|null){return value?new Intl.DateTimeFormat('es-DO',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value.slice(0,10)+'T12:00:00Z')):'Sin fecha';}
function Contacts({row}:{row:Order}){return <div className="space-y-1"><span className="block">{row.customerName||'Sin nombre'}</span>{[...new Set([row.contact1,row.contact2,row.contact3].filter(Boolean))].map(value=><a key={value} className="flex items-center gap-1 text-xs text-sky-200" href={'tel:'+value.replace(/[^+\d]/g,'')}><Phone size={12}/>{value}</a>)}</div>;}

export default function InspectionDispatchPage(){
  const {token,employee}=useAuth();
  const [filters,setFilters]=useState(initial),[options,setOptions]=useState<Options>({assignees:[],facets:[],scopedRegion:null});
  const [rows,setRows]=useState<Order[]>([]),[total,setTotal]=useState(0),[truncated,setTruncated]=useState(false),[selected,setSelected]=useState<number[]>([]);
  const [pools,setPools]=useState<Pool[]>([]),[tab,setTab]=useState('orders'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [create,setCreate]=useState(false),[notes,setNotes]=useState(''),[assigneeId,setAssigneeId]=useState('');
  const [detail,setDetail]=useState<{pool:Pool;items:Order[];revision:string}|null>(null),[confirmCancel,setConfirmCancel]=useState<string|null>(null);
  const [editingPool,setEditingPool]=useState<{pool:Pool;revision:string}|null>(null);
  const [removeOrder,setRemoveOrder]=useState<Order|null>(null);
  const editIntent=useRef<{body:string;id:string}|null>(null);
  const intent=useRef<{body:string;id:string}|null>(null);
  const chosen=rows.filter(r=>selected.includes(r.productionId)),region=chosen[0]?.region||'';
  const load=useCallback(async(query:typeof initial)=>{
    if(!token||employee?.role!=='ADMIN')return;
    setBusy(true);setError('');setSelected([]);
    try{
      const qs=new URLSearchParams(Object.entries(query).filter(([,v])=>v));
      const result=await apiFetch<{items:Order[];total:number;truncated:boolean}>('/inspection-dispatch/candidates?'+qs,{token});
      setRows(result.items);setTotal(result.total);setTruncated(result.truncated);
      const list=await apiFetch<{items:Pool[]}>('/inspection-dispatch/pools',{token});setPools(list.items);
    }catch(e){setRows([]);setTotal(0);setTruncated(false);setError(e instanceof Error?e.message:'No se pudo consultar el despacho.');}finally{setBusy(false);}
  },[token,employee?.role]);
  const loadRef=useRef(load);loadRef.current=load;
  useEffect(()=>{
    if(!token||employee?.role!=='ADMIN')return;
    let current=true;
    apiFetch<Options>('/inspection-dispatch/options',{token}).then(o=>{if(current)setOptions(o);}).catch(e=>{if(current)setError(e.message);});
    void loadRef.current(initial);return()=>{current=false;};
  },[token,employee?.role]);
  async function openPool(id:string){if(!token)return;setBusy(true);setError('');try{setDetail(await apiFetch('/inspection-dispatch/pools/'+id,{token}));}catch(e){setError(e instanceof Error?e.message:'No se pudo abrir el pool.');}finally{setBusy(false);}}
  async function save(){
    if(!token)return;
    setBusy(true);setError('');
    const body={notes:notes.trim(),assigneeId,productionIds:[...selected].sort((a,b)=>a-b)};
    const signature=JSON.stringify(body);
    if(intent.current?.body!==signature)intent.current={body:signature,id:crypto.randomUUID()};
    try{const result=await apiFetch<{id:string}>('/inspection-dispatch/pools',{token,method:'POST',body:JSON.stringify({...body,clientUuid:intent.current!.id})});setCreate(false);setNotes('');setAssigneeId('');intent.current=null;setTab('pools');await load(filters);await openPool(result.id);}
    catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el pool.');}finally{setBusy(false);}
  }
  async function cancel(){if(!token||!confirmCancel)return;setBusy(true);setError('');try{await apiFetch('/inspection-dispatch/pools/'+confirmCancel+'/cancel',{token,method:'POST',body:'{}'});setConfirmCancel(null);setDetail(null);await load(filters);}catch(e){setError(e instanceof Error?e.message:'No se pudo cancelar.');}finally{setBusy(false);}}
  async function editPoolOrders(poolId:string,revision:string,productionIds:number[],removeItemIds:string[]){
    if(!token)return;setBusy(true);setError('');
    const body={expectedRevision:revision,productionIds,removeItemIds},signature=JSON.stringify({poolId,...body});
    if(editIntent.current?.body!==signature)editIntent.current={body:signature,id:crypto.randomUUID()};
    try{await apiFetch('/inspection-dispatch/pools/'+poolId+'/orders',{token,method:'POST',body:JSON.stringify({...body,requestId:editIntent.current!.id})});editIntent.current=null;setEditingPool(null);setRemoveOrder(null);setTab('pools');await load(filters);await openPool(poolId);}
    catch(e){setError(e instanceof Error?e.message:'No se pudo editar el pool.');}finally{setBusy(false);}
  }
  if(employee?.role!=='ADMIN')return <p role="alert" className="text-rose-300">Acceso reservado a administradores.</p>;
  const change=(key:keyof typeof initial,value:string)=>setFilters(f=>({...f,[key]:value}));
  const regions=[...new Set(options.facets.map(f=>f.region).filter(Boolean))],processes=[...new Set(options.facets.map(f=>f.process).filter(Boolean))];
  const supervisors=[...new Map(options.facets.filter(f=>!filters.region||f.region===filters.region).filter(f=>f.supervisorCard).map(f=>[f.supervisorCard,f])).values()];
  return <div className="min-w-0 space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><h1 className="text-2xl font-bold">Despacho de inspecciones</h1><div className="flex flex-wrap gap-2"><button title="Actualizar despacho" aria-label="Actualizar despacho" disabled={busy} onClick={()=>void load(filters)} className="rounded-lg border border-white/15 p-3 disabled:opacity-40"><RefreshCw size={18} className={busy?'animate-spin':''}/></button>
      {editingPool?<><button disabled={busy||!selected.length||region!==editingPool.pool.region} onClick={()=>void editPoolOrders(editingPool.pool.id,editingPool.revision,selected,[])} className="flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"><Plus size={17}/>Agregar al pool ({selected.length})</button><button disabled={busy} onClick={()=>{setEditingPool(null);setSelected([]);}} className="text-sm text-slate-300">Cancelar selección</button></>:<button disabled={busy||!selected.length} onClick={()=>{setCreate(true);setError('');}} className="flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"><Plus size={17}/>Crear pool ({selected.length})</button>}
    </div></header>
    {editingPool&&<p className="border-l-2 border-sky-400 pl-3 text-sm text-sky-200">Agregar órdenes a {editingPool.pool.title} · {editingPool.pool.region}</p>}
    {options.scopedRegion&&<p className="text-xs text-amber-200">Región asignada: {options.scopedRegion}</p>}
    {error&&<p role="alert" className="border-l-2 border-rose-400 pl-3 text-sm text-rose-300">{error}</p>}
    <div className="grid gap-4 border-y border-white/10 py-4 sm:grid-cols-3">{[['Órdenes disponibles',total],['Seleccionadas',selected.length],['Pools activos',pools.filter(p=>p.status==='ACTIVE').length]].map(([name,value])=><div key={name}><p className="text-xs text-slate-400">{name}</p><p className="mt-1 text-2xl font-semibold text-teal-200">{value}</p></div>)}</div>
    <div role="group" aria-label="Vista del despacho" className="flex gap-2">{[['orders','Órdenes disponibles'],['pools','Pools de trabajo']].map(([id,name])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)} className={'border-b-2 px-3 py-2 text-sm '+(tab===id?'border-teal-400 text-teal-200':'border-transparent text-slate-400')}>{name}</button>)}</div>
    {tab==='orders'?<>
      <section className="grid gap-3 border-b border-white/10 pb-5 sm:grid-cols-2 xl:grid-cols-4">
        <CalendarDateField id="dispatch-from" label="Desde fecha" value={filters.fromDate} onChange={v=>change('fromDate',v)} openLabel="Abrir calendario inicial"/>
        <CalendarDateField id="dispatch-to" label="Hasta fecha" value={filters.toDate} onChange={v=>change('toDate',v)} openLabel="Abrir calendario final"/>
        <input className={field} aria-label="Orden" placeholder="Número de OT" value={filters.order} onChange={e=>change('order',e.target.value)}/>
        <input className={field} aria-label="Técnico" placeholder="Tarjeta o nombre del técnico" value={filters.technician} onChange={e=>change('technician',e.target.value)}/>
        <select className={field} aria-label="Región" value={filters.region} onChange={e=>setFilters(f=>({...f,region:e.target.value,supervisor:''}))}><option value="">Todas las regiones permitidas</option>{regions.map(v=><option key={v}>{v}</option>)}</select>
        <select className={field} aria-label="Supervisor" value={filters.supervisor} onChange={e=>change('supervisor',e.target.value)}><option value="">Todos los supervisores</option>{supervisors.map(v=><option key={v.supervisorCard} value={v.supervisorCard}>{v.supervisorName} · {v.supervisorCard}</option>)}</select>
        <select className={field} aria-label="Proceso" value={filters.process} onChange={e=>change('process',e.target.value)}><option value="">Todos los procesos</option>{processes.map(v=><option key={v}>{v}</option>)}</select>
        <div className="flex gap-2"><button disabled={busy} onClick={()=>void load(filters)} className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950">Aplicar filtros</button><button disabled={busy} onClick={()=>{setFilters(initial);void load(initial);}} className="rounded-lg border border-white/15 px-3 text-sm">Limpiar</button></div>
      </section>
      {truncated&&<p className="text-sm text-amber-200">Se muestran las primeras 300 órdenes. Filtre por fecha, región o técnico para reducir el listado.</p>}
      {chosen.length>0&&<p className="text-xs text-slate-400">Pool: {region} · {selected.length} / 200 órdenes</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-white/15 text-xs text-slate-400"><tr><th className="p-3"><input type="checkbox" aria-label="Seleccionar órdenes visibles de la misma región" checked={!!selected.length&&rows.filter(r=>r.region===region).slice(0,200).every(r=>selected.includes(r.productionId))} disabled={busy||!rows.length} onChange={e=>{const target=region||rows[0]?.region;setSelected(e.target.checked?rows.filter(r=>r.region===target).slice(0,200).map(r=>r.productionId):[]);}}/></th>{['Fecha','OT','Región / proceso','Técnico','Supervisor','Cliente / contactos','Trabajo'].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.productionId} className="border-b border-white/5 hover:bg-white/[0.025]"><td className="p-3"><input type="checkbox" aria-label={'Seleccionar OT '+row.orderNumber} checked={selected.includes(row.productionId)} disabled={busy||(!selected.includes(row.productionId)&&(selected.length>=200||!!region&&row.region!==region))} onChange={e=>setSelected(s=>e.target.checked?[...s,row.productionId]:s.filter(id=>id!==row.productionId))}/></td><td className="whitespace-nowrap p-3 text-slate-400">{date(row.workDate)}</td><td className="p-3 font-mono text-teal-200">{row.orderNumber}</td><td className="p-3">{row.region}<span className="block text-xs text-slate-500">{row.process}</span></td><td className="min-w-44 p-3">{row.technicianName}<span className="block text-xs text-slate-500">{row.technicianCard}</span>{row.technicianEmail&&<a href={'mailto:'+encodeURIComponent(row.technicianEmail)} className="mt-1 flex items-center gap-1 text-xs text-sky-200"><Mail size={12}/>{row.technicianEmail}</a>}</td><td className="min-w-40 p-3">{row.supervisorName}<span className="block text-xs text-slate-500">{row.supervisorCard}</span></td><td className="min-w-44 p-3"><Contacts row={row}/></td><td className="min-w-40 p-3 text-slate-400">{row.workName}<span className="block text-xs text-amber-200">{row.priority}</span></td></tr>)}{!rows.length&&<tr><td colSpan={8} className="py-12 text-center text-slate-500">{busy?'Consultando órdenes…':'Sin órdenes elegibles para estos filtros.'}</td></tr>}</tbody></table></div>
    </>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-white/15 text-xs text-slate-400"><tr>{['Pool','Región','Responsable','Órdenes','Pendientes','En proceso','Completadas','Estado',''].map((h,i)=><th className="p-3" key={i}>{h}</th>)}</tr></thead><tbody>{pools.map(p=><tr key={p.id} className="border-b border-white/5"><td className="p-3">{p.title}</td><td className="p-3">{p.region}</td><td className="p-3">{p.assigneeName}<span className="block text-xs text-slate-500">{labels[p.assigneeRole]}</span></td><td className="p-3">{p.total}</td><td className="p-3">{p.pending}</td><td className="p-3">{p.inProgress}</td><td className="p-3 text-teal-200">{p.completed}</td><td className="p-3">{labels[p.status]}</td><td className="p-3"><button disabled={busy} onClick={()=>void openPool(p.id)} className="text-sky-200">Ver pool</button></td></tr>)}{!pools.length&&<tr><td colSpan={9} className="py-12 text-center text-slate-500">Sin pools registrados.</td></tr>}</tbody></table></div>}
    {(create||detail||confirmCancel)&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3"><section role="dialog" aria-modal="true" aria-label={create?'Crear pool':confirmCancel?'Cancelar pool':'Detalle del pool'} className="max-h-[90dvh] w-full max-w-6xl overflow-y-auto rounded-lg border border-white/15 bg-[#0b1019] p-5 shadow-2xl">
      <header className="mb-5 flex items-start justify-between gap-3"><h2 className="text-xl font-semibold">{create?'Crear pool':confirmCancel?'Cancelar pool':detail?.pool.title}</h2><button aria-label="Cerrar ventana" title="Cerrar" disabled={busy} onClick={()=>{setCreate(false);setDetail(null);setConfirmCancel(null);setRemoveOrder(null);}} className="p-1"><X size={20}/></button></header>
      {error&&<p role="alert" className="mb-4 text-sm text-rose-300">{error}</p>}
      {create?<form className="mx-auto max-w-xl space-y-4" onSubmit={e=>{e.preventDefault();void save();}}>
        <p className="text-sm text-slate-400">{region} · {selected.length} órdenes</p>
        <label className="block text-xs text-slate-400">Responsable<select required className={field+' mt-1'} value={assigneeId} onChange={e=>setAssigneeId(e.target.value)}><option value="">Seleccionar usuario</option>{options.assignees.filter(a=>!a.region||a.region.trim().toUpperCase()===region.toUpperCase()).map(a=><option key={a.id} value={a.id}>{a.name} · {a.card} · {labels[a.role]}</option>)}</select></label>
        <p className="text-sm text-teal-200">Nombre automático: {assigneeId?`Pool ${options.assignees.find(a=>a.id===assigneeId)?.card} - ${new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santo_Domingo'}).format(new Date())}`:'Seleccione un responsable'}</p>
        <label className="block text-xs text-slate-400">Observaciones<textarea maxLength={1000} rows={3} className={field+' mt-1 h-auto py-2'} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <button disabled={busy||!selected.length} className="rounded-lg bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40">{busy?'Guardando…':'Crear y asignar pool'}</button>
      </form>:confirmCancel?<div className="space-y-4"><p>¿Cancelar las órdenes pendientes de este pool? El historial y las inspecciones registradas se conservarán.</p><button disabled={busy} onClick={()=>void cancel()} className="rounded-lg bg-rose-500 px-4 py-2 font-semibold text-white">Confirmar cancelación</button></div>:detail&&<>
        <p className="mb-4 text-sm text-slate-400">{detail.pool.region} · {detail.pool.assigneeName} · {labels[detail.pool.status]}</p>
        {detail.pool.notes&&<p className="mb-4 whitespace-pre-wrap text-sm">{detail.pool.notes}</p>}
        {removeOrder&&<div className="mb-4 border-y border-rose-400/30 py-3 text-sm"><p>¿Quitar la OT {removeOrder.orderNumber} de este pool?</p><div className="mt-2 flex gap-4"><button disabled={busy} className="text-rose-300" onClick={()=>void editPoolOrders(detail.pool.id,detail.revision,[],[removeOrder.id!])}>Confirmar retiro</button><button disabled={busy} onClick={()=>setRemoveOrder(null)}>Volver</button></div></div>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['OT','Fecha','Técnico / correo','Supervisor','Cliente / contactos','Estado',''].map((h,i)=><th key={i} className="p-3 text-xs text-slate-500">{h}</th>)}</tr></thead><tbody>{detail.items.map(o=><tr key={o.id} className="border-t border-white/10"><td className="p-3 font-mono text-teal-200">{o.orderNumber}</td><td className="p-3">{date(o.workDate)}</td><td className="p-3">{o.technicianName} · {o.technicianCard}<span className="block text-xs text-slate-400">{o.technicianEmail||'Sin correo registrado'}</span></td><td className="p-3">{o.supervisorName}</td><td className="p-3"><Contacts row={o}/></td><td className="p-3">{labels[o.status||'PENDING']}</td><td className="p-3">{detail.pool.status==='ACTIVE'&&!o.inspectionId&&<button disabled={busy} title={'Quitar OT '+o.orderNumber} aria-label={'Quitar OT '+o.orderNumber} onClick={()=>setRemoveOrder(o)} className="text-rose-300"><Trash2 size={17}/></button>}</td></tr>)}</tbody></table></div>
        {detail.pool.status==='ACTIVE'&&<div className="mt-5 flex flex-wrap gap-5"><button disabled={busy} className="flex items-center gap-2 text-sm text-sky-200" onClick={()=>{setEditingPool({pool:detail.pool,revision:detail.revision});setDetail(null);setTab('orders');const next={...initial,region:detail.pool.region};setFilters(next);void load(next);}}><Plus size={17}/>Agregar órdenes</button><button disabled={busy} className="text-sm text-rose-300" onClick={()=>setConfirmCancel(detail.pool.id)}>Cancelar pool</button></div>}
      </>}
    </section></div>}
  </div>;
}
