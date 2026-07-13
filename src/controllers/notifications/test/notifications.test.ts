import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';

const listNotificationsForUser = vi.fn();
const listNotificationsForInbox = vi.fn();
const markNotificationAsRead = vi.fn();

vi.mock('../../../services/orderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/orderService.js')>();
  return {
    ...actual,
    listNotificationsForInbox: (...args: unknown[]) => listNotificationsForInbox(...args),
    listNotificationsForUser: (...args: unknown[]) => listNotificationsForUser(...args),
    markNotificationAsRead: (...args: unknown[]) => markNotificationAsRead(...args),
  };
});

import { getNotifications } from '../getNotifications.js';
import { markNotificationRead } from '../markNotificationRead.js';
import { OrderDomainError } from '../../../services/orderService.js';

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

describe('notifications controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('returns 401 without userId', async () => {
      const req = { query: {} } as AuthRequest;
      const res = mockRes();
      await getNotifications(req, res);
      expect(res.statusCode).toBe(401);
    });

    it('returns paginated notifications', async () => {
      listNotificationsForUser.mockResolvedValue({
        data: [{ id: 'n1' }],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });
      const req = { userId: 'u1', query: { page: '1', pageSize: '20' } } as unknown as AuthRequest;
      const res = mockRes();
      await getNotifications(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ total: 1 });
      expect(listNotificationsForUser).toHaveBeenCalledWith('u1', 1, 20);
    });

    it('returns inbox notifications when inbox=true', async () => {
      listNotificationsForInbox.mockResolvedValue({
        data: [{ id: 'n1' }, { id: 'n2' }],
        unreadCount: 1,
        total: 10,
      });
      const req = {
        userId: 'u1',
        query: { inbox: 'true', recentRead: '5' },
      } as unknown as AuthRequest;
      const res = mockRes();
      await getNotifications(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ unreadCount: 1, total: 10 });
      expect(listNotificationsForInbox).toHaveBeenCalledWith('u1', 5);
      expect(listNotificationsForUser).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid pagination', async () => {
      const req = { userId: 'u1', query: { page: '0' } } as unknown as AuthRequest;
      const res = mockRes();
      await getNotifications(req, res);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('markNotificationRead', () => {
    it('marks notification as read', async () => {
      markNotificationAsRead.mockResolvedValue(undefined);
      const req = { userId: 'u1', params: { id: 'n1' } } as unknown as AuthRequest;
      const res = mockRes();
      await markNotificationRead(req, res);
      expect(res.statusCode).toBe(200);
      expect(markNotificationAsRead).toHaveBeenCalledWith('u1', 'n1');
    });

    it('returns 404 when notification missing', async () => {
      markNotificationAsRead.mockRejectedValue(
        new OrderDomainError('NOTIFICATION_NOT_FOUND', 'Not found', 404),
      );
      const req = { userId: 'u1', params: { id: 'missing' } } as unknown as AuthRequest;
      const res = mockRes();
      await markNotificationRead(req, res);
      expect(res.statusCode).toBe(404);
    });
  });
});
