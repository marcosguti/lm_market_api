import type { PasswordResetToken } from '@prisma/client';

import prisma from '../prisma.js';

export async function createPasswordResetToken(data: {
  expiresAt: Date;
  token: string;
  userId: string;
}): Promise<PasswordResetToken> {
  return prisma.passwordResetToken.create({
    data: {
      expiresAt: data.expiresAt,
      token: data.token,
      userId: data.userId,
    },
  });
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  await prisma.passwordResetToken.delete({
    where: { token },
  });
}

export async function deletePasswordResetTokensByUserId(userId: string): Promise<void> {
  await prisma.passwordResetToken.deleteMany({
    where: { userId },
  });
}

export async function findPasswordResetTokenByToken(
  token: string,
): Promise<null | PasswordResetToken> {
  return prisma.passwordResetToken.findUnique({
    include: { user: true },
    where: { token },
  });
}
