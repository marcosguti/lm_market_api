import type { Response } from 'express';
import { describe, expect, it } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';
import { asClient } from '../asClient.js';

function mockRes(): Response {
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
  return res as unknown as Response;
}

describe('asClient', () => {
  it('returns userId for client users', () => {
    const req = { userId: 'u1', userType: 'client' } as AuthRequest;
    const res = mockRes();
    expect(asClient(req, res)).toBe('u1');
  });

  it('returns 403 for admin users', () => {
    const req = { userId: 'u1', userType: 'admin' } as AuthRequest;
    const res = mockRes();
    expect(asClient(req, res)).toBeNull();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'Solo los usuarios cliente pueden usar los endpoints de carrito/pedidos',
    });
  });

  it('returns 403 for deliveryDriver users', () => {
    const req = { userId: 'u1', userType: 'deliveryDriver' } as AuthRequest;
    const res = mockRes();
    expect(asClient(req, res)).toBeNull();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'Solo los usuarios cliente pueden usar los endpoints de carrito/pedidos',
    });
  });

  it('returns 403 when userId is missing', () => {
    const req = { userType: 'client' } as AuthRequest;
    const res = mockRes();
    expect(asClient(req, res)).toBeNull();
    expect(res.statusCode).toBe(403);
  });
});
