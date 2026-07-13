import Joi from 'joi';

import { paginationQuerySchema } from '../commonSchema.js';

export { paginationQuerySchema } from '../commonSchema.js';

export const notificationsQuerySchema = paginationQuerySchema.keys({
  inbox: Joi.boolean().default(false),
  recentRead: Joi.number().integer().min(0).max(50).default(5),
});
