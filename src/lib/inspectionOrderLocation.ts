export type InspectionOrderLocation = { status: string; thresholdMeters: number; distanceMeters: number | null; referencePhotoId: string | null; capturedAt?: string | null };
export function inspectionLocationLabel(value?: InspectionOrderLocation | null, locale = "es") {
  const es = locale === "es";
  if (!value) return es ? "Sin verificación al guardar la OT" : "No location verification at order save";
  const distance = value.distanceMeters == null ? "" : value.distanceMeters.toFixed(1) + " m";
  switch (value.status) {
    case "MATCH": return (es ? "Coincide por proximidad: " : "Proximity matches: ") + distance;
    case "OUTSIDE_RADIUS": return (es ? "Fuera del margen de 100 m: " : "Outside 100 m radius: ") + distance;
    case "NO_REFERENCE": return es ? "Sin foto con coordenadas de esta OT y técnico" : "No geotagged photo for this order and technician";
    case "LOW_ACCURACY": return es ? "No verificable: precisión GPS insuficiente" : "Unverified: insufficient GPS accuracy";
    default: return es ? "Sin captura GPS al guardar la OT" : "No GPS capture at order save";
  }
}
