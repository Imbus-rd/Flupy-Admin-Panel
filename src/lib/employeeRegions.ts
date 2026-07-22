/** Must match backend `employeeRegions.js` and mobile app region picker. */
export const EMPLOYEE_REGIONS = ["Este", "Distrito Este", "Norte", "Sur"] as const;

export function normalizeEmployeeRegionFormValue(region: string | null | undefined): string {
  const s = region != null ? String(region).trim() : "";
  return (EMPLOYEE_REGIONS as readonly string[]).includes(s) ? s : "";
}
