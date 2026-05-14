import type { User } from '@prisma/client';
import type { Response } from 'express';

import { Prisma } from '@prisma/client';
import Joi from 'joi';

import type { AuthRequest } from '../middlewares/auth.js';

import { createHash } from '../libs/passwordHashing.js';
import {
  createUser,
  deleteUserById,
  findUserByEmail,
  findUserById,
  findUserByNumberId,
  listUsersPaginated,
  updateUserByAdmin,
} from '../queries/user.js';

const DEFAULT_TEMP_PASSWORD = '#123456';

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().allow('').optional(),
});

const createSchema = Joi.object({
  address: Joi.string().allow('').optional(),
  email: Joi.string().email().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  numberId: Joi.string().required(),
  password: Joi.string().min(6).optional(),
  phone: Joi.string().allow('').optional(),
  type: Joi.string().valid('admin', 'client', 'deliveryDriver').required(),
});

const patchSchema = Joi.object({
  address: Joi.string().allow('').optional(),
  email: Joi.string().email().optional(),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  numberId: Joi.string().optional(),
  phone: Joi.string().allow('').optional(),
  type: Joi.string().valid('admin', 'client', 'deliveryDriver').optional(),
}).min(1);

export async function createAdminUser(req: AuthRequest, res: Response): Promise<void> {
  const validation = createSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const body = validation.value;
  const existingEmail = await findUserByEmail(body.email);
  if (existingEmail) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  const existingNumberId = await findUserByNumberId(body.numberId);
  if (existingNumberId) {
    res.status(409).json({ error: 'numberId already registered' });
    return;
  }

  const useDefaultPassword = body.password === undefined || body.password === '';
  const plainPassword = useDefaultPassword ? DEFAULT_TEMP_PASSWORD : body.password;
  const hashedPassword = await createHash(plainPassword);

  try {
    const user = await createUser({
      address: body.address || undefined,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      numberId: body.numberId,
      password: hashedPassword,
      phone: body.phone || undefined,
      type: body.type,
    });
    res.status(201).json({
      ...(useDefaultPassword ? { temporaryPassword: DEFAULT_TEMP_PASSWORD } : {}),
      user: serializeUser(user),
    });
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      res.status(409).json({ error: 'Email or numberId already exists' });
      return;
    }
    throw err;
  }
}

export async function deleteAdminUser(req: AuthRequest, res: Response): Promise<void> {
  const id = typeof req.params['id'] === 'string' ? req.params['id'] : req.params['id']?.[0];
  if (!id) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }
  if (req.userId === id) {
    res.status(403).json({ error: 'Cannot delete your own account' });
    return;
  }
  try {
    await deleteUserById(id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }
}

export async function listAdminUsers(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userType) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const validation = listQuerySchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { page, pageSize, search } = validation.value;
  const { data, total } = await listUsersPaginated({
    actorType: req.userType,
    page,
    pageSize,
    search: search || undefined,
  });
  const totalPages = Math.ceil(total / pageSize) || 1;
  res.json({
    data: data.map(serializeUser),
    page,
    pageSize,
    total,
    totalPages,
  });
}

export async function patchAdminUser(req: AuthRequest, res: Response): Promise<void> {
  const validation = patchSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const id = typeof req.params['id'] === 'string' ? req.params['id'] : req.params['id']?.[0];
  if (!id) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }
  const body = validation.value;
  const existing = await findUserById(id);
  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (body.email !== undefined && body.email !== existing.email) {
    const clash = await findUserByEmail(body.email);
    if (clash && clash.id !== id) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
  }
  if (body.numberId !== undefined && body.numberId !== existing.numberId) {
    const clash = await findUserByNumberId(body.numberId);
    if (clash && clash.id !== id) {
      res.status(409).json({ error: 'numberId already registered' });
      return;
    }
  }

  try {
    const user = await updateUserByAdmin(id, {
      ...(body.address !== undefined && { address: body.address }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.firstName !== undefined && { firstName: body.firstName }),
      ...(body.lastName !== undefined && { lastName: body.lastName }),
      ...(body.numberId !== undefined && { numberId: body.numberId }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.type !== undefined && { type: body.type }),
    });
    res.json({ user: serializeUser(user) });
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      res.status(409).json({ error: 'Email or numberId already exists' });
      return;
    }
    throw err;
  }
}

function isPrismaUniqueError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function serializeUser(user: User) {
  const { password: _p, ...rest } = user;
  return rest;
}
