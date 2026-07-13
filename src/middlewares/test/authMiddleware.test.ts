import type { NextFunction, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../auth.js';
import { authMiddleware } from '../auth.js';

const verifyToken = vi.fn();
const findUserById = vi.fn();

vi.mock('../../libs/jwt.js', () => ({
  verifyToken: (...args: unknown[]) => verifyToken(...args),
}));

vi.mock('../../queries/user.js', () => ({
  findUserById: (...args: unknown[]) => findUserById(...args),
}));

function mockNext(): NextFunction {
  return vi.fn() as NextFunction;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through without Authorization header', async () => {
    const req = { headers: {} } as AuthRequest;
    const next = mockNext();
    await authMiddleware(req, {} as Response, next);
    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes through when Authorization is not Bearer', async () => {
    const req = { headers: { authorization: 'Basic abc' } } as AuthRequest;
    const next = mockNext();
    await authMiddleware(req, {} as Response, next);
    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets userId and userType when token and user are valid', async () => {
    verifyToken.mockReturnValue({ userId: 'u1' });
    findUserById.mockResolvedValue({ id: 'u1', type: 'client' });
    const req = { headers: { authorization: 'Bearer valid-token' } } as AuthRequest;
    const next = mockNext();
    await authMiddleware(req, {} as Response, next);
    expect(req.userId).toBe('u1');
    expect(req.userType).toBe('client');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes through without user when token is invalid', async () => {
    verifyToken.mockImplementation(() => {
      throw new Error('invalid');
    });
    const req = { headers: { authorization: 'Bearer bad-token' } } as AuthRequest;
    const next = mockNext();
    await authMiddleware(req, {} as Response, next);
    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes through when user is not found', async () => {
    verifyToken.mockReturnValue({ userId: 'missing' });
    findUserById.mockResolvedValue(null);
    const req = { headers: { authorization: 'Bearer valid-token' } } as AuthRequest;
    const next = mockNext();
    await authMiddleware(req, {} as Response, next);
    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
