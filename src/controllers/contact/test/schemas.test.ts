import { describe, expect, it } from 'vitest';

import { createContactSchema } from '../schemas.js';

const validBody = {
  area: 'soporte',
  email: 'Cliente@Test.com',
  message: 'Necesito ayuda con mi pedido, por favor.',
  name: 'Marco',
  subject: 'Ayuda con pedido',
};

describe('createContactSchema', () => {
  it('accepts a valid body and lowercases email', () => {
    const { error, value } = createContactSchema.validate(validBody);
    expect(error).toBeUndefined();
    expect(value.email).toBe('cliente@test.com');
  });

  it('rejects invalid area', () => {
    const { error } = createContactSchema.validate({ ...validBody, area: 'otro' });
    expect(error?.message).toContain('área válida');
  });

  it('rejects invalid email', () => {
    const { error } = createContactSchema.validate({ ...validBody, email: 'no-email' });
    expect(error?.message).toContain('Email no válido');
  });

  it('rejects short message', () => {
    const { error } = createContactSchema.validate({ ...validBody, message: 'corto' });
    expect(error?.message).toContain('al menos 10');
  });

  it('rejects short subject', () => {
    const { error } = createContactSchema.validate({ ...validBody, subject: 'ab' });
    expect(error?.message).toContain('al menos 3');
  });

  it('rejects empty name', () => {
    const { error } = createContactSchema.validate({ ...validBody, name: '' });
    expect(error?.message).toContain('nombre');
  });

  it('rejects short name', () => {
    const { error } = createContactSchema.validate({ ...validBody, name: 'A' });
    expect(error?.message).toContain('al menos 2');
  });
});
