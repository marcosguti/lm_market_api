import Joi from 'joi';

import { startOfBusinessDayCaracas } from '../../utils/businessDay.js';
import { paginationQuerySchema } from '../commonSchema.js';

export { paginationQuerySchema };

const ORDER_STATUS_VALUES = [
  'pending',
  'paymentPendingConfirmation',
  'paymentConfirmed',
  'preparing',
  'readyForDelivery',
  'assignedToDeliveryDriver',
  'delivering',
  'delivered',
  'cancelled',
] as const;

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
    // Compare Caracas calendar starts only; do not mutate query dates here.
    const from = startOfBusinessDayCaracas(value.createdFrom as Date);
    const to = startOfBusinessDayCaracas(value.createdTo as Date);
    if (to.getTime() < from.getTime()) {
      return helpers.message({
        custom: 'La fecha de fin debe ser igual o posterior a la de inicio',
      });
    }
  }
  return value;
});

export const patchStatusSchema = Joi.object({
  cancellationReason: Joi.when('status', {
    is: 'cancelled',
    otherwise: Joi.forbidden(),
    then: Joi.string().trim().min(3).max(500).required(),
  }),
  status: Joi.string().valid('preparing', 'readyForDelivery', 'cancelled').required(),
});

export const assignDeliverySchema = Joi.object({
  deliveryUserId: Joi.string().uuid().required(),
});
