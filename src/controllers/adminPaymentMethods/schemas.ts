import type { PaymentMethod } from '@prisma/client';

import Joi from 'joi';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'zelle', 'mobilePayment', 'binance'];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as string[]).includes(value);
}

export const patchPaymentMethodConfigSchema = Joi.object({
  active: Joi.boolean().optional(),
  information: Joi.string().trim().max(2000).allow(null, '').optional(),
  noteEnabled: Joi.boolean().optional(),
  placeholder: Joi.string().trim().max(200).allow(null, '').optional(),
})
  .min(1)
  .messages({
    'object.min': 'Debe enviar al menos un campo para actualizar',
  });
