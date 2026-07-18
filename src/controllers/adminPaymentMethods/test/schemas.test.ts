import { describe, expect, it } from 'vitest';

import { patchPaymentMethodConfigSchema } from '../schemas.js';

describe('patchPaymentMethodConfigSchema', () => {
  it('accepts partial updates', () => {
    const { error, value } = patchPaymentMethodConfigSchema.validate({
      active: false,
      information: 'Cuenta Zelle: demo@example.com',
      noteEnabled: true,
      placeholder: 'Sube el comprobante',
    });
    expect(error).toBeUndefined();
    expect(value.active).toBe(false);
    expect(value.noteEnabled).toBe(true);
  });

  it('rejects empty body', () => {
    const { error } = patchPaymentMethodConfigSchema.validate({});
    expect(error).toBeDefined();
  });

  it('rejects placeholder longer than 200', () => {
    const { error } = patchPaymentMethodConfigSchema.validate({
      placeholder: 'x'.repeat(201),
    });
    expect(error).toBeDefined();
  });

  it('accepts null information and placeholder', () => {
    const { error, value } = patchPaymentMethodConfigSchema.validate({
      information: null,
      placeholder: null,
    });
    expect(error).toBeUndefined();
    expect(value.information).toBeNull();
    expect(value.placeholder).toBeNull();
  });
});
