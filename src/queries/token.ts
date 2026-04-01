import type { Token } from '@prisma/client';

import prisma from '../prisma.js';

export async function createToken(data: { expirationDate: Date; userId: string }): Promise<Token> {
  return prisma.token.create({
    data: {
      createdAt: new Date(),
      expirationDate: data.expirationDate,
      userId: data.userId,
    },
  });
}

export async function deleteTokensByUserId(userId: string): Promise<number> {
  const result = await prisma.token.deleteMany({
    where: { userId },
  });
  return result.count;
}

export async function findTokenById(id: string): Promise<null | Token> {
  return prisma.token.findUnique({
    where: { id },
  });
}
