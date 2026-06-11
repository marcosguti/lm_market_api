import Joi from 'joi';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDealDate(value: Date | string): Date {
  if (typeof value === 'string') {
    const match = DATE_ONLY.exec(value.trim());
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  return startOfDay(new Date(value));
}

export function validateDealDateRange(
  startDate: Date,
  endDate: Date,
  options: { requireStartFromToday?: boolean } = {},
): null | string {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const today = startOfDay(new Date());

  if (options.requireStartFromToday && start.getTime() < today.getTime()) {
    return 'La fecha de inicio no puede ser anterior a hoy';
  }
  if (end.getTime() < start.getTime()) {
    return 'La fecha de fin debe ser igual o posterior a la de inicio';
  }
  return null;
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export const createDealSchema = Joi.object({
  description: Joi.string().max(300).allow(null, '').optional(),
  endDate: Joi.date().required(),
  startDate: Joi.date().required(),
}).custom((value, helpers) => {
  const error = validateDealDateRange(value.startDate, value.endDate, {
    requireStartFromToday: true,
  });
  if (error) {
    return helpers.message({ custom: error });
  }
  return value;
});

export const updateDealSchema = Joi.object({
  description: Joi.string().max(300).allow(null, '').optional(),
  endDate: Joi.date().optional(),
  startDate: Joi.date().optional(),
});
