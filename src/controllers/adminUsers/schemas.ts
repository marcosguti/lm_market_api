import Joi from 'joi';

import { phoneSchema } from '../../utils/phone.js';

export const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().allow('').optional(),
});

/** storeId is validated in the controller based on actor role (superAdmin vs admin). */
export const createSchema = Joi.object({
  address: Joi.string().allow('').optional(),
  email: Joi.string().email().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  numberId: Joi.string().required(),
  numberIdType: Joi.string().valid('V', 'E', 'P', 'J').required(),
  password: Joi.forbidden(),
  phone: phoneSchema.optional(),
  storeId: Joi.string().uuid().allow(null).optional(),
  type: Joi.string().valid('admin', 'client', 'deliveryDriver').required(),
});

export const patchSchema = Joi.object({
  address: Joi.string().allow('').optional(),
  email: Joi.string().email().optional(),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  numberId: Joi.string().optional(),
  numberIdType: Joi.string().valid('V', 'E', 'P', 'J').optional(),
  password: Joi.forbidden(),
  phone: phoneSchema.optional(),
  storeId: Joi.string().uuid().allow(null).optional(),
  type: Joi.string().valid('admin', 'client', 'deliveryDriver').optional(),
}).min(1);
