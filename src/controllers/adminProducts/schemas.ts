import { Prisma } from '@prisma/client';
import Joi from 'joi';

const decimalField = (label: string) =>
  Joi.alternatives()
    .try(Joi.number(), Joi.string().trim())
    .required()
    .custom((v, helpers) => {
      const d = new Prisma.Decimal(String(v));
      if (d.isNaN()) return helpers.error('any.invalid', { message: `${label} must be a number` });
      if (d.lt(0)) return helpers.error('any.invalid', { message: `${label} must be >= 0` });
      return d;
    });

const optionalDecimalField = (label: string) =>
  Joi.alternatives()
    .try(Joi.number(), Joi.string().trim(), Joi.allow(null, ''))
    .optional()
    .empty([null, ''])
    .custom((v, helpers) => {
      if (v === undefined) return undefined;
      const d = new Prisma.Decimal(String(v));
      if (d.isNaN()) return helpers.error('any.invalid', { message: `${label} must be a number` });
      if (d.lt(0)) return helpers.error('any.invalid', { message: `${label} must be >= 0` });
      return d;
    });

const optionalIntField = (label: string) =>
  Joi.number()
    .integer()
    .optional()
    .min(0)
    .messages({
      'number.base': `${label} must be an integer`,
      'number.min': `${label} must be >= 0`,
    });

export const listQuerySchema = Joi.object({
  active: Joi.string().valid('all', 'true', 'false').optional().default('all'),
  brand: Joi.string().allow('').optional(),
  department: Joi.string().allow('').optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(200).default(50),
  search: Joi.string().allow('').optional(),
  sort: Joi.string().valid('priceAsc', 'priceDesc').allow(null, '').optional().empty([null, '']),
});

export const createSchema = Joi.object({
  active: Joi.boolean().optional().default(true),
  adminMovements: optionalIntField('adminMovements'),
  brand: Joi.string().trim().min(1).required(),
  code: Joi.string().trim().min(1).max(128).required(),
  cost: decimalField('cost'),
  department: Joi.string().trim().min(1).required(),
  description: Joi.string().trim().allow('').optional().empty(''),
  imageUrl: Joi.alternatives()
    .try(Joi.string().uri({ scheme: ['http', 'https'] }), Joi.string().valid(''))
    .optional()
    .empty(''),
  initialBalance: optionalIntField('initialBalance'),
  inventoryValueBs: optionalDecimalField('inventoryValueBs'),
  marginPct: optionalDecimalField('marginPct'),
  name: Joi.string().trim().min(1).required(),
  price: decimalField('price'),
  salesToday: optionalIntField('salesToday'),
  totalStock: optionalIntField('totalStock'),
});

export const patchSchema = Joi.object({
  brand: Joi.string().trim().min(1).optional(),
  department: Joi.string().trim().min(1).optional(),
  description: Joi.string().trim().allow('').optional().empty(''),
  imageUrl: Joi.alternatives()
    .try(Joi.string().uri({ scheme: ['http', 'https'] }), Joi.string().valid(''))
    .optional(),
}).min(1);
