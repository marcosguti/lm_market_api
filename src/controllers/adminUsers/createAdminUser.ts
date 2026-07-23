import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { generateStrongPassword } from '../../libs/generateStrongPassword.js';
import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { createHash } from '../../libs/passwordHashing.js';
import { sendAdminAccountCreatedEmail } from '../../libs/sendEmail/index.js';
import { assertStoreActive, StoreNotFoundError } from '../../queries/store.js';
import {
  createUser,
  findUserByEmail,
  findUserByNumberId,
  findUserByPhone,
} from '../../queries/user.js';
import { createSchema } from './schemas.js';
import { isPrismaUniqueError, serializeUser } from './userUtils.js';

const USER_TYPE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  client: 'Cliente',
  deliveryDriver: 'Reparto',
};

const getWebBaseUrl = (): string =>
  (process.env.WEB_BASE_URL ?? 'https://www.lmmarket.com').replace(/\/$/, '');

export async function createAdminUser(req: AuthRequest, res: Response): Promise<void> {
  const validation = createSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }
  const body = validation.value;
  const isSuper = req.userType === 'superAdmin';

  if (body.type === 'admin' && !isSuper) {
    res.status(403).json({ error: 'Acceso denegado' });
    return;
  }
  if (body.storeId !== undefined && body.storeId !== null && !isSuper) {
    res.status(403).json({ error: 'Acceso denegado' });
    return;
  }

  let storeId: null | string = null;
  if (needsStore(body.type)) {
    if (isSuper) {
      if (!body.storeId) {
        res.status(400).json({ error: 'La sede es requerida' });
        return;
      }
      storeId = body.storeId as string;
    } else {
      // Admin creating deliveryDriver: store comes only from authenticated admin.
      if (!req.storeId) {
        res.status(403).json({ error: 'Acceso denegado' });
        return;
      }
      storeId = req.storeId;
    }
  }

  const existingEmail = await findUserByEmail(body.email);
  if (existingEmail) {
    res.status(409).json({ error: 'Correo ya registrado' });
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

  if (storeId) {
    try {
      await assertStoreActive(storeId);
    } catch (err) {
      if (err instanceof StoreNotFoundError) {
        res.status(err.statusCode).json({ code: err.code, error: err.message });
        return;
      }
      throw err;
    }
  }

  const plainPassword = generateStrongPassword();
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
      storeId,
      type: body.type,
    });

    try {
      await sendAdminAccountCreatedEmail({
        email: user.email,
        firstName: user.firstName,
        recoverPasswordUrl: `${getWebBaseUrl()}/recuperar-contrasena`,
        roleLabel: USER_TYPE_LABELS[user.type] ?? user.type,
        temporaryPassword: plainPassword,
      });
    } catch (err) {
      console.error('[createAdminUser] failed to send account-created email', {
        email: user.email,
        error: err instanceof Error ? err.message : err,
        userId: user.id,
      });
    }

    res.status(201).json({
      user: serializeUser(user),
    });
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      res.status(409).json({ error: 'El correo, la cédula o el teléfono ya existe' });
      return;
    }
    throw err;
  }
}

function needsStore(type: string): boolean {
  return type === 'admin' || type === 'deliveryDriver';
}
