"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Bot, Download, ExternalLink, Send, LoaderCircle } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { apiFetch, ApiError } from "@/lib/api";

type Manual = "panel" | "app";
type HelpAnswer = { answer: string; engine: "MANUAL" | "OPENAI"; version: string; notice?: string | null;
  sources: { id: string; manual: Manual; title: string; page: number }[] };
const files = { panel: "/manuals/flupy-time-panel.pdf", app: "/manuals/flupy-time-auditores.pdf" };

export default function HelpPage() {
  const { token } = useAuth();
  const { locale } = useI18n();
  const en = locale === "en";
  const [tab, setTab] = useState<"manual" | "assistant">("manual");
  const [manual, setManual] = useState<Manual>("panel");
  const [page, setPage] = useState(1);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<HelpAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    setQuestion(""); setResult(null); setError(null); setBusy(false);
    return () => { active.current?.abort(); active.current = null; };
  }, [token]);
  const title = manual === "panel" ? (en ? "Administrative panel manual" : "Manual del panel administrativo")
    : (en ? "Auditors App manual" : "Manual de la App para auditores");
  const url = `${files[manual]}#page=${page}&view=FitH`;
  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (!token || busy || !question.trim()) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(null); setResult(null);
    const timeout = setTimeout(() => controller.abort(), 40000);
    try {
      const value = await apiFetch<HelpAnswer>("/help/assistant", { token, method: "POST", signal: controller.signal,
        body: JSON.stringify({ question: question.trim(), surface: manual }) });
      if (active.current !== controller) return;
      setResult(value);
    } catch (err) {
      if (active.current !== controller) return;
      if (controller.signal.aborted) setError(en ? "The request timed out. The manual is still available." : "La consulta no se completó a tiempo. El manual sigue disponible.");
      else if (err instanceof ApiError) setError(err.status === 404
        ? (en ? "Deploy the Help backend to enable the assistant." : "Falta desplegar la ayuda en el backend. Puede consultar el manual.") : err.message);
      else setError(en ? "No connection. You can open or download the manual." : "No hay conexión. Puede abrir o descargar el manual.");
    } finally { clearTimeout(timeout); if (active.current === controller) { setBusy(false); active.current = null; } }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{en ? "Help" : "Ayuda"}</h1>
      <span className="text-sm text-slate-400">{en ? "Manuals in Spanish · Edition 26/11/2026" : "Manuales en español · Edición 26/11/2026"}</span>
    </div>
    <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-4">
      <div className="inline-flex rounded-lg border border-white/15 p-1" role="tablist" aria-label={en ? "Help views" : "Vistas de ayuda"}>
        {([['manual', BookOpen, en ? 'Manual' : 'Manual'], ['assistant', Bot, en ? 'Assistant' : 'Asistente']] as const).map(([key, Icon, label]) =>
          <button type="button" key={key} id={`tab-${key}`} role="tab" aria-selected={tab === key} aria-controls={`view-${key}`} onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${tab === key ? 'bg-teal-400/15 text-teal-200' : 'text-slate-400 hover:text-white'}`}><Icon size={17} aria-hidden />{label}</button>)}
      </div>
      <select aria-label={en ? "Select manual" : "Seleccionar manual"} value={manual} disabled={busy} onChange={e => {
        setManual(e.target.value as Manual); setPage(1); setResult(null); setError(null);
      }} className="min-w-0 max-w-full rounded-lg border border-white/15 bg-[#0b111b] px-3 py-2 text-sm">
        <option value="panel">{en ? "Administrative panel" : "Panel administrativo"}</option>
        <option value="app">{en ? "App for auditors" : "App para auditores"}</option>
      </select>
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-sky-300"><ExternalLink size={16} aria-hidden />{en ? "Open PDF" : "Abrir PDF"}</a>
      <a href={files[manual]} download className="inline-flex items-center gap-2 text-sm text-sky-300"><Download size={16} aria-hidden />{en ? "Download" : "Descargar"}</a>
    </div>
    {tab === "manual" ? <section id="view-manual" role="tabpanel" aria-labelledby="tab-manual">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <iframe key={url} src={url} title={title} className="h-[72vh] min-h-[420px] w-full rounded-lg border border-white/15 bg-white" />
    </section> : <section id="view-assistant" role="tabpanel" aria-labelledby="tab-assistant" className="max-w-3xl space-y-5">
      <h2 className="text-lg font-semibold">{en ? "Manual assistant" : "Asistente del manual"}</h2>
      <form onSubmit={ask} className="space-y-3">
        <label htmlFor="help-question" className="block text-sm font-medium">{en ? "Your question" : "Tu pregunta"}</label>
        <textarea id="help-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={600} disabled={busy} required rows={4}
          aria-describedby="help-privacy" className="w-full resize-y rounded-lg border border-white/15 bg-[#0b111b] p-3 text-sm focus:border-teal-400 focus:outline-none" />
        <p id="help-privacy" className="text-xs text-slate-400">{en ? "Your question may be sent to AI. Do not include names, employee cards, orders, customer information or credentials." : "La pregunta puede enviarse a la IA. No incluya nombres, tarjetas, órdenes, datos del cliente ni credenciales."}</p>
        <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{question.length}/600</span>
          <button type="submit" disabled={busy || !question.trim() || !token} className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
            {busy ? <LoaderCircle size={17} className="animate-spin" aria-hidden /> : <Send size={17} aria-hidden />}{busy ? (en ? "Consulting" : "Consultando") : (en ? "Ask assistant" : "Consultar asistente")}
          </button></div>
      </form>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div aria-live="polite" aria-busy={busy}>
        {result && <article className="space-y-4 border-t border-white/10 pt-5">
          <h3 className="font-semibold">{result.engine === 'OPENAI' ? (en ? 'AI guidance' : 'Orientación con IA') : (en ? 'Manual guidance' : 'Orientación del manual')}</h3>
          {result.notice && <p className="text-sm text-amber-200">{result.notice}</p>}
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{result.answer}</p>
          {result.sources.length > 0 && <div className="space-y-2"><h4 className="text-sm font-medium text-slate-400">{en ? 'Manual sections' : 'Secciones del manual'}</h4>
            {result.sources.map(source => <button type="button" key={source.id} onClick={() => {
              setManual(source.manual); setPage(source.page); setTab('manual');
            }} className="flex max-w-full items-start gap-2 text-left text-sm text-sky-300 hover:underline"><BookOpen size={16} className="mt-1 shrink-0" aria-hidden /><span>{source.title} · {en ? 'Page' : 'Página'} {source.page}</span></button>)}
          </div>}
        </article>}
      </div>
    </section>}
  </div>;
}
