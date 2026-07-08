import { describe, expect, it } from 'vitest';

import { normalizePhone, parsePhone } from '../phone.js';

describe('normalizePhone', () => {
  it('returns null for empty input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it('normalizes Venezuelan local numbers to E.164', () => {
    expect(normalizePhone('04120765408')).toBe('+584120765408');
  });

  it('accepts E.164 input', () => {
    expect(normalizePhone('+584120765408')).toBe('+584120765408');
  });

  it('rejects invalid numbers', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
});

describe('parsePhone', () => {
  it('parses E.164 into country and national number', () => {
    expect(parsePhone('+584120765408')).toEqual({
      country: 'VE',
      countryCallingCode: '+58',
      nationalNumber: '4120765408',
    });
  });

  it('returns null for invalid E.164', () => {
    expect(parsePhone('+58123')).toBeNull();
  });
});
