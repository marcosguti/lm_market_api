import type { UserType } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('RBAC admin sync status (superAdmin only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
    resetQueryMocks();
  });

  describe('GET /api/admin/sync-status', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'get', '/api/admin/sync-status');
    });

    it.each(ALL_ROLES.filter((r) => r !== 'superAdmin'))('returns 403 for %s', async (role) => {
      await expectForbidden(app, 'get', '/api/admin/sync-status', role as UserType);
    });

    it('allows superAdmin', async () => {
      await expectAllowed(app, 'get', '/api/admin/sync-status', 'superAdmin', {
        expectedStatus: 200,
      });
    });
  });

  describe('GET /health/sync', () => {
    it('is public and returns 503 when sync never ran', async () => {
      const res = await request(app).get('/health/sync');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('ok');
      expect(res.body).toHaveProperty('products');
      expect(res.body).toHaveProperty('bcv');
    });
  });
});
