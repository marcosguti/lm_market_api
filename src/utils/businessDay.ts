/**
 * Business calendar day helpers for America/Caracas (UTC-4, no DST).
 *
 * Query params like `createdFrom=YYYY-MM-DD` should be treated as Caracas calendar
 * days. Prefer parsing the date-only string explicitly; when Joi has already turned
 * it into a Date (UTC midnight), use UTC Y/M/D parts.
 */

const CARACAS_UTC_OFFSET_HOURS = 4;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type CalendarDateParts = { day: number; month: number; year: number };

export function calendarDatePartsUtc(input: Date): CalendarDateParts {
  return {
    day: input.getUTCDate(),
    month: input.getUTCMonth() + 1,
    year: input.getUTCFullYear(),
  };
}

/**
 * @deprecated Prefer half-open ranges with startOfNextBusinessDayCaracas.
 * Inclusive end of calendar day in America/Caracas (23:59:59.999-04:00).
 */
export function endOfBusinessDayCaracas(input: Date | string): Date {
  return new Date(startOfNextBusinessDayCaracas(input).getTime() - 1);
}

export function parseDateOnlyParts(input: Date | string): CalendarDateParts {
  if (typeof input === 'string') {
    const trimmed = input.trim().slice(0, 10);
    const match = DATE_ONLY_RE.exec(trimmed);
    if (match) {
      return {
        day: Number(match[3]),
        month: Number(match[2]),
        year: Number(match[1]),
      };
    }
    return calendarDatePartsUtc(new Date(input));
  }
  return calendarDatePartsUtc(input);
}

/** Start of calendar day in America/Caracas (00:00:00.000-04:00). */
export function startOfBusinessDayCaracas(input: Date | string): Date {
  return startOfCaracasDayFromParts(parseDateOnlyParts(input));
}

/** Exclusive end bound: start of the next Caracas calendar day. */
export function startOfNextBusinessDayCaracas(input: Date | string): Date {
  const { day, month, year } = parseDateOnlyParts(input);
  return startOfCaracasDayFromParts({ day: day + 1, month, year });
}

function startOfCaracasDayFromParts({ day, month, year }: CalendarDateParts): Date {
  return new Date(Date.UTC(year, month - 1, day, CARACAS_UTC_OFFSET_HOURS, 0, 0, 0));
}
