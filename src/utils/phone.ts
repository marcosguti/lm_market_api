import Joi from 'joi';
import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'VE';

export function normalizePhone(
  input: null | string | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): null | string {
  const trimmed = input?.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed?.isValid()) {
    return null;
  }

  return parsed.format('E.164');
}

export function parsePhone(e164: string): {
  country: CountryCode;
  countryCallingCode: string;
  nationalNumber: string;
} | null {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed?.isValid()) {
    return null;
  }

  return {
    country: parsed.country ?? DEFAULT_PHONE_COUNTRY,
    countryCallingCode: `+${parsed.countryCallingCode}`,
    nationalNumber: parsed.nationalNumber,
  };
}

export const phoneSchema = Joi.custom((value, helpers) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return helpers.error('phone.invalid');
  }

  const normalized = normalizePhone(value);
  if (!normalized) {
    return helpers.error('phone.invalid');
  }

  return normalized;
}).messages({
  'phone.invalid': 'El teléfono no es válido',
});
