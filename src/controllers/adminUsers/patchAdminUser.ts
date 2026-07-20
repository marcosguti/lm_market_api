import type { UserType } from '@prisma/client';
import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { assertAdminCanManageUser, StoreScopeError } from '../../middlewares/storeScope.js';
import { assertStoreActive, StoreNotFoundError } from '../../queries/store.js';
import {
  findUserByEmail,
  findUserById,
  findUserByNumberId,
  findUserByPhone,
  updateUserByAdmin,
} from '../../queries/user.js';
import { patchSchema } from './schemas.js';
import { isPrismaUniqueError, serializeUser } from './userUtils.js';

export async function patchAdminUser(req: AuthRequest, res: Response): Promise<void> {
  const validation = patchSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const id = typeof req.params['id'] === 'string' ? req.params['id'] : req.params['id']?.[0];
  if (!id) {
    res.status(400).json({ error: 'Id de usuario inválido' });
    return;
  }
  const body = validation.value;
  const existing = await findUserById(id);
  if (!existing) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }

  const isSuper = req.userType === 'superAdmin';

  if (body.type === 'admin' && !isSuper) {
    res.status(403).json({ error: 'Acceso denegado' });
    return;
  }
  if (body.storeId !== undefined && !isSuper) {
    res.status(403).json({ error: 'Acceso denegado' });
    return;
  }

  try {
    assertAdminCanManageUser(req.userType, req.storeId, existing);
  } catch (err) {
    if (err instanceof StoreScopeError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    throw err;
  }

  const nextType = (body.type ?? existing.type) as UserType;

  if (!isSuper && req.userType === 'admin' && nextType === 'deliveryDriver' && !req.storeId) {
    res.status(403).json({ error: 'Acceso denegado' });
    return;
  }

  let nextStoreId: null | string;
  if (!needsStore(nextType)) {
    nextStoreId = null;
  } else if (isSuper) {
    if (body.storeId !== undefined) {
      nextStoreId = body.storeId;
    } else {
      nextStoreId = existing.storeId;
    }
  } else {
    // Admin: never take storeId from body; keep/force actor store for drivers.
    nextStoreId = req.storeId ?? null;
  }

  if (needsStore(nextType) && !nextStoreId) {
    res.status(400).json({ error: '"storeId" is required' });
    return;
  }

  if (nextStoreId) {
    try {
      await assertStoreActive(nextStoreId);
    } catch (err) {
      if (err instanceof StoreNotFoundError) {
        res.status(err.statusCode).json({ code: err.code, error: err.message });
        return;
      }
      throw err;
    }
  }

  if (body.email !== undefined && body.email !== existing.email) {
    const clash = await findUserByEmail(body.email);
    if (clash && clash.id !== id) {
      res.status(409).json({ error: 'Email ya registrado' });
      return;
    }
  }
  if (body.numberId !== undefined && body.numberId !== existing.numberId) {
    const clash = await findUserByNumberId(body.numberId);
    if (clash && clash.id !== id) {
      res.status(409).json({ error: 'Cédula ya registrada' });
      return;
    }
  }
  if (body.phone !== undefined && body.phone !== existing.phone) {
    if (body.phone) {
      const clash = await findUserByPhone(body.phone);
      if (clash && clash.id !== id) {
        res.status(409).json({ error: 'Teléfono ya registrado' });
        return;
      }
    }
  }

  const shouldUpdateStore = nextStoreId !== existing.storeId;

  try {
    const user = await updateUserByAdmin(id, {
      ...(body.address !== undefined && { address: body.address }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.firstName !== undefined && { firstName: body.firstName }),
      ...(body.lastName !== undefined && { lastName: body.lastName }),
      ...(body.numberId !== undefined && { numberId: body.numberId }),
      ...(body.numberIdType !== undefined && { numberIdType: body.numberIdType }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.type !== undefined && { type: body.type }),
      ...(shouldUpdateStore && { storeId: nextStoreId }),
    });
    res.json({ user: serializeUser(user) });
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      res.status(409).json({ error: 'El email, la cédula o el teléfono ya existe' });
      return;
    }
    throw err;
  }
}

function needsStore(type: string | UserType): boolean {
  return type === 'admin' || type === 'deliveryDriver';
}
