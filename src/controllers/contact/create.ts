import type { Request, Response } from 'express';

import { sendContactEmail } from '../../libs/sendEmail/index.js';
import { createContactSchema } from './schemas.js';

export async function createContact(req: Request, res: Response): Promise<void> {
  const validation = createContactSchema.validate(req.body, { abortEarly: true });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }

  const { area, email, message, name, subject } = validation.value;

  try {
    await sendContactEmail({ area, email, message, name, subject });
  } catch (err) {
    console.error('[contact] failed to send email', {
      email,
      error: err instanceof Error ? err.message : err,
    });
    res.status(502).json({
      error: 'No se pudo enviar el mensaje. Inténtalo de nuevo más tarde.',
    });
    return;
  }

  res.json({
    message: 'Tu mensaje fue enviado. Te responderemos a la brevedad.',
  });
}
