import type { Request, Response } from 'express';

import { EmailVerificationError, verifyLoginCode } from '../../services/emailVerification/index.js';
import { issueAuthSession } from './issueAuthSession.js';
import { verifyLoginCodeSchema } from './schemas.js';

export async function verifyLoginCodeHandler(req: Request, res: Response): Promise<void> {
  const validation = verifyLoginCodeSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { code, deviceId, email } = validation.value;

  try {
    const user = await verifyLoginCode(email, code);
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
