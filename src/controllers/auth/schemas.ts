import Joi from 'joi';

export const registerSchema = Joi.object({
  address: Joi.string().allow(''),
  email: Joi.string().email().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
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
  phone: Joi.string().allow(''),
  type: Joi.string().valid('client', 'admin', 'deliveryDriver').default('client'),
});

export const loginSchema = Joi.object({
  deviceId: Joi.string().allow(''),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const requestResetSchema = Joi.object({
  email: Joi.string().email().required(),
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

export const updateProfileSchema = Joi.object({
  address: Joi.string().allow('').optional(),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  phone: Joi.string().allow('').optional(),
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
  deviceId: Joi.string().allow(''),
  refreshToken: Joi.string().required(),
});
