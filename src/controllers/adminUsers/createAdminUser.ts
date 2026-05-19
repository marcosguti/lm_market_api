import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { createHash } from '../../libs/passwordHashing.js';
import { createUser, findUserByEmail, findUserByNumberId } from '../../queries/user.js';
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
