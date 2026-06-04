import type { CompareMode } from "./types";

type DateRange = {
  since: string;
  until: string;
};

export function getCompareRange(range: DateRange, mode: CompareMode) {
  if (mode === "off") return range;

  const sinceDate = parseDateInput(range.since);
  const untilDate = parseDateInput(range.until);

  if (mode === "wow") {
    return {
      since: toDateInput(addDays(sinceDate, -7)),
      until: toDateInput(addDays(untilDate, -7)),
    };
  }

  if (mode === "mom") {
    return {
      since: toDateInput(shiftMonthsClamped(sinceDate, -1)),
      until: toDateInput(shiftMonthsClamped(untilDate, -1)),
    };
  }

  return {
    since: toDateInput(shiftYearsClamped(sinceDate, -1)),
    until: toDateInput(shiftYearsClamped(untilDate, -1)),
  };
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addDays(value: Date, days: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
}

function shiftMonthsClamped(value: Date, monthDelta: number) {
  const targetMonthIndex = value.getMonth() + monthDelta;
  const targetYear = value.getFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = modulo(targetMonthIndex, 12);
  const targetDay = Math.min(value.getDate(), getDaysInMonth(targetYear, targetMonth));
  return new Date(targetYear, targetMonth, targetDay);
}

function shiftYearsClamped(value: Date, yearDelta: number) {
  const targetYear = value.getFullYear() + yearDelta;
  const targetMonth = value.getMonth();
  const targetDay = Math.min(value.getDate(), getDaysInMonth(targetYear, targetMonth));
  return new Date(targetYear, targetMonth, targetDay);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
