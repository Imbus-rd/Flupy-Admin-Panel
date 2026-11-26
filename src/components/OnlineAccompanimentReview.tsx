"use client";
import { useEffect,useState } from "react";
import { apiFetch } from "@/lib/api";
export type AccompanimentReview={accompanimentId:string;sourceRevision:string;canReview:boolean;decision:"OK"|"ERROR"|null;comment:string|null;stale:boolean;reviewedAt?:string;auditorName?:string;auditorCard?:string;compliancePercent:number|null};
export function OnlineAccompanimentReview({id,token,editable,onSaved}:{id:string;token:string;editable:boolean;onSaved:()=>void}) {
  const [data,setData]=useState<AccompanimentReview|null>(null),[decision,setDecision]=useState(""),[comment,setComment]=useState("");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  useEffect(()=>{let active=true;setData(null);setMessage("");apiFetch<AccompanimentReview>(`/quality-inspections/${id}/accompaniment-review`,{token}).then(r=>{if(active){setData(r);setDecision(r.decision||"");setComment(r.comment||"");}}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[id,token]);
  async function save(){if(!data)return;setBusy(true);setMessage("");try{const next=await apiFetch<AccompanimentReview>(`/quality-inspections/${id}/accompaniment-review`,{token,method:"PUT",body:JSON.stringify({decision,comment,sourceRevision:data.sourceRevision})});setData(next);setMessage("Evaluación guardada para todo el acompañamiento.");onSaved();}catch(e){setMessage(e instanceof Error?e.message:"No se pudo guardar.");}finally{setBusy(false);}}
  return <section className="mt-4 border-y border-white/10 py-4">
    <h3 className="font-semibold">Evaluación del acompañamiento</h3>
    {message&&<p role="status" className="mt-2 text-sm text-amber-200">{message}</p>}
    {data&&<>
      <p className="mt-2 text-sm text-slate-300">{data.stale?"Pendiente: el acompañamiento cambió.":data.decision==="ERROR"?"Error crítico (30/100)":data.decision==="OK"?"OK (100/100)":"Pendiente de evaluación"}</p>
      {editable&&data.canReview?<div className="mt-3 flex flex-col items-start gap-3">
        <div className="flex gap-4">{[["OK","OK"],["ERROR","Error crítico"]].map(([value,label])=><label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name={`review-${id}`} disabled={busy} checked={decision===value} onChange={()=>setDecision(value)}/>{label}</label>)}</div>
        <label className="w-full text-sm">Comentario<textarea className="mt-1 block min-h-24 w-full rounded-lg border border-white/15 bg-[#080d16] p-3" value={comment} maxLength={4000} disabled={busy} onChange={e=>setComment(e.target.value)}/></label>
        <button disabled={busy||!decision||(decision==="ERROR"&&!comment.trim())} onClick={()=>void save()} className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">Guardar evaluación</button>
      </div>:<p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{data.comment||(!data.canReview?"Hay OT abiertas; la evaluación estará disponible al cerrarlas.":"")}</p>}
    </>}
  </section>;
}
