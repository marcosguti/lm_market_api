import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { isDeliveryCitySlug, isInsideDeliveryCityPolygon } from '../../config/delivery.js';
import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { MapboxGeocodingError, reverseGeocodeDeliveryPin } from '../../libs/mapboxGeocoding.js';
import { updateUser } from '../../queries/user.js';
import { putDeliveryAddressSchema } from './schemas.js';
import { serializeAuthUser } from './serializeAuthUser.js';

export async function putDeliveryAddress(req: AuthRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  const validation = putDeliveryAddressSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }

  const { expectedCity, latitude, longitude } = validation.value;

  if (expectedCity && isDeliveryCitySlug(expectedCity)) {
    if (!isInsideDeliveryCityPolygon(expectedCity, latitude, longitude)) {
      res.status(422).json({
        code: 'ADDRESS_OUT_OF_BOUNDS',
        error: 'La ubicación está fuera del área de entrega de la ciudad seleccionada',
      });
      return;
    }
  }

  try {
    const geocoded = await reverseGeocodeDeliveryPin({ latitude, longitude });
    if (expectedCity && geocoded.city !== expectedCity) {
      res.status(422).json({
        code: 'ADDRESS_CITY_MISMATCH',
        error: 'La ubicación debe estar en la ciudad de la tienda seleccionada',
      });
      return;
    }
    if (!isInsideDeliveryCityPolygon(geocoded.city, latitude, longitude)) {
      res.status(422).json({
        code: 'ADDRESS_OUT_OF_BOUNDS',
        error: 'La ubicación está fuera del área de entrega de esa ciudad',
      });
      return;
    }
    const user = await updateUser(req.userId, {
      address: geocoded.address,
      addressCity: geocoded.city,
      addressLatitude: latitude,
      addressLongitude: longitude,
    });
    res.json({ user: serializeAuthUser(user) });
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
