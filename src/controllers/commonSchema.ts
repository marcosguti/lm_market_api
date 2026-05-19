import Joi from 'joi';

/** Paginación compartida (query) para órdenes, cocina, reparto y notificaciones. */
export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});
