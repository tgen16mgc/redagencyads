export type ReportingRange = { since: string; until: string };

export const PERIOD_PRESETS = [7, 30, 90] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export function isPeriodPreset(days: number): days is PeriodPreset {
  return (PERIOD_PRESETS as readonly number[]).includes(days);
}

export function inclusiveDays(range: ReportingRange) {
  const since = new Date(`${range.since}T00:00:00Z`).getTime();
  const until = new Date(`${range.until}T00:00:00Z`).getTime();
  if (Number.isNaN(since) || Number.isNaN(until)) return 0;
  return Math.max(1, Math.round((until - since) / 86_400_000) + 1);
}

export function rangeFromDays(days: number, until: string): ReportingRange {
  const end = until || new Date().toISOString().slice(0, 10);
  const start = new Date(`${end}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { since: start.toISOString().slice(0, 10), until: end };
}
