import type { UserType } from '@prisma/client';
import { vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  findUserById: vi.fn(),
  verifyToken: vi.fn(),
}));

export { authMocks };

vi.mock('../../../libs/jwt.js', () => ({
  verifyToken: authMocks.verifyToken,
}));

export function mockAuthenticatedUser(
  userId: string,
  userType: UserType,
  options: { storeId?: null | string } = {},
): void {
  const storeId =
    options.storeId !== undefined ? options.storeId : userType === 'admin' ? 'store-1' : null;
  authMocks.verifyToken.mockReturnValue({ userId });
  authMocks.findUserById.mockResolvedValue({
    id: userId,
    type: userType,
    storeId,
    email: `${userType}@test.com`,
    firstName: 'Test',
    lastName: 'User',
    numberId: 'V12345678',
    numberIdType: 'V',
    password: 'hash',
    address: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function authHeader(): { Authorization: string } {
  return { Authorization: 'Bearer test-token' };
}
