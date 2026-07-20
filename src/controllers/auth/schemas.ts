import Joi from 'joi';

import { personNameSchema } from '../../utils/personName.js';
import { phoneSchema } from '../../utils/phone.js';

const normalizedEmailSchema = Joi.string().email().trim().lowercase().required();

export const registerSchema = Joi.object({
  address: Joi.string().allow(''),
  deviceId: Joi.string().optional(),
  email: normalizedEmailSchema,
  firstName: personNameSchema.required(),
  lastName: personNameSchema.required(),
  numberId: Joi.string().required(),
  numberIdType: Joi.string().valid('V', 'E', 'P', 'J').required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .required()
    .messages({
      'string.min': 'La contraseña debe tener al menos 8 caracteres',
      'string.pattern.base': 'La contraseña debe contener mayúsculas, minúsculas y números',
    }),
  phone: phoneSchema,
  type: Joi.string().valid('client', 'admin', 'deliveryDriver').default('client'),
});

export const loginSchema = Joi.object({
  deviceId: Joi.string().required(),
  email: normalizedEmailSchema,
  password: Joi.string().required(),
});

export const sendVerificationCodeSchema = Joi.object({
  email: normalizedEmailSchema,
});

export const verifyEmailSchema = Joi.object({
  code: Joi.string()
    .pattern(/^\d{4}$/)
    .required()
    .messages({
      'string.pattern.base': 'El código debe tener 4 dígitos',
    }),
  deviceId: Joi.string().required(),
  email: normalizedEmailSchema,
});

export const sendLoginCodeSchema = Joi.object({
  email: normalizedEmailSchema,
});

export const verifyLoginCodeSchema = Joi.object({
  code: Joi.string()
    .pattern(/^\d{4}$/)
    .required()
    .messages({
      'string.pattern.base': 'El código debe tener 4 dígitos',
    }),
  deviceId: Joi.string().required(),
  email: normalizedEmailSchema,
});

export const requestResetSchema = Joi.object({
  email: normalizedEmailSchema,
});

export const resetPasswordSchema = Joi.object({
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .required()
    .messages({
      'string.min': 'La contraseña debe tener al menos 8 caracteres',
      'string.pattern.base': 'La contraseña debe contener mayúsculas, minúsculas y números',
    }),
  token: Joi.string().required(),
});

export const validatePasswordResetTokenSchema = Joi.object({
  token: Joi.string().required(),
}).options({ convert: true });

export const updateProfileSchema = Joi.object({
  address: Joi.string().allow('').optional(),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  phone: phoneSchema.optional(),
});

export const putDeliveryAddressSchema = Joi.object({
  expectedCity: Joi.string().valid('merida', 'tovar').optional(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .required()
    .messages({
      'string.min': 'La contraseña debe tener al menos 8 caracteres',
      'string.pattern.base': 'La contraseña debe contener mayúsculas, minúsculas y números',
    }),
});

export const refreshSchema = Joi.object({
  deviceId: Joi.string().required(),
  refreshToken: Joi.string().required(),
});

export const putPushTokenSchema = Joi.object({
  platform: Joi.string().valid('android', 'ios').required(),
  token: Joi.string().trim().min(10).required(),
});

export const deletePushTokenSchema = Joi.object({
  token: Joi.string().trim().min(10).required(),
});
