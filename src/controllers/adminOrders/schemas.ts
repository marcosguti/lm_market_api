import Joi from 'joi';

export { paginationQuerySchema } from '../commonSchema.js';

const ORDER_STATUS_VALUES = [
  'pending',
  'paymentConfirmed',
  'preparing',
  'readyForDelivery',
  'outForDelivery',
  'delivered',
  'cancelled',
] as const;

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export const kitchenListQuerySchema = Joi.object({
  createdFrom: Joi.date().optional(),
  createdTo: Joi.date().optional(),
  id: Joi.string().allow('').optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string()
    .valid('all', ...ORDER_STATUS_VALUES)
    .optional()
    .default('all'),
  storeId: Joi.string().allow('').optional(),
}).custom((value, helpers) => {
  if (value.createdFrom && value.createdTo) {
    const from = startOfDay(new Date(value.createdFrom));
    const to = startOfDay(new Date(value.createdTo));
    if (to.getTime() < from.getTime()) {
      return helpers.message({
        custom: 'La fecha de fin debe ser igual o posterior a la de inicio',
      });
    }
  }
  return value;
});

export const patchStatusSchema = Joi.object({
  status: Joi.string().valid('preparing', 'readyForDelivery', 'delivered', 'cancelled').required(),
});
