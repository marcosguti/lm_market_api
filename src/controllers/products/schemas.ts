import Joi from 'joi';

export const getProductsQuerySchema = Joi.object({
  brand: Joi.string().allow('').optional(),
  department: Joi.string().allow('').optional(),
  maxPrice: Joi.number().min(1).max(50).optional(),
  minPrice: Joi.number().min(0).max(49).optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(200).default(50),
  search: Joi.string().allow('').optional(),
  sort: Joi.string().valid('priceAsc', 'priceDesc').allow(null, '').optional().empty([null, '']),
  storeId: Joi.string().trim().uuid().required(),
});
