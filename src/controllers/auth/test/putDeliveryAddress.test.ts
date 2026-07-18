import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../../../middlewares/auth.js';

const reverseGeocodeDeliveryPin = vi.fn();
const updateUser = vi.fn();

vi.mock('../../../libs/mapboxGeocoding.js', () => ({
  MapboxGeocodingError: class MapboxGeocodingError extends Error {
    constructor(
      message: string,
      readonly statusCode = 502,
    ) {
      super(message);
      this.name = 'MapboxGeocodingError';
    }
  },
  reverseGeocodeDeliveryPin: (...args: unknown[]) => reverseGeocodeDeliveryPin(...args),
}));

vi.mock('../../../queries/user.js', () => ({
  updateUser: (...args: unknown[]) => updateUser(...args),
}));

import { putDeliveryAddress } from '../putDeliveryAddress.js';

function mockRes(): Response & { statusCode: number; body?: unknown } {
  const res = {
    body: undefined as unknown,
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    statusCode: 200,
  };
  return res as Response & { statusCode: number; body?: unknown };
}

describe('putDeliveryAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    const res = mockRes();
    await putDeliveryAddress({} as AuthRequest, res);
    expect(res.statusCode).toBe(401);
  });

  it('saves geocoded address when city matches expectedCity', async () => {
    reverseGeocodeDeliveryPin.mockResolvedValue({
      address: 'Av. Las Americas, Mérida',
      city: 'merida',
    });
    updateUser.mockResolvedValue({
      address: 'Av. Las Americas, Mérida',
      addressCity: 'merida',
      addressLatitude: 8.59,
      addressLongitude: -71.15,
      email: 'a@test.com',
      firstName: 'Ana',
      id: 'u1',
      lastName: 'Client',
      password: 'hash',
    });

    const res = mockRes();
    await putDeliveryAddress(
      {
        body: { expectedCity: 'merida', latitude: 8.59, longitude: -71.15 },
        userId: 'u1',
      } as AuthRequest,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(updateUser).toHaveBeenCalledWith('u1', {
      address: 'Av. Las Americas, Mérida',
      addressCity: 'merida',
      addressLatitude: 8.59,
      addressLongitude: -71.15,
    });
    expect((res.body as { user: { password?: string } }).user.password).toBeUndefined();
  });

  it('rejects when geocoded city mismatches expectedCity', async () => {
    reverseGeocodeDeliveryPin.mockResolvedValue({
      address: 'Centro, Tovar',
      city: 'tovar',
    });
    const res = mockRes();
    await putDeliveryAddress(
      {
        body: { expectedCity: 'merida', latitude: 8.33, longitude: -71.75 },
        userId: 'u1',
      } as AuthRequest,
      res,
    );
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      code: 'ADDRESS_CITY_MISMATCH',
      error: 'La ubicación debe estar en la ciudad de la tienda seleccionada',
    });
    expect(updateUser).not.toHaveBeenCalled();
  });
});
