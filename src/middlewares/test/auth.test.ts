import type { NextFunction, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../auth.js';
import { requireAuth, requireRole } from '../auth.js';

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

describe('requireAuth', () => {
  it('returns 401 when userId is missing', () => {
    const req = {} as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    requireAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'No autorizado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when userId is present', () => {
    const req = { userId: 'u1' } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('requireRole', () => {
  const middleware = requireRole(['admin', 'superAdmin']);

  it('returns 401 when user is not authenticated', () => {
    const req = {} as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    middleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not allowed', () => {
    const req = { userId: 'u1', userType: 'client' } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    middleware(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Acceso denegado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when role is allowed', () => {
    const req = { userId: 'u1', userType: 'admin' } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
