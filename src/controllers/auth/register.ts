import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { createHash } from '../../libs/passwordHashing.js';
import {
  createUser,
  findUserByEmail,
  findUserByNumberId,
  findUserByPhone,
} from '../../queries/user.js';
import {
  createAndSendVerificationCode,
  EmailVerificationError,
} from '../../services/emailVerification/index.js';
import { registerSchema } from './schemas.js';

export async function register(req: AuthRequest, res: Response): Promise<void> {
  const validation = registerSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }
  const body = validation.value;

  const [existingEmail, existingNumberId, existingPhone] = await Promise.all([
    findUserByEmail(body.email),
    findUserByNumberId(body.numberId),
    body.phone ? findUserByPhone(body.phone) : Promise.resolve(null),
  ]);
  if (existingEmail) {
    res.status(409).json({ error: 'Correo ya registrado' });
    return;
  }
  if (existingNumberId) {
    res.status(409).json({ error: 'Cédula ya registrada' });
    return;
  }
  if (existingPhone) {
    res.status(409).json({ error: 'Teléfono ya registrado' });
    return;
  }

  const hashedPassword = await createHash(body.password);
  const user = await createUser({
    address: body.address || undefined,
    email: body.email,
    emailVerified: false,
    firstName: body.firstName,
    lastName: body.lastName,
    numberId: body.numberId,
    numberIdType: body.numberIdType,
    password: hashedPassword,
    phone: body.phone || undefined,
    type: body.type,
  });

  try {
    const sendResult = await createAndSendVerificationCode(user);
    res.status(201).json({
      codeExpiresInSeconds: sendResult.codeExpiresInSeconds,
      codeSent: true,
      email: user.email,
      message: 'Cuenta creada. Revisa tu correo.',
      requiresVerification: true,
    });
  } catch (err) {
    if (err instanceof EmailVerificationError) {
      res.status(err.statusCode).json({
        code: err.code,
        codeExpiresInSeconds: err.codeExpiresInSeconds,
        error: err.message,
      });
      return;
    }
    res.status(503).json({
      error: 'No se pudo enviar el correo. Intenta de nuevo en unos momentos.',
    });
  }
}
