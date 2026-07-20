import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../auth.js';
import {
  assertAdminCanAccessOrder,
  assertAdminCanManageUser,
  requireAdminHasStore,
  StoreScopeError,
} from '../storeScope.js';

function expectForbidden(fn: () => void): void {
  expect(fn).toThrow(StoreScopeError);
  try {
    fn();
  } catch (err) {
    expect(err).toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  }
}

describe('assertAdminCanAccessOrder', () => {
  it('allows superAdmin for any order store', () => {
    expect(() =>
      assertAdminCanAccessOrder('superAdmin', null, { storeId: 'store-2' }),
    ).not.toThrow();
  });

  it('allows admin when order store matches actor store', () => {
    expect(() =>
      assertAdminCanAccessOrder('admin', 'store-1', { storeId: 'store-1' }),
    ).not.toThrow();
  });

  it('rejects admin when order belongs to another store', () => {
    expectForbidden(() => assertAdminCanAccessOrder('admin', 'store-1', { storeId: 'store-2' }));
  });

  it('rejects admin with no store assigned', () => {
    expectForbidden(() => assertAdminCanAccessOrder('admin', null, { storeId: 'store-1' }));
    expectForbidden(() => assertAdminCanAccessOrder('admin', undefined, { storeId: 'store-1' }));
  });

  it('rejects admin when order has no store', () => {
    expectForbidden(() => assertAdminCanAccessOrder('admin', 'store-1', { storeId: null }));
  });

  it('rejects non-admin roles', () => {
    expectForbidden(() =>
      assertAdminCanAccessOrder('deliveryDriver', 'store-1', { storeId: 'store-1' }),
    );
    expectForbidden(() => assertAdminCanAccessOrder('client', null, { storeId: 'store-1' }));
    expectForbidden(() => assertAdminCanAccessOrder(undefined, 'store-1', { storeId: 'store-1' }));
  });
});

describe('assertAdminCanManageUser', () => {
  it('allows superAdmin for any target', () => {
    expect(() =>
      assertAdminCanManageUser('superAdmin', null, {
        storeId: 'store-2',
        type: 'deliveryDriver',
      }),
    ).not.toThrow();
    expect(() =>
      assertAdminCanManageUser('superAdmin', null, { storeId: 'store-1', type: 'admin' }),
    ).not.toThrow();
  });

  it('allows admin to edit clients regardless of store', () => {
    expect(() =>
      assertAdminCanManageUser('admin', 'store-1', { storeId: null, type: 'client' }),
    ).not.toThrow();
    expect(() =>
      assertAdminCanManageUser('admin', 'store-1', { storeId: 'store-2', type: 'client' }),
    ).not.toThrow();
  });

  it('allows admin to edit deliveryDriver of their own store', () => {
    expect(() =>
      assertAdminCanManageUser('admin', 'store-1', {
        storeId: 'store-1',
        type: 'deliveryDriver',
      }),
    ).not.toThrow();
  });

  it('rejects admin editing deliveryDriver of another store', () => {
    expectForbidden(() =>
      assertAdminCanManageUser('admin', 'store-1', {
        storeId: 'store-2',
        type: 'deliveryDriver',
      }),
    );
  });

  it('rejects admin editing deliveryDriver when actor has no store', () => {
    expectForbidden(() =>
      assertAdminCanManageUser('admin', null, {
        storeId: 'store-1',
        type: 'deliveryDriver',
      }),
    );
  });

  it('rejects admin editing deliveryDriver with null storeId', () => {
    expectForbidden(() =>
      assertAdminCanManageUser('admin', 'store-1', {
        storeId: null,
        type: 'deliveryDriver',
      }),
    );
  });

  it('rejects admin editing other admins or superAdmins', () => {
    expectForbidden(() =>
      assertAdminCanManageUser('admin', 'store-1', { storeId: 'store-1', type: 'admin' }),
    );
    expectForbidden(() =>
      assertAdminCanManageUser('admin', 'store-1', { storeId: null, type: 'superAdmin' }),
    );
  });

  it('rejects non-admin actors', () => {
    expectForbidden(() =>
      assertAdminCanManageUser('client', null, { storeId: null, type: 'client' }),
    );
    expectForbidden(() =>
      assertAdminCanManageUser('deliveryDriver', 'store-1', {
        storeId: 'store-1',
        type: 'deliveryDriver',
      }),
    );
  });
});

describe('requireAdminHasStore', () => {
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

  it('blocks admin without storeId', () => {
    const req = { userType: 'admin', storeId: null } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();
    requireAdminHasStore(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Acceso denegado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows admin with storeId', () => {
    const req = { userType: 'admin', storeId: 'store-1' } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();
    requireAdminHasStore(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('allows superAdmin without storeId', () => {
    const req = { userType: 'superAdmin', storeId: null } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();
    requireAdminHasStore(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
