import prisma from '../prisma.js';

export type PushPlatform = 'android' | 'ios';

export async function deletePushDevice(params: { token: string; userId: string }): Promise<void> {
  await prisma.pushDevice.deleteMany({
    where: {
      token: params.token,
      userId: params.userId,
    },
  });
}

export async function upsertPushDevice(params: {
  platform: PushPlatform;
  token: string;
  userId: string;
}): Promise<void> {
  const { platform, token, userId } = params;
  await prisma.pushDevice.upsert({
    create: {
      platform,
      token,
      userId,
    },
    update: {
      platform,
      userId,
    },
    where: { token },
  });
}
