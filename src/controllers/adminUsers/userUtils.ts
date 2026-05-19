import { Prisma, type User } from '@prisma/client';

export function isPrismaUniqueError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export function serializeUser(user: User) {
  const { password: _p, ...rest } = user;
  return rest;
}
