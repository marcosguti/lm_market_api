import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { MapboxGeocodingError, reverseGeocodeDeliveryPin } from '../../libs/mapboxGeocoding.js';
import { updateUser } from '../../queries/user.js';
import { putDeliveryAddressSchema } from './schemas.js';

export async function putDeliveryAddress(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  const validation = putDeliveryAddressSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }

  const { expectedCity, latitude, longitude } = validation.value;

  try {
    const geocoded = await reverseGeocodeDeliveryPin({ latitude, longitude });
    if (expectedCity && geocoded.city !== expectedCity) {
      res.status(422).json({
        code: 'ADDRESS_CITY_MISMATCH',
        error: 'La ubicación debe estar en la ciudad de la tienda seleccionada',
      });
      return;
    }
    const user = await updateUser(req.userId, {
      address: geocoded.address,
      addressCity: geocoded.city,
      addressLatitude: latitude,
      addressLongitude: longitude,
    });
    const { password: _p, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    if (error instanceof MapboxGeocodingError) {
      res.status(error.statusCode).json({
        code: 'GEOCODE_FAILED',
        error: error.message,
      });
      return;
    }
    throw error;
  }
}
