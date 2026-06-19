import Joi from 'joi';

export function normalizeDescription(value: unknown): null | string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

export function parseMultipartBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return undefined;
}

export const createBannerSchema = Joi.object({
  active: Joi.boolean().required(),
  description: Joi.string().max(300).allow(null, '').optional().default(null),
});

export const updateBannerSchema = Joi.object({
  active: Joi.boolean().optional(),
  description: Joi.string().max(300).allow(null, '').optional(),
});
