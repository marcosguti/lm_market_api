import Joi from 'joi';

export { paginationQuerySchema } from '../commonSchema.js';

export const patchStatusSchema = Joi.object({
  status: Joi.string().valid('preparando', 'listaParaReparto', 'entregada', 'cancelada').required(),
});
