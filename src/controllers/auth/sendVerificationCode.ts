import type { Response } from 'express';
import type { Request } from 'express';

import { findUserByEmail } from '../../queries/user.js';
import {
  createAndSendVerificationCode,
  EmailVerificationError,
} from '../../services/emailVerification/index.js';
import { sendVerificationCodeSchema } from './schemas.js';

export async function sendVerificationCode(req: Request, res: Response): Promise<void> {
  const validation = sendVerificationCodeSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { email } = validation.value;

  const user = await findUserByEmail(email);
  if (!user || user.emailVerified) {
    res.json({
      message: 'Si el correo está registrado y pendiente de verificación, recibirás un código.',
    });
    return;
  }

  try {
    const sendResult = await createAndSendVerificationCode(user);
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
    console.error('[verify-email/send] mailjet send failed', err);
    res.status(503).json({
      error: 'No se pudo enviar el correo. Intenta de nuevo en unos momentos.',
    });
  }
}
