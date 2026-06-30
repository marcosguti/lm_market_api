import type { LinkedDevice } from '@prisma/client';

import { createHash } from '../libs/passwordHashing.js';
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

export async function revokeLinkedDevice(userId: string, deviceId: string): Promise<void> {
  await prisma.linkedDevice
    .update({
      data: { refreshTokenHash: `revoked:${Date.now()}` },
      where: { userId_deviceId: { deviceId, userId } },
    })
    .catch(() => {
      // device may not exist; ignore
    });
}

export async function updateLinkedDeviceRefreshTokenHash(
  userId: string,
  deviceId: string,
  newRefreshToken: string,
): Promise<void> {
  const hash = await createHash(newRefreshToken);
  await prisma.linkedDevice.update({
    data: { refreshTokenHash: hash },
    where: { userId_deviceId: { deviceId, userId } },
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
