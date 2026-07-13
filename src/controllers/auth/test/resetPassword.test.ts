import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const validatePasswordResetToken = vi.fn();
const updateUserPassword = vi.fn();
const deletePasswordResetToken = vi.fn();
const revokeAllLinkedDevicesForUser = vi.fn();

vi.mock('../../../queries/linkedDevice.js', () => ({
  revokeAllLinkedDevicesForUser: (...args: unknown[]) => revokeAllLinkedDevicesForUser(...args),
}));

vi.mock('../../../queries/passwordResetToken.js', () => ({
  deletePasswordResetToken: (...args: unknown[]) => deletePasswordResetToken(...args),
}));

vi.mock('../../../queries/user.js', () => ({
  updateUserPassword: (...args: unknown[]) => updateUserPassword(...args),
}));

vi.mock('../../../services/passwordResetTokenService.js', () => ({
  passwordResetTokenErrorMessage: (reason: string) => `Token ${reason}`,
  validatePasswordResetToken: (...args: unknown[]) => validatePasswordResetToken(...args),
}));

vi.mock('../../../libs/passwordHashing.js', () => ({
  createHash: vi.fn().mockResolvedValue('hashed-password'),
}));

import { resetPassword } from '../resetPassword.js';

function mockRes(): Response & { statusCode: number; body?: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body?: unknown };
}

describe('resetPassword controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid body', async () => {
    const req = { body: { token: 'x' } } as never;
    const res = mockRes();
    await resetPassword(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid token', async () => {
    validatePasswordResetToken.mockResolvedValue({ valid: false, reason: 'expired' });
    const req = {
      body: { token: 'bad', newPassword: 'Secret123!' },
    } as never;
    const res = mockRes();
    await resetPassword(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Token expired' });
  });

  it('resets password and revokes devices on success', async () => {
    validatePasswordResetToken.mockResolvedValue({ valid: true, userId: 'u1' });
    const req = {
      body: { token: 'good', newPassword: 'Secret123!' },
    } as never;
    const res = mockRes();
    await resetPassword(req, res);
    expect(res.statusCode).toBe(200);
    expect(updateUserPassword).toHaveBeenCalledWith('u1', 'hashed-password');
    expect(deletePasswordResetToken).toHaveBeenCalledWith('good');
    expect(revokeAllLinkedDevicesForUser).toHaveBeenCalledWith('u1');
  });
});
