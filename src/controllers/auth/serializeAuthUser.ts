import { Prisma, type User } from '@prisma/client';

export type AuthUserPublic = {
  [K in keyof Omit<User, 'password'>]: K extends 'addressLatitude' | 'addressLongitude'
    ? null | number
    : Omit<User, 'password'>[K];
};

/** Strip password and coerce Decimal coords to JSON numbers. */
export function serializeAuthUser(user: User): AuthUserPublic {
  const { password: _password, ...rest } = user;
  return {
    ...rest,
    addressLatitude: decimalToNumber(user.addressLatitude),
    addressLongitude: decimalToNumber(user.addressLongitude),
  };
}

function decimalToNumber(value: null | number | Prisma.Decimal | undefined): null | number {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}
