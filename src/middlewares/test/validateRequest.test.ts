import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { validateBody, validateQuery } from '../validateRequest.js';

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

describe('validateRequest', () => {
  it('validateBody calls next and assigns coerced value on success', () => {
    const req = { body: { name: 'Test' } } as Request;
    const res = mockRes();
    const next = vi.fn();
    const schema = {
      validate: vi.fn().mockReturnValue({ value: { name: 'Test' } }),
    };

    validateBody(req, res, schema, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Test' });
  });

  it('validateBody returns 400 on validation error', () => {
    const req = { body: {} } as Request;
    const res = mockRes();
    const next = vi.fn();
    const schema = {
      validate: vi.fn().mockReturnValue({
        error: { details: [{ context: {}, type: 'any.required' }] },
      }),
    };

    validateBody(req, res, schema, next);

    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('validateQuery calls next and assigns coerced value on success', () => {
    const req = { query: { page: '1' } } as Request;
    const res = mockRes();
    const next = vi.fn();
    const schema = {
      validate: vi.fn().mockReturnValue({ value: { page: 1 } }),
    };

    validateQuery(req, res, schema, next);

    expect(next).toHaveBeenCalled();
    expect(req.query).toEqual({ page: 1 });
  });

  it('validateQuery returns 400 on validation error', () => {
    const req = { query: {} } as Request;
    const res = mockRes();
    const next = vi.fn();
    const schema = {
      validate: vi.fn().mockReturnValue({
        error: { details: [{ context: {}, type: 'number.base' }] },
      }),
    };

    validateQuery(req, res, schema, next);

    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });
});
