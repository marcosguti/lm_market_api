import type { Request, Response } from 'express';

import { comparePassword } from '../../libs/passwordHashing.js';
import { findUserByEmail } from '../../queries/user.js';
import { getActiveCodeRemainingSeconds } from '../../services/emailVerification/index.js';
import { issueAuthSession } from './issueAuthSession.js';
import { loginSchema } from './schemas.js';

export async function login(req: Request, res: Response): Promise<void> {
  const validation = loginSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }
  const { deviceId, email, password } = validation.value;

  const user = await findUserByEmail(email);
  if (!user || !(await comparePassword(password, user.password))) {
    res.status(401).json({ error: 'Email o contraseña inválidos' });
    return;
  }

  if (!user.emailVerified) {
    const codeExpiresInSeconds = await getActiveCodeRemainingSeconds(user.id, 'email_verification');
    res.status(403).json({
      code: 'EMAIL_NOT_VERIFIED',
      codeExpiresInSeconds,
      email: user.email,
      error: 'Debes verificar tu correo antes de iniciar sesión',
    });
    return;
  }

  const session = await issueAuthSession(user, deviceId);
  res.json(session);
}
