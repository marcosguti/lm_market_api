import Joi from 'joi';

export const verifyMobilePaymentSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required(),
  bankCode: Joi.string().trim().length(4).required(),
  deliveryAddress: Joi.string().trim().min(1).max(500).optional(),
  deliveryLatitude: Joi.number().min(-90).max(90).optional(),
  deliveryLongitude: Joi.number().min(-180).max(180).optional(),
  nationalId: Joi.string().trim().min(3).max(20).required(),
  phone: Joi.string().trim().min(3).max(20).required(),
  reference: Joi.string().trim().min(3).max(100).required(),
}).and('deliveryLatitude', 'deliveryLongitude');
