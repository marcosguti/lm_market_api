import {
  deletePasswordResetToken,
  findPasswordResetTokenByToken,
} from '../queries/passwordResetToken.js';

export type PasswordResetTokenInvalidReason = 'expired' | 'not_found';

export type PasswordResetTokenValidation =
  | { reason: PasswordResetTokenInvalidReason; valid: false }
  | { userId: string; valid: true };

export function passwordResetTokenErrorMessage(reason: PasswordResetTokenInvalidReason): string {
  if (reason === 'expired') {
    return 'El enlace ha expirado. Solicita uno nuevo.';
  }
  return 'Token inválido o expirado';
}

export async function validatePasswordResetToken(
  token: string,
): Promise<PasswordResetTokenValidation> {
  const resetRecord = await findPasswordResetTokenByToken(token);
  if (!resetRecord) {
    return { reason: 'not_found', valid: false };
  }
  if (new Date() > resetRecord.expiresAt) {
    await deletePasswordResetToken(token);
    return { reason: 'expired', valid: false };
  }
  return { userId: resetRecord.userId, valid: true };
}
