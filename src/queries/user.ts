import type { NumberIdType, Prisma, User, UserType } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

import prisma from '../prisma.js';

export async function countSuperAdminUsers(): Promise<number> {
  return prisma.user.count({ where: { type: 'superAdmin' } });
}

export async function createUser(data: {
  address?: string;
  email: string;
  firstName: string;
  lastName: string;
  numberId: string;
  numberIdType: NumberIdType;
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
      numberIdType: data.numberIdType,
      password: data.password,
      phone: data.phone,
      type: data.type ?? 'client',
    },
  });
}

export async function deleteUserById(id: string): Promise<User> {
  return prisma.user.delete({ where: { id } });
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

export async function listUsersPaginated(params: {
  actorType: UserType;
  page: number;
  pageSize: number;
  search?: string;
}): Promise<{ data: User[]; total: number }> {
  const { actorType, page, pageSize, search } = params;
  const skip = (page - 1) * pageSize;
  const searchTrim = search?.trim();

  const typeFilter: Prisma.UserWhereInput =
    actorType === 'admin' ? { type: { in: ['client', 'deliveryDriver'] } } : {};

  const where: Prisma.UserWhereInput = {
    ...typeFilter,
    ...(searchTrim
      ? {
          OR: [
            { email: { contains: searchTrim, mode: 'insensitive' } },
            { firstName: { contains: searchTrim, mode: 'insensitive' } },
            { lastName: { contains: searchTrim, mode: 'insensitive' } },
            { numberId: { contains: searchTrim, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      where,
    }),
    prisma.user.count({ where }),
  ]);

  return { data, total };
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

export async function updateUserByAdmin(
  userId: string,
  data: {
    address?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    numberId?: string;
    numberIdType?: NumberIdType;
    phone?: string;
    type?: UserType;
  },
): Promise<User> {
  return prisma.user.update({
    data: {
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.numberId !== undefined && { numberId: data.numberId }),
      ...(data.numberIdType !== undefined && { numberIdType: data.numberIdType }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.type !== undefined && { type: data.type }),
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
