import type { ClaroMetrics } from "./claroQuality";

export type PerformanceMetrics = {
  overall: { value: number | null; status: string; available: number; total: number; indicators: { id: string; label: string; value: number | null; weight: number }[] };
  claro: ClaroMetrics & { target: number; comparable: boolean };
  qrOffline: { value: number | null; ok: number; evaluated: number };
  qrOnline: { value: number | null; evaluated: number };
  photos: { value: number | null; complete: number; applicable: number };
  attendance: { value: number | null; entryDays: number; knownDays: number; onTimeDays: number };
  usage: { value: number | null; active: number; withPunch: number; withPhotos: number; withoutActivity: number };
  retro: { submissions: number; positive: number | null; targetPerDay: number; daysWithActivity: number; daysWithSubmission: number; value: number | null; status: string };
};
export type PerformancePerson = PerformanceMetrics & { id: string; card: string; name: string; matchedEmployee: boolean };
export type QualityPerformance = {
  summary: PerformanceMetrics; previous: PerformanceMetrics; byTechnician: PerformancePerson[]; bySupervisor: PerformancePerson[];
  byProcess: { process: string; claro: ClaroMetrics }[]; monthly: (PerformanceMetrics & { month: string })[];
  overall: PerformanceMetrics["overall"]; limitations: string[];
};
