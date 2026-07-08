import { describe, expect, it } from 'vitest';

import { registerSchema, updateProfileSchema } from '../schemas.js';

describe('registerSchema phone', () => {
  const base = {
    address: '',
    deviceId: 'device-1',
    email: 'user@example.com',
    firstName: 'Marco',
    lastName: 'Gutierrez',
    numberId: '17322319',
    numberIdType: 'V',
    password: 'Password1',
    type: 'client',
  };

  it('normalizes a valid Venezuelan phone', () => {
    const { error, value } = registerSchema.validate({
      ...base,
      phone: '04120765408',
    });
    expect(error).toBeUndefined();
    expect(value.phone).toBe('+584120765408');
  });

  it('rejects invalid phone numbers', () => {
    const { error } = registerSchema.validate({
      ...base,
      phone: '123',
    });
    expect(error?.message).toContain('no es válido');
  });

  it('allows empty phone', () => {
    const { error, value } = registerSchema.validate({
      ...base,
      phone: '',
    });
    expect(error).toBeUndefined();
    expect(value.phone).toBeNull();
  });
});

describe('registerSchema person names', () => {
  const base = {
    address: '',
    deviceId: 'device-1',
    email: 'user@example.com',
    firstName: 'José',
    lastName: 'Niño',
    numberId: '17322319',
    numberIdType: 'V',
    password: 'Password1',
    type: 'client',
  };

  it('accepts names with accents and ñ', () => {
    const { error } = registerSchema.validate(base);
    expect(error).toBeUndefined();
  });

  it('rejects names with numbers or spaces', () => {
    const { error: numbersError } = registerSchema.validate({
      ...base,
      firstName: 'Juan123',
    });
    expect(numbersError?.message).toContain('solo puede contener letras');

    const { error: spacesError } = registerSchema.validate({
      ...base,
      lastName: 'María José',
    });
    expect(spacesError?.message).toContain('solo puede contener letras');
  });
});

describe('updateProfileSchema phone', () => {
  it('normalizes phone when provided', () => {
    const { error, value } = updateProfileSchema.validate({
      phone: '04120765408',
    });
    expect(error).toBeUndefined();
    expect(value.phone).toBe('+584120765408');
  });
});
