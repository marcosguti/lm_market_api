import type { Request, Response } from 'express';

import {
  passwordResetTokenErrorMessage,
  validatePasswordResetToken,
} from '../../services/passwordResetTokenService.js';
import { validatePasswordResetTokenSchema } from './schemas.js';

export async function validatePasswordResetTokenHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const validation = validatePasswordResetTokenSchema.validate(req.query);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message, valid: false });
    return;
  }

  const { token } = validation.value;
  const result = await validatePasswordResetToken(token);
  if (!result.valid) {
    res.status(400).json({
      error: passwordResetTokenErrorMessage(result.reason),
      reason: result.reason,
      valid: false,
    });
    return;
  }

  res.json({ valid: true });
}
