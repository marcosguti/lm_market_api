import { describe, expect, it } from 'vitest';

import {
  endOfBusinessDayCaracas,
  parseDateOnlyParts,
  startOfBusinessDayCaracas,
  startOfNextBusinessDayCaracas,
} from '../businessDay.js';

describe('businessDay (America/Caracas)', () => {
  it('parses YYYY-MM-DD strings without Date timezone shifts', () => {
    expect(parseDateOnlyParts('2026-07-15')).toEqual({
      day: 15,
      month: 7,
      year: 2026,
    });
  });

  it('reads calendar parts from ISO date-only Date (UTC midnight)', () => {
    expect(parseDateOnlyParts(new Date('2026-07-15'))).toEqual({
      day: 15,
      month: 7,
      year: 2026,
    });
  });

  it('maps a calendar day to Caracas half-open UTC bounds', () => {
    expect(startOfBusinessDayCaracas('2026-07-15').toISOString()).toBe('2026-07-15T04:00:00.000Z');
    expect(startOfNextBusinessDayCaracas('2026-07-15').toISOString()).toBe(
      '2026-07-16T04:00:00.000Z',
    );
    expect(endOfBusinessDayCaracas('2026-07-15').toISOString()).toBe('2026-07-16T03:59:59.999Z');
  });

  it('includes afternoon Caracas timestamps for that calendar day', () => {
    const start = startOfBusinessDayCaracas('2026-07-15');
    const next = startOfNextBusinessDayCaracas('2026-07-15');
    const orderAt = new Date('2026-07-15T18:38:07.000Z'); // 2:38 PM Venezuela

    expect(orderAt.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(orderAt.getTime()).toBeLessThan(next.getTime());
  });

  it('excludes previous Caracas afternoon from today window', () => {
    const start = startOfBusinessDayCaracas('2026-07-15');
    const previousAfternoon = new Date('2026-07-14T18:40:17.000Z'); // 2:40 PM Jul 14 VET

    expect(previousAfternoon.getTime()).toBeLessThan(start.getTime());
  });
});
