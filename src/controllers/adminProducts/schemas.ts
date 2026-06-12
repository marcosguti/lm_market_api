import Joi from 'joi';

const storeEntrySchema = Joi.object({
  price: Joi.number().min(0).required(),
  stockQuantity: Joi.number().integer().min(0).required(),
  storeId: Joi.string().required(),
});

export const listQuerySchema = Joi.object({
  active: Joi.string().valid('all', 'true', 'false').optional().default('all'),
  brand: Joi.string().allow('').optional(),
  department: Joi.string().allow('').optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(200).default(50),
  search: Joi.string().allow('').optional(),
  sort: Joi.string().valid('priceAsc', 'priceDesc').allow(null, '').optional().empty([null, '']),
  storeId: Joi.string().allow('').optional(),
});

export const createSchema = Joi.object({
  active: Joi.boolean().optional().default(true),
  brand: Joi.string().trim().min(1).required(),
  code: Joi.string().trim().min(1).max(128).required(),
  department: Joi.string().trim().min(1).required(),
  description: Joi.string().trim().allow('').optional().empty(''),
  name: Joi.string().trim().min(1).required(),
  stores: Joi.array().items(storeEntrySchema).optional(),
});

export const patchSchema = Joi.object({
  brand: Joi.string().trim().min(1).optional(),
  department: Joi.string().trim().min(1).optional(),
  description: Joi.string().trim().allow('').optional().empty(''),
  stores: Joi.array().items(storeEntrySchema).optional(),
}).min(1);
