import Joi from 'joi';

export function parseMultipartBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return undefined;
}

export const createBlogArticleSchema = Joi.object({
  active: Joi.boolean().required(),
  content: Joi.string().trim().min(1).required(),
  title: Joi.string().trim().min(1).max(200).required(),
});

export const updateBlogArticleSchema = Joi.object({
  active: Joi.boolean().optional(),
  content: Joi.string().trim().min(1).optional(),
  title: Joi.string().trim().min(1).max(200).optional(),
}).min(1);
