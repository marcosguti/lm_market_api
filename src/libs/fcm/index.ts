import admin from 'firebase-admin';

import prisma from '../../prisma.js';

export type PushPayload = {
  body: string;
  data?: Record<string, string>;
  title: string;
};

let initAttempted = false;
let messaging: admin.messaging.Messaging | null = null;

/** Test helper — reset lazy init state between unit tests. */
export function resetFcmForTests(): void {
  initAttempted = false;
  messaging = null;
  for (const app of admin.apps) {
    void app?.delete();
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const msg = ensureMessaging();
  if (!msg) return;

  const devices = await prisma.pushDevice.findMany({
    select: { id: true, token: true },
    where: { userId },
  });
  if (devices.length === 0) return;

  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.data ?? {})) {
    data[key] = String(value);
  }
  data.title = payload.title;
  data.body = payload.body;

  const tokens = devices.map((d) => d.token);
  try {
    const response = await msg.sendEachForMulticast({
      android: {
        notification: {
          channelId: 'lm_market_orders',
        },
        priority: 'high',
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
      data,
      notification: {
        body: payload.body,
        title: payload.title,
      },
      tokens,
    });

    const staleTokenIds: string[] = [];
    response.responses.forEach((result, index) => {
      if (result.success) return;
      const code = result.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        staleTokenIds.push(devices[index]!.id);
      } else {
        console.error('[fcm] send failed', { code, tokenIndex: index, userId });
      }
    });

    if (staleTokenIds.length > 0) {
      await prisma.pushDevice.deleteMany({ where: { id: { in: staleTokenIds } } });
    }
  } catch (err) {
    console.error('[fcm] sendPushToUser failed', { err, userId });
  }
}

function ensureMessaging(): admin.messaging.Messaging | null {
  if (initAttempted) return messaging;
  initAttempted = true;

  try {
    if (!admin.apps.length) {
      const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
      if (inlineJson) {
        const serviceAccount = JSON.parse(inlineJson) as admin.ServiceAccount;
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      } else {
        console.error(
          '[fcm] FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS not set; push disabled',
        );
        return null;
      }
    }
    messaging = admin.messaging();
  } catch (err) {
    console.error('[fcm] failed to initialize Firebase Admin', err);
    messaging = null;
  }

  return messaging;
}
