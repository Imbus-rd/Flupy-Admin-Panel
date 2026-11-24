export type InspectionReviewPhoto = {
  id: string; photoType: string; photoUrl: string; capturedAt?: string;
  inspectorDecision?: string | null; inspectorComment?: string | null;
  errorCode?: string | null; errorStatus?: string | null; errorDescription?: string | null; errorGroup?: string | null;
};

export function inspectionFindingCount(row: { findingsCount?: number; lowRatingGroups: number; missingTools: number; photoFindingCount?: number }) {
  return row.findingsCount ?? (row.lowRatingGroups + row.missingTools + (row.photoFindingCount ?? 0));
}

export function inspectionPhotoReview(photo: InspectionReviewPhoto, locale = "es") {
  const decision = photo.inspectorDecision;
  const label = decision === "OK" ? "OK" : decision === "FE" ? "FE" : decision === "ERROR" ? "Error" : locale === "es" ? "Pendiente" : "Pending";
  const tone = decision === "OK" ? "border-teal-400/30 bg-teal-400/10 text-teal-200"
    : decision === "FE" ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
    : decision === "ERROR" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-white/10 text-slate-400";
  const error = photo.errorCode ? `${photo.errorCode} · ${photo.errorGroup || ""} · ${photo.errorDescription || ""} (${photo.errorStatus === 'C' ? 'Crítico' : photo.errorStatus === 'NC' ? 'No crítico' : 'No imputable'})` : "";
  return { label, tone, comment: [error, photo.inspectorComment?.trim()].filter(Boolean).join("\n"), finding: decision === "FE" || decision === "ERROR" };
}

export function inspectionPhotoTitle(photo: InspectionReviewPhoto, translated: string, locale = "es") {
  if (translated !== `inspectionPhoto${photo.photoType}`) return translated;
  const special: Record<string, string> = locale === "es"
    ? { CUSTOMER_HOME: "Vivienda del cliente", AUDITOR_EXTRA_1: "Evidencia adicional 1", AUDITOR_EXTRA_2: "Evidencia adicional 2" }
    : { CUSTOMER_HOME: "Customer home", AUDITOR_EXTRA_1: "Additional evidence 1", AUDITOR_EXTRA_2: "Additional evidence 2" };
  return special[photo.photoType] || photo.photoType.replaceAll("_", " ");
}
