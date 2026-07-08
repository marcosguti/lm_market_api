import { describe, expect, it } from 'vitest';

import { isValidPersonName, personNameSchema } from '../personName.js';

describe('isValidPersonName', () => {
  it('accepts names with accents and ñ', () => {
    expect(isValidPersonName('José')).toBe(true);
    expect(isValidPersonName('Niño')).toBe(true);
    expect(isValidPersonName('Gutiérrez')).toBe(true);
    expect(isValidPersonName('Marco')).toBe(true);
  });

  it('rejects numbers, spaces, hyphens and symbols', () => {
    expect(isValidPersonName('Juan123')).toBe(false);
    expect(isValidPersonName('María José')).toBe(false);
    expect(isValidPersonName('Jean-Pierre')).toBe(false);
    expect(isValidPersonName('John@')).toBe(false);
    expect(isValidPersonName('')).toBe(false);
    expect(isValidPersonName('   ')).toBe(false);
  });
});

describe('personNameSchema', () => {
  it('accepts valid names', () => {
    const { error } = personNameSchema.validate('José');
    expect(error).toBeUndefined();
  });

  it('rejects invalid names', () => {
    const { error } = personNameSchema.validate('Juan123');
    expect(error?.message).toContain('solo puede contener letras');
  });
});
