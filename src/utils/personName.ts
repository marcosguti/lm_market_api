import Joi from 'joi';

export const PERSON_NAME_PATTERN = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+$/;

export function isValidPersonName(value: null | string | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }

  return PERSON_NAME_PATTERN.test(trimmed);
}

export const personNameSchema = Joi.string().trim().pattern(PERSON_NAME_PATTERN).messages({
  'string.pattern.base': 'solo puede contener letras',
});
