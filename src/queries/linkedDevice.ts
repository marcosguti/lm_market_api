import type { LinkedDevice } from '@prisma/client';

import prisma from '../prisma.js';

export async function findLinkedDeviceByUserIdAndDeviceId(
  userId: string,
  deviceId: string,
): Promise<LinkedDevice | null> {
  return prisma.linkedDevice.findUnique({
    where: {
      userId_deviceId: { deviceId, userId },
    },
  });
}

export async function upsertLinkedDevice(data: {
  deviceId: string;
  refreshTokenHash: string;
  userId: string;
}): Promise<LinkedDevice> {
  return prisma.linkedDevice.upsert({
    create: {
      createdAt: new Date(),
      deviceId: data.deviceId,
      refreshTokenHash: data.refreshTokenHash,
      userId: data.userId,
    },
    update: { refreshTokenHash: data.refreshTokenHash },
    where: {
      userId_deviceId: { deviceId: data.deviceId, userId: data.userId },
    },
  });
}
