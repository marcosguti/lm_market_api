import { beforeEach, describe, expect, it, vi } from 'vitest';

const findMany = vi.fn();
const deleteMany = vi.fn();
const sendEachForMulticast = vi.fn();
const cert = vi.fn(() => ({ kind: 'cert' }));
const applicationDefault = vi.fn(() => ({ kind: 'adc' }));
const initializeApp = vi.fn();
const apps: unknown[] = [];

vi.mock('../../../prisma.js', () => ({
  default: {
    pushDevice: {
      deleteMany: (...args: unknown[]) => deleteMany(...args),
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

vi.mock('firebase-admin', () => ({
  default: {
    apps,
    credential: {
      applicationDefault: (...args: unknown[]) => applicationDefault(...args),
      cert: (...args: unknown[]) => cert(...args),
    },
    initializeApp: (...args: unknown[]) => initializeApp(...args),
    messaging: () => ({
      sendEachForMulticast: (...args: unknown[]) => sendEachForMulticast(...args),
    }),
  },
}));

describe('sendPushToUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    apps.length = 0;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });

  it('no-ops when Firebase is not configured', async () => {
    const { sendPushToUser } = await import('../index.js');
    await sendPushToUser('u1', { body: 'b', title: 't' });
    expect(findMany).not.toHaveBeenCalled();
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('sends multicast and deletes stale tokens', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: 'x@y.z',
      private_key: 'key',
      project_id: 'p',
    });
    findMany.mockResolvedValue([
      { id: 'd1', token: 'tok-good' },
      { id: 'd2', token: 'tok-bad' },
    ]);
    sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: true },
        {
          error: { code: 'messaging/registration-token-not-registered' },
          success: false,
        },
      ],
    });

    const { resetFcmForTests, sendPushToUser } = await import('../index.js');
    resetFcmForTests();
    await sendPushToUser('u1', {
      body: 'Tu orden cambió',
      data: { orderId: 'o1', route: '/mis-compras', type: 'ORDER_STATUS_CHANGED' },
      title: 'Actualización de orden',
    });

    expect(initializeApp).toHaveBeenCalled();
    expect(sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['tok-good', 'tok-bad'],
        notification: { body: 'Tu orden cambió', title: 'Actualización de orden' },
      }),
    );
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['d2'] } } });
  });
});
