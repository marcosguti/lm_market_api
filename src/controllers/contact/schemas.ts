import Joi from 'joi';

export const CONTACT_AREAS = [
  'contacto',
  'ventas',
  'mercadeo',
  'talento-humano',
  'soporte',
] as const;

export const CONTACT_LIMITS = {
  messageMax: 5000,
  messageMin: 10,
  nameMax: 100,
  nameMin: 2,
  subjectMax: 200,
  subjectMin: 3,
} as const;

export const createContactSchema = Joi.object({
  area: Joi.string()
    .valid(...CONTACT_AREAS)
    .required()
    .messages({
      'any.only': 'Selecciona un área válida',
      'any.required': 'El área es obligatoria',
      'string.empty': 'El área es obligatoria',
    }),
  email: Joi.string().email().trim().lowercase().required().messages({
    'any.required': 'El email es obligatorio',
    'string.email': 'Email no válido',
    'string.empty': 'El email es obligatorio',
  }),
  message: Joi.string()
    .trim()
    .min(CONTACT_LIMITS.messageMin)
    .max(CONTACT_LIMITS.messageMax)
    .required()
    .messages({
      'any.required': 'El mensaje es obligatorio',
      'string.empty': 'El mensaje es obligatorio',
      'string.max': `El mensaje no puede superar ${CONTACT_LIMITS.messageMax} caracteres`,
      'string.min': `El mensaje debe tener al menos ${CONTACT_LIMITS.messageMin} caracteres`,
    }),
  name: Joi.string()
    .trim()
    .min(CONTACT_LIMITS.nameMin)
    .max(CONTACT_LIMITS.nameMax)
    .required()
    .messages({
      'any.required': 'El nombre es obligatorio',
      'string.empty': 'El nombre es obligatorio',
      'string.max': `El nombre no puede superar ${CONTACT_LIMITS.nameMax} caracteres`,
      'string.min': `El nombre debe tener al menos ${CONTACT_LIMITS.nameMin} caracteres`,
    }),
  subject: Joi.string()
    .trim()
    .min(CONTACT_LIMITS.subjectMin)
    .max(CONTACT_LIMITS.subjectMax)
    .required()
    .messages({
      'any.required': 'El asunto es obligatorio',
      'string.empty': 'El asunto es obligatorio',
      'string.max': `El asunto no puede superar ${CONTACT_LIMITS.subjectMax} caracteres`,
      'string.min': `El asunto debe tener al menos ${CONTACT_LIMITS.subjectMin} caracteres`,
    }),
});
