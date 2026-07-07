import { describe, expect, it } from 'vitest';

import { verifyMobilePaymentSchema } from '../schemas.js';

describe('verifyMobilePaymentSchema', () => {
  const valid = {
    amount: 10.5,
    bankCode: '0105',
    nationalId: 'V12345678',
    phone: '04141234567',
    reference: 'REF123',
  };

  it('accepts valid payload', () => {
    const { error } = verifyMobilePaymentSchema.validate(valid);
    expect(error).toBeUndefined();
  });

  it('rejects bank code with wrong length', () => {
    const { error } = verifyMobilePaymentSchema.validate({ ...valid, bankCode: '105' });
    expect(error).toBeDefined();
  });

  it('rejects missing reference', () => {
    const { error, value } = verifyMobilePaymentSchema.validate({
      amount: valid.amount,
      bankCode: valid.bankCode,
      nationalId: valid.nationalId,
      phone: valid.phone,
    });
    expect(error).toBeDefined();
    expect(value.reference).toBeUndefined();
  });

  it('rejects non-positive amount', () => {
    const { error } = verifyMobilePaymentSchema.validate({ ...valid, amount: 0 });
    expect(error).toBeDefined();
  });
});
