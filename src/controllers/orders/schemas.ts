import Joi from 'joi';

import { startOfBusinessDayCaracas } from '../../utils/businessDay.js';

export { paginationQuerySchema } from '../commonSchema.js';

/** Client order history: pagination + optional date range + search. */
export const orderHistoryQuerySchema = Joi.object({
  createdFrom: Joi.date().optional(),
  createdTo: Joi.date().optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  q: Joi.string().trim().allow('').max(100).optional(),
}).custom((value, helpers) => {
  if (value.createdFrom && value.createdTo) {
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

export const patchLinesSchema = Joi.object({
  lines: Joi.array()
    .items(
      Joi.object({
        code: Joi.string().trim().required(),
        quantity: Joi.number().integer().min(0).required(),
      }),
    )
    .required(),
  storeId: Joi.string().trim().uuid().optional(),
});

export const confirmPaymentSchema = Joi.object({
  customerNotes: Joi.string().trim().max(280).allow(null, '').optional(),
  deliveryAddress: Joi.string().trim().min(1).max(500).optional(),
  deliveryLatitude: Joi.number().min(-90).max(90).optional(),
  deliveryLongitude: Joi.number().min(-180).max(180).optional(),
  method: Joi.string().valid('cash', 'zelle', 'mobilePayment', 'binance').required(),
  note: Joi.string().trim().max(100).allow(null, '').optional(),
  paidAt: Joi.date().iso().allow(null).optional(),
  reference: Joi.string().trim().min(3).max(100).allow(null, '').optional(),
}).and('deliveryLatitude', 'deliveryLongitude');
