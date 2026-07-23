import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { upsertDeliveryLocation } from '../../services/orderDeliveryTrackingService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';
import { upsertDeliveryLocationSchema } from './schemas.js';

export async function putDeliveryOrderLocation(req: AuthRequest, res: Response): Promise<void> {
  const orderId = getParam(req.params.id);
  if (!orderId || !req.userId || !req.userType) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }
  if (req.userType !== 'deliveryDriver') {
    res.status(403).json({ error: 'Solo el repartidor puede transmitir ubicación' });
    return;
  }

  const validation = upsertDeliveryLocationSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }

  try {
    const tracking = await upsertDeliveryLocation(req.userId, orderId, {
      accuracyMeters: validation.value.accuracyMeters ?? null,
      deviceId: validation.value.deviceId ?? null,
      deviceRecordedAt: validation.value.deviceRecordedAt
        ? new Date(validation.value.deviceRecordedAt)
        : null,
      headingDegrees: validation.value.headingDegrees ?? null,
      latitude: validation.value.latitude,
      longitude: validation.value.longitude,
      speedMps: validation.value.speedMps ?? null,
      trackingSessionId: validation.value.trackingSessionId ?? null,
    });
    res.json({ tracking });
  } catch (err) {
    handleOrderError(err, res);
  }
}
