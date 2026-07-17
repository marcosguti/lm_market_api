import type { UserType } from '@prisma/client';
import { beforeEach, describe, it, vi } from 'vitest';

import './helpers/sharedMocks.js';
import './helpers/queryMocks.js';
import { resetQueryMocks } from './helpers/queryMocks.js';
import './helpers/orderServiceMocks.js';
import { resetOrderServiceMocks } from './helpers/orderServiceMocks.js';
import { createTestApp } from './helpers/createTestApp.js';
import {
  ADMIN_ROLES,
  ALL_ROLES,
  expectAllowed,
  expectForbidden,
  expectUnauthorized,
} from './helpers/rbacMatrix.js';

const app = createTestApp();

describe('RBAC admin CRUD routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrderServiceMocks();
    resetQueryMocks();
  });

  describe.each([
    '/api/admin/products',
    '/api/admin/banners',
    '/api/admin/blog-articles',
    '/api/admin/deals',
  ])('GET %s (admin/superAdmin)', (path) => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'get', path);
    });

    it.each(ALL_ROLES.filter((r) => r !== 'admin' && r !== 'superAdmin'))(
      'returns 403 for %s',
      async (role) => {
        await expectForbidden(app, 'get', path, role as UserType);
      },
    );

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'get', path, role, { expectedStatus: 200 });
    });
  });

  describe.each([
    { path: '/api/admin/products', body: { code: 'X', name: 'P', price: 1, storeId: 's1' } },
    { path: '/api/admin/banners', body: { title: 'B', active: true } },
    {
      path: '/api/admin/blog-articles',
      body: { title: 'Post', content: '<p>Hola</p>', active: true },
    },
    { path: '/api/admin/deals', body: { title: 'D', active: true } },
  ])('POST $path (admin/superAdmin)', ({ path, body }) => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'post', path, { body });
    });

    it.each(ALL_ROLES.filter((r) => r !== 'admin' && r !== 'superAdmin'))(
      'returns 403 for %s',
      async (role) => {
        await expectForbidden(app, 'post', path, role as UserType, { body });
      },
    );

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'post', path, role, { body });
    });
  });

  describe.each([
    { path: '/api/admin/products', body: { name: 'Updated' } },
    { path: '/api/admin/banners', body: { title: 'Updated' } },
    { path: '/api/admin/blog-articles', body: { title: 'Updated' } },
    { path: '/api/admin/deals', body: { title: 'Updated' } },
  ])('PATCH $path/:id (admin/superAdmin)', ({ path, body }) => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'patch', path, {
        body,
        pathParams: { id: 'item-1' },
      });
    });

    it.each(ALL_ROLES.filter((r) => r !== 'admin' && r !== 'superAdmin'))(
      'returns 403 for %s',
      async (role) => {
        await expectForbidden(app, 'patch', path, role as UserType, {
          body,
          pathParams: { id: 'item-1' },
        });
      },
    );

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'patch', path, role, {
        body,
        pathParams: { id: 'item-1' },
      });
    });
  });

  describe.each([
    '/api/admin/products',
    '/api/admin/banners',
    '/api/admin/blog-articles',
    '/api/admin/deals',
  ])('DELETE %s/:id (admin/superAdmin)', (path) => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'delete', path, { pathParams: { id: 'item-1' } });
    });

    it.each(ALL_ROLES.filter((r) => r !== 'admin' && r !== 'superAdmin'))(
      'returns 403 for %s',
      async (role) => {
        await expectForbidden(app, 'delete', path, role as UserType, {
          pathParams: { id: 'item-1' },
        });
      },
    );

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'delete', path, role, {
        pathParams: { id: 'item-1' },
      });
    });
  });

  describe('POST /api/admin/users (admin/superAdmin)', () => {
    const body = {
      email: 'new@test.com',
      firstName: 'New',
      lastName: 'User',
      numberId: '123',
      numberIdType: 'V',
      type: 'client',
    };

    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'post', '/api/admin/users', { body });
    });

    it.each(ALL_ROLES.filter((r) => r !== 'admin' && r !== 'superAdmin'))(
      'returns 403 for %s',
      async (role) => {
        await expectForbidden(app, 'post', '/api/admin/users', role as UserType, { body });
      },
    );

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'post', '/api/admin/users', role, { body });
    });
  });

  describe('PATCH /api/admin/users/:id (admin/superAdmin)', () => {
    const body = { firstName: 'Updated' };

    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'patch', '/api/admin/users', {
        body,
        pathParams: { id: 'item-1' },
      });
    });

    it.each(ALL_ROLES.filter((r) => r !== 'admin' && r !== 'superAdmin'))(
      'returns 403 for %s',
      async (role) => {
        await expectForbidden(app, 'patch', '/api/admin/users', role as UserType, {
          body,
          pathParams: { id: 'item-1' },
        });
      },
    );

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'patch', '/api/admin/users', role, {
        body,
        pathParams: { id: 'item-1' },
      });
    });
  });

  describe('DELETE /api/admin/users/:id (admin/superAdmin)', () => {
    it('returns 401 without token', async () => {
      await expectUnauthorized(app, 'delete', '/api/admin/users', {
        pathParams: { id: 'item-1' },
      });
    });

    it.each(ALL_ROLES.filter((r) => r !== 'admin' && r !== 'superAdmin'))(
      'returns 403 for %s',
      async (role) => {
        await expectForbidden(app, 'delete', '/api/admin/users', role as UserType, {
          pathParams: { id: 'item-1' },
        });
      },
    );

    it.each(ADMIN_ROLES)('allows %s', async (role) => {
      await expectAllowed(app, 'delete', '/api/admin/users', role, {
        pathParams: { id: 'item-1' },
      });
    });
  });
});
