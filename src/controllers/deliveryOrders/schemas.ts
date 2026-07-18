import Joi from 'joi';

export { paginationQuerySchema } from '../commonSchema.js';

export const upsertDeliveryLocationSchema = Joi.object({
  accuracyMeters: Joi.number().min(0).max(1000).allow(null).optional(),
  deviceId: Joi.string().trim().min(1).max(120).allow(null, '').optional(),
  deviceRecordedAt: Joi.date().iso().allow(null).optional(),
  headingDegrees: Joi.number().min(0).max(360).allow(null).optional(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  speedMps: Joi.number().min(0).max(100).allow(null).optional(),
  trackingSessionId: Joi.string().trim().min(1).max(120).allow(null, '').optional(),
});
