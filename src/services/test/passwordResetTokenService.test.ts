import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  passwordResetTokenErrorMessage,
  validatePasswordResetToken,
} from '../passwordResetTokenService.js';

const findPasswordResetTokenByToken = vi.fn();
const deletePasswordResetToken = vi.fn();

vi.mock('../../queries/passwordResetToken.js', () => ({
  deletePasswordResetToken: (...args: unknown[]) => deletePasswordResetToken(...args),
  findPasswordResetTokenByToken: (...args: unknown[]) => findPasswordResetTokenByToken(...args),
}));

describe('passwordResetTokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('passwordResetTokenErrorMessage', () => {
    it('returns expired message', () => {
      expect(passwordResetTokenErrorMessage('expired')).toMatch(/expirado/i);
    });

    it('returns not found message', () => {
      expect(passwordResetTokenErrorMessage('not_found')).toMatch(/inválido/i);
    });
  });

  describe('validatePasswordResetToken', () => {
    it('returns not_found when token does not exist', async () => {
      findPasswordResetTokenByToken.mockResolvedValue(null);
      const result = await validatePasswordResetToken('missing');
      expect(result).toEqual({ reason: 'not_found', valid: false });
    });

    it('returns expired and deletes token when past expiresAt', async () => {
      findPasswordResetTokenByToken.mockResolvedValue({
        expiresAt: new Date(Date.now() - 1000),
        token: 'old',
        userId: 'u1',
      });
      const result = await validatePasswordResetToken('old');
      expect(result).toEqual({ reason: 'expired', valid: false });
      expect(deletePasswordResetToken).toHaveBeenCalledWith('old');
    });

    it('returns valid with userId when token is active', async () => {
      findPasswordResetTokenByToken.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        token: 'valid',
        userId: 'u1',
      });
      const result = await validatePasswordResetToken('valid');
      expect(result).toEqual({ userId: 'u1', valid: true });
    });
  });
});
