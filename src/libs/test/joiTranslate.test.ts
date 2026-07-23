import { describe, expect, it } from 'vitest';

import {
  joiValidationErrorMessage,
  translateJoiDetails,
  translateJoiError,
} from '../joiTranslate.js';

describe('translateJoiError', () => {
  it('translates required field errors with Spanish field labels', () => {
    expect(
      translateJoiError({
        context: { label: 'email' },
        type: 'any.required',
      }),
    ).toBe('correo electrónico es requerido');
  });

  it('translates string.min with Spanish field labels', () => {
    expect(
      translateJoiError({
        context: { label: 'password', limit: 8 },
        type: 'string.min',
      }),
    ).toBe('contraseña debe tener al menos 8 caracteres');
  });

  it('translates email format errors', () => {
    expect(
      translateJoiError({
        context: { label: 'email' },
        type: 'string.email',
      }),
    ).toBe('correo electrónico debe ser un correo electrónico válido');
  });

  it('falls back for unknown types', () => {
    expect(
      translateJoiError({
        context: { label: 'field' },
        type: 'custom.unknown',
      }),
    ).toBe('field es inválido');
  });
});

describe('translateJoiDetails', () => {
  it('joins multiple messages', () => {
    expect(
      translateJoiDetails([
        { context: { label: 'a' }, type: 'any.required' },
        { context: { label: 'b' }, type: 'any.required' },
      ]),
    ).toBe('a es requerido; b es requerido');
  });

  it('returns generic message for empty details', () => {
    expect(translateJoiDetails([])).toBe('Datos inválidos');
  });
});

describe('joiValidationErrorMessage', () => {
  it('uses the first detail', () => {
    expect(
      joiValidationErrorMessage({
        details: [
          { context: { label: 'storeId' }, type: 'any.required' },
          { context: { label: 'email' }, type: 'any.required' },
        ],
      }),
    ).toBe('sede es requerido');
  });
});
