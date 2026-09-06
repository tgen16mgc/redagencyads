export type ReportingRange = { since: string; until: string };

export const PERIOD_PRESETS = [7, 30, 90] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export function isPeriodPreset(days: number): days is PeriodPreset {
  return (PERIOD_PRESETS as readonly number[]).includes(days);
}

export function inclusiveDays(range: ReportingRange) {
  if (!validDate(range.since) || !validDate(range.until) || range.since > range.until) return 0;
  const since = new Date(`${range.since}T00:00:00Z`).getTime();
  const until = new Date(`${range.until}T00:00:00Z`).getTime();
  if (Number.isNaN(since) || Number.isNaN(until)) return 0;
  return Math.max(1, Math.round((until - since) / 86_400_000) + 1);
}

export function rangeFromDays(days: number, until: string): ReportingRange {
  const end = until || new Date().toISOString().slice(0, 10);
  if (!validDate(end) || !Number.isInteger(days) || days < 1 || days > 3660) return { since: "", until: "" };
  const start = new Date(`${end}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { since: start.toISOString().slice(0, 10), until: end };
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
