import { describe, expect, it } from 'vitest';

import { translateJoiDetails, translateJoiError } from '../joiTranslate.js';

describe('translateJoiError', () => {
  it('translates required field errors', () => {
    expect(
      translateJoiError({
        type: 'any.required',
        context: { label: 'email' },
      }),
    ).toBe('"email" es requerido');
  });

  it('translates string.min with limit', () => {
    expect(
      translateJoiError({
        type: 'string.min',
        context: { label: 'password', limit: 8 },
      }),
    ).toBe('"password" debe tener al menos 8 caracteres');
  });

  it('falls back for unknown types', () => {
    expect(
      translateJoiError({
        type: 'custom.unknown',
        context: { label: 'field' },
      }),
    ).toBe('"field" es inválido');
  });
});

describe('translateJoiDetails', () => {
  it('joins multiple messages', () => {
    expect(
      translateJoiDetails([
        { type: 'any.required', context: { label: 'a' } },
        { type: 'any.required', context: { label: 'b' } },
      ]),
    ).toBe('"a" es requerido; "b" es requerido');
  });

  it('returns default for empty details', () => {
    expect(translateJoiDetails([])).toBe('Datos inválidos');
  });
});
