import type { Request, Response } from 'express';

import { translateJoiError } from '../libs/joiTranslate.js';

type Validator = {
  validate: (value: unknown) => {
    error?: { details: { context?: Record<string, unknown>; type: string }[] };
    value: unknown;
  };
};

export function validateBody(
  req: Request,
  res: Response,
  schema: Validator,
  next: () => void,
): void {
  const result = schema.validate(req.body);
  if (result.error) {
    const first = result.error.details[0];
    const message = first ? translateJoiError(first) : 'Datos inválidos';
    res.status(400).json({ error: message });
    return;
  }
  req.body = result.value;
  next();
}

export function validateQuery(
  req: Request,
  res: Response,
  schema: Validator,
  next: () => void,
): void {
  const result = schema.validate(req.query);
  if (result.error) {
    const first = result.error.details[0];
    const message = first ? translateJoiError(first) : 'Datos inválidos';
    res.status(400).json({ error: message });
    return;
  }
  req.query = result.value as Request['query'];
  next();
}
