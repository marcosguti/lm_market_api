import Joi from 'joi';

export { paginationQuerySchema } from '../commonSchema.js';

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
  deliveryAddress: Joi.string().trim().min(1).max(500).optional(),
  deliveryLatitude: Joi.number().min(-90).max(90).optional(),
  deliveryLongitude: Joi.number().min(-180).max(180).optional(),
  method: Joi.string().valid('cash', 'zelle', 'mobilePayment', 'binance').required(),
  note: Joi.string().trim().max(100).allow(null, '').optional(),
  paidAt: Joi.date().iso().allow(null).optional(),
  reference: Joi.string().trim().min(3).max(100).allow(null, '').optional(),
}).and('deliveryLatitude', 'deliveryLongitude');
