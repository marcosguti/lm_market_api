import type { User, UserType } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

import prisma from '../prisma.js';

export async function createUser(data: {
  address?: string;
  email: string;
  firstName: string;
  lastName: string;
  numberId: string;
  password: string;
  phone?: string;
  type?: UserType;
}): Promise<User> {
  return prisma.user.create({
    data: {
      address: data.address,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      numberId: data.numberId,
      password: data.password,
      phone: data.phone,
      type: data.type ?? 'client',
    },
  });
}

export async function findUserByEmail(email: string): Promise<null | User> {
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function findUserById(id: string): Promise<null | User> {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function findUserByNumberId(numberId: string): Promise<null | User> {
  return prisma.user.findUnique({
    where: { numberId },
  });
}

export async function updateUser(
  userId: string,
  data: { address?: string; firstName?: string; lastName?: string; phone?: string },
): Promise<User> {
  return prisma.user.update({
    data: {
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
    },
    where: { id: userId },
  });
}

export async function updateUserPassword(
  userId: string,
  hashedPassword: string,
  tx?: PrismaClient,
): Promise<User> {
  const client = tx ?? prisma;
  return client.user.update({
    data: { password: hashedPassword },
    where: { id: userId },
  });
}
