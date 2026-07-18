import type { UserType } from '@prisma/client';
import { beforeEach, describe, it, vi } from 'vitest';

import './helpers/sharedMocks.js';
import './helpers/queryMocks.js';
import { resetQueryMocks } from './helpers/queryMocks.js';
import './helpers/orderServiceMocks.js';
import { resetOrderServiceMocks } from './helpers/orderServiceMocks.js';
import { createTestApp } from './helpers/createTestApp.js';
import {
  ALL_ROLES,
  expectAllowed,
  expectForbidden,
  expectUnauthorized,
} from './helpers/rbacMatrix.js';

const app = createTestApp();

describe('RBAC admin payment methods (superAdmin only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
    resetQueryMocks();
  });

  describe('GET /api/admin/payment-methods', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'get', '/api/admin/payment-methods');
    });

    it.each(ALL_ROLES.filter((r) => r !== 'superAdmin'))('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'get', '/api/admin/payment-methods', role as UserType);
    });

    it('allows superAdmin', async () => {
      await expectAllowed(app, 'get', '/api/admin/payment-methods', 'superAdmin', {
        expectedStatus: 200,
      });
    });
  });

  describe('PATCH /api/admin/payment-methods/:method', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'patch', '/api/admin/payment-methods/cash', {
        body: { active: false },
      });
    });

    it.each(ALL_ROLES.filter((r) => r !== 'superAdmin'))('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'patch', '/api/admin/payment-methods/cash', role as UserType, {
        body: { active: false },
      });
    });

    it('allows superAdmin', async () => {
      await expectAllowed(app, 'patch', '/api/admin/payment-methods/cash', 'superAdmin', {
        body: { active: true },
        expectedStatus: 200,
      });
    });
  });
});
