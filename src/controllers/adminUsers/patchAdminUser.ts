import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import {
  findUserByEmail,
  findUserById,
  findUserByNumberId,
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
    });
    res.json({ user: serializeUser(user) });
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      res.status(409).json({ error: 'El email o la cédula ya existe' });
      return;
    }
    throw err;
  }
}
