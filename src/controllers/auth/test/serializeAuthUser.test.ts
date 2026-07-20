import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { serializeAuthUser } from '../serializeAuthUser.js';

function sampleUser(overrides: Record<string, unknown> = {}) {
  return {
    address: 'Av. Las Americas',
    addressCity: 'merida',
    addressLatitude: new Prisma.Decimal('8.5981360'),
    addressLongitude: new Prisma.Decimal('-71.1504260'),
    createdAt: new Date('2026-01-01'),
    email: 'a@test.com',
    emailVerified: true,
    firstName: 'Ana',
    id: 'u1',
    lastName: 'Client',
    numberId: '123',
    numberIdType: 'V',
    password: 'hash',
    phone: '+580000000000',
    phoneVerified: true,
    storeId: null,
    type: 'client',
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as Parameters<typeof serializeAuthUser>[0];
}

describe('serializeAuthUser', () => {
  it('strips password and returns lat/lng as numbers', () => {
    const result = serializeAuthUser(sampleUser());
    expect(result).not.toHaveProperty('password');
    expect(typeof result.addressLatitude).toBe('number');
    expect(typeof result.addressLongitude).toBe('number');
    expect(result.addressLatitude).toBeCloseTo(8.598136);
    expect(result.addressLongitude).toBeCloseTo(-71.150426);
  });

  it('keeps null coords as null', () => {
    const result = serializeAuthUser(sampleUser({ addressLatitude: null, addressLongitude: null }));
    expect(result.addressLatitude).toBeNull();
    expect(result.addressLongitude).toBeNull();
  });
});
