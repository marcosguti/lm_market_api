import type { UserType } from '@prisma/client';
import { beforeEach, describe, it, vi } from 'vitest';

vi.mock('../../../config/megasoft.js', () => ({
  megasoftCertP2cPayload: {},
  megasoftConfig: { baseUrl: 'http://test', certHardcoded: true, enabled: true },
  resolveMegasoftAmount: vi.fn().mockReturnValue(10),
}));

import './helpers/sharedMocks.js';
import './helpers/queryMocks.js';
import { resetQueryMocks } from './helpers/queryMocks.js';
import './helpers/orderServiceMocks.js';
import { resetOrderServiceMocks } from './helpers/orderServiceMocks.js';
import { createTestApp } from './helpers/createTestApp.js';
import {
  expectAllowed,
  expectForbidden,
  expectUnauthorized,
  NON_CLIENT_ROLES,
} from './helpers/rbacMatrix.js';

const app = createTestApp();
const ORDER_ID = '11111111-1111-1111-1111-111111111111';

describe('RBAC orders routes (client only via asClient)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
    resetQueryMocks();
  });

  describe('GET /api/orders/history', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'get', '/api/orders/history');
    });

    it.each(NON_CLIENT_ROLES)('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'get', '/api/orders/history', role as UserType);
    });

    it('allows client', async () => {
      await expectAllowed(app, 'get', '/api/orders/history', 'client', { expectedStatus: 200 });
    });
  });

  describe('GET /api/orders/:id', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'get', '/api/orders/:id', { pathParams: { id: ORDER_ID } });
    });

    it.each(NON_CLIENT_ROLES)('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'get', '/api/orders/:id', role as UserType, {
        pathParams: { id: ORDER_ID },
      });
    });

    it('allows client', async () => {
      await expectAllowed(app, 'get', '/api/orders/:id', 'client', {
        expectedStatus: 200,
        pathParams: { id: ORDER_ID },
      });
    });
  });

  describe('PATCH /api/orders/:id/lines', () => {
    const body = { lines: [{ code: 'SKU1', quantity: 1 }] };

    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'patch', '/api/orders/:id/lines', {
        body,
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(NON_CLIENT_ROLES)('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'patch', '/api/orders/:id/lines', role as UserType, {
        body,
        pathParams: { id: ORDER_ID },
      });
    });

    it('allows client', async () => {
      await expectAllowed(app, 'patch', '/api/orders/:id/lines', 'client', {
        body,
        expectedStatus: 200,
        pathParams: { id: ORDER_ID },
      });
    });
  });

  describe('POST /api/orders/:id/confirm-payment', () => {
    const body = { method: 'cash' };

    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'post', '/api/orders/:id/confirm-payment', {
        body,
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(NON_CLIENT_ROLES)('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'post', '/api/orders/:id/confirm-payment', role as UserType, {
        body,
        pathParams: { id: ORDER_ID },
      });
    });

    it('allows client', async () => {
      await expectAllowed(app, 'post', '/api/orders/:id/confirm-payment', 'client', {
        body,
        expectedStatus: 200,
        pathParams: { id: ORDER_ID },
      });
    });
  });

  describe('POST /api/orders/:id/verify-mobile-payment', () => {
    const body = {
      amount: 10,
      bankCode: '0102',
      phone: '04141234567',
      reference: '123456',
    };

    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'post', '/api/orders/:id/verify-mobile-payment', {
        body,
        pathParams: { id: ORDER_ID },
      });
    });

    it.each(NON_CLIENT_ROLES)('returns 403 for %s', async (role) => {
      await expectForbidden(
        app,
        'post',
        '/api/orders/:id/verify-mobile-payment',
        role as UserType,
        { body, pathParams: { id: ORDER_ID } },
      );
    });
  });
});
