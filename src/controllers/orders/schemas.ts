import Joi from 'joi';

export { paginationQuerySchema } from '../commonSchema.js';

export const patchLinesSchema = Joi.object({
  lines: Joi.array()
    .items(
      Joi.object({
        code: Joi.string().trim().required(),
        quantity: Joi.number().integer().min(0).required(),
      }),
    )
    .required(),
});
