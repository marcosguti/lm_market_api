import type { Request, Response } from 'express';

import { EmailVerificationError, verifyEmailCode } from '../../services/emailVerification/index.js';
import { issueAuthSession } from './issueAuthSession.js';
import { verifyEmailSchema } from './schemas.js';

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const validation = verifyEmailSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { code, deviceId, email } = validation.value;

  try {
    const user = await verifyEmailCode(email, code);
    const session = await issueAuthSession(user, deviceId);
    res.json(session);
  } catch (err) {
    if (err instanceof EmailVerificationError) {
      res.status(err.statusCode).json({ code: err.code, error: err.message });
      return;
    }
    throw err;
  }
}
