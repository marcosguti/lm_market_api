import { createServer } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const emit = vi.hoisted(() => vi.fn());
const to = vi.hoisted(() => vi.fn(() => ({ emit })));

vi.mock('socket.io', () => ({
  Server: vi.fn(() => ({
    on: vi.fn(),
    to,
    use: vi.fn(),
  })),
}));

vi.mock('../../libs/corsOrigins.js', () => ({
  isCorsOriginAllowed: vi.fn(() => true),
}));

vi.mock('../../libs/jwt.js', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('../../queries/user.js', () => ({
  findUserById: vi.fn(),
}));

import {
  createSocketServer,
  emitKitchenNewPaid,
  emitOrderUpdated,
  emitUserNotification,
  KITCHEN_ROOM,
} from '../socket.js';

describe('socket emits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const httpServer = createServer();
    createSocketServer(httpServer);
  });

  it('emitOrderUpdated sends to user room', () => {
    emitOrderUpdated('u1', { id: 'o1', status: 'pending' });
    expect(to).toHaveBeenCalledWith('user:u1');
    expect(emit).toHaveBeenCalledWith('order:updated', { id: 'o1', status: 'pending' });
  });

  it('emitUserNotification sends notification payload', () => {
    emitUserNotification('u1', { title: 'Hi', type: 'ORDER_STATUS_CHANGED' });
    expect(to).toHaveBeenCalledWith('user:u1');
    expect(emit).toHaveBeenCalledWith('notification:new', {
      title: 'Hi',
      type: 'ORDER_STATUS_CHANGED',
    });
  });

  it('emitKitchenNewPaid sends to kitchen room', () => {
    emitKitchenNewPaid({ id: 'o1' });
    expect(to).toHaveBeenCalledWith(KITCHEN_ROOM);
    expect(emit).toHaveBeenCalledWith('order:newPaid', { id: 'o1' });
  });
});

describe('socket emits without server', () => {
  it('throws when socket server is not initialized', async () => {
    vi.resetModules();
    vi.doMock('socket.io', () => ({
      Server: vi.fn(() => ({ on: vi.fn(), to, use: vi.fn() })),
    }));
    vi.doMock('../../libs/corsOrigins.js', () => ({ isCorsOriginAllowed: vi.fn(() => true) }));
    vi.doMock('../../libs/jwt.js', () => ({ verifyToken: vi.fn() }));
    vi.doMock('../../queries/user.js', () => ({ findUserById: vi.fn() }));
    const fresh = await import('../socket.js');
    expect(() => fresh.emitOrderUpdated('u1', {})).toThrow(/not initialized/i);
  });
});
