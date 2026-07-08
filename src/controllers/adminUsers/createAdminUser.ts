import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { createHash } from '../../libs/passwordHashing.js';
import {
  createUser,
  findUserByEmail,
  findUserByNumberId,
  findUserByPhone,
} from '../../queries/user.js';
import { createSchema, DEFAULT_TEMP_PASSWORD } from './schemas.js';
import { isPrismaUniqueError, serializeUser } from './userUtils.js';

export async function createAdminUser(req: AuthRequest, res: Response): Promise<void> {
  const validation = createSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const body = validation.value;
  const existingEmail = await findUserByEmail(body.email);
  if (existingEmail) {
    res.status(409).json({ error: 'Email ya registrado' });
    return;
  }
  const existingNumberId = await findUserByNumberId(body.numberId);
  if (existingNumberId) {
    res.status(409).json({ error: 'Cédula ya registrada' });
    return;
  }
  if (body.phone) {
    const existingPhone = await findUserByPhone(body.phone);
    if (existingPhone) {
      res.status(409).json({ error: 'Teléfono ya registrado' });
      return;
    }
  }

  const useDefaultPassword = body.password === undefined || body.password === '';
  const plainPassword = useDefaultPassword ? DEFAULT_TEMP_PASSWORD : body.password;
  const hashedPassword = await createHash(plainPassword);

  try {
    const user = await createUser({
      address: body.address || undefined,
      email: body.email,
      emailVerified: true,
      firstName: body.firstName,
      lastName: body.lastName,
      numberId: body.numberId,
      numberIdType: body.numberIdType,
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
      res.status(409).json({ error: 'El email, la cédula o el teléfono ya existe' });
      return;
    }
    throw err;
  }
}
