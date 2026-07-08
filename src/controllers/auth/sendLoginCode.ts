import type { Request, Response } from 'express';

import { findUserByEmail } from '../../queries/user.js';
import {
  createAndSendLoginCode,
  EmailVerificationError,
} from '../../services/emailVerification/index.js';
import { sendLoginCodeSchema } from './schemas.js';

export async function sendLoginCode(req: Request, res: Response): Promise<void> {
  const validation = sendLoginCodeSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { email } = validation.value;

  const user = await findUserByEmail(email);
  if (!user) {
    res.status(404).json({
      code: 'EMAIL_NOT_REGISTERED',
      error: 'Este correo no está registrado',
    });
    return;
  }

  if (!user.emailVerified) {
    res.status(403).json({
      code: 'EMAIL_NOT_VERIFIED',
      error: 'Debes verificar tu correo antes de iniciar sesión',
    });
    return;
  }

  try {
    const sendResult = await createAndSendLoginCode(user);
    res.json({
      codeExpiresInSeconds: sendResult.codeExpiresInSeconds,
      message: 'Código enviado a tu correo',
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
    console.error('[login-code/send] mailjet send failed', err);
    res.status(503).json({
      error: 'No se pudo enviar el correo. Intenta de nuevo en unos momentos.',
    });
  }
}
