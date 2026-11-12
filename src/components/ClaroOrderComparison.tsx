import { claroMatchLabel, claroOperationalState, type ClaroComparison, type ClaroMatch } from "@/lib/claroQuality";

export function ClaroOrderMatch({ match }: { match?: ClaroMatch }) {
  if (!match) return <span className="text-slate-500">No verificado</span>;
  if (!match.exists) return <span className="text-rose-300">No encontrada</span>;
  return <div className="min-w-36 space-y-1 text-xs"><div className="text-teal-200">{match.records} registro(s) · {match.photoCount} foto(s)</div><div className={match.technicianMatch === "MATCH" ? "text-slate-300" : "text-red-400"}>Técnico: {claroMatchLabel[match.technicianMatch]}</div><div className="break-words text-slate-500">{match.technicianCards.join(", ") || "Sin tarjeta"}</div></div>;
}
export function ClaroOrderComparison({ comparison }: { comparison?: ClaroComparison }) {
  return <section className="border-y border-white/10 py-4"><h3 className="mb-4 font-semibold">Comparación por orden hija</h3><div className="grid gap-5 sm:grid-cols-3">{([['flupy', 'Flupy Time'], ['online', 'QR Online'], ['offline', 'QR Offline']] as const).map(([key, name]) => <div key={key}><h4 className="mb-2 text-sm">{name}</h4><ClaroOrderMatch match={comparison?.[key]} />{comparison?.[key]?.exists && <p className="mt-2 break-words text-xs text-slate-400">Estado: {comparison[key].statuses.map(s => claroOperationalState[s] || s).join(", ")}</p>}</div>)}</div></section>;
}
