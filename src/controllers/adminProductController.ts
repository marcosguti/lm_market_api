import type { Product } from '@prisma/client';
import type { Response } from 'express';

import { Prisma } from '@prisma/client';
import Joi from 'joi';

import type { AuthRequest } from '../middlewares/auth.js';
import type { AdminProductActiveFilter } from '../queries/product.js';

import {
  createProduct,
  deactivateProductById,
  findAdminProductsPaginated,
  findProductByCode,
  findProductById,
  updateProductById,
} from '../queries/product.js';

const listQuerySchema = Joi.object({
  active: Joi.string().valid('all', 'true', 'false').optional().default('all'),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(200).default(50),
  search: Joi.string().allow('').optional(),
  sort: Joi.string().valid('priceAsc', 'priceDesc').allow(null, '').optional().empty([null, '']),
});

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

const createSchema = Joi.object({
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

const patchSchema = Joi.object({
  brand: Joi.string().trim().min(1).optional(),
  description: Joi.string().trim().allow('').optional().empty(''),
  imageUrl: Joi.alternatives()
    .try(Joi.string().uri({ scheme: ['http', 'https'] }), Joi.string().valid(''))
    .optional(),
}).min(1);

export async function createAdminProduct(req: AuthRequest, res: Response): Promise<void> {
  const validation = createSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const body = validation.value;

  const existing = await findProductByCode(body.code);
  if (existing) {
    res.status(409).json({ error: 'Product code already exists' });
    return;
  }

  try {
    const product = await createProduct({
      active: body.active,
      adminMovements: body.adminMovements ?? null,
      brand: body.brand,
      code: body.code,
      cost: body.cost as Prisma.Decimal,
      department: body.department,
      description: body.description ?? null,
      imageUrl: body.imageUrl ?? null,
      initialBalance: body.initialBalance ?? null,
      inventoryValueBs: (body.inventoryValueBs as Prisma.Decimal | undefined) ?? null,
      marginPct: (body.marginPct as Prisma.Decimal | undefined) ?? null,
      name: body.name,
      price: body.price as Prisma.Decimal,
      salesToday: body.salesToday ?? null,
      totalStock: body.totalStock ?? null,
    });
    res.status(201).json({ product: serializeAdminProduct(product) });
  } catch (e) {
    console.error('[admin-products] create failed', e);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

export async function deleteAdminProduct(req: AuthRequest, res: Response): Promise<void> {
  const id = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];
  if (!id) {
    res.status(400).json({ error: 'Invalid product id' });
    return;
  }

  const existing = await findProductById(id);
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const product = await deactivateProductById(id);
  res.json({ message: 'Product deactivated', product: serializeAdminProduct(product) });
}

export async function listAdminProducts(req: AuthRequest, res: Response): Promise<void> {
  const validation = listQuerySchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { active, page, pageSize, search, sort } = validation.value;

  const result = await findAdminProductsPaginated({
    active: active as AdminProductActiveFilter,
    page,
    pageSize,
    search: search || undefined,
    sort,
  });

  res.json({
    ...result,
    data: result.data.map(serializeAdminProduct),
  });
}

export async function patchAdminProduct(req: AuthRequest, res: Response): Promise<void> {
  const validation = patchSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const id = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];
  if (!id) {
    res.status(400).json({ error: 'Invalid product id' });
    return;
  }

  const existing = await findProductById(id);
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const body = validation.value;
  const data: Prisma.ProductUpdateInput = {};
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null;
  if (body.brand !== undefined) data.brand = body.brand;
  if (body.description !== undefined) data.description = body.description || null;

  const product = await updateProductById(id, data);
  res.json({ product: serializeAdminProduct(product) });
}

function serializeAdminProduct(p: Product) {
  return {
    active: p.active,
    adminMovements: p.adminMovements,
    brand: p.brand,
    code: p.code,
    cost: Number(p.cost.toString()),
    createdAt: p.createdAt,
    department: p.department,
    description: p.description,
    id: p.id,
    imageUrl: p.imageUrl,
    initialBalance: p.initialBalance,
    inventoryValueBs:
      p.inventoryValueBs === null || p.inventoryValueBs === undefined
        ? null
        : Number(p.inventoryValueBs.toString()),
    marginPct:
      p.marginPct === null || p.marginPct === undefined ? null : Number(p.marginPct.toString()),
    name: p.name,
    price: Number(p.price.toString()),
    salesToday: p.salesToday,
    totalStock: p.totalStock,
    updatedAt: p.updatedAt,
  };
}
