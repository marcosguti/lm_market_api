import type { Request, Response } from 'express';

export function validateBody<T>(
  req: Request,
  res: Response,
  schema: { validate: (value: unknown) => { error?: { message: string }; value: T } },
  next: () => void,
): void {
  const result = schema.validate(req.body);
  if (result.error) {
    res.status(400).json({ error: result.error.message });
    return;
  }
  req.body = result.value;
  next();
}

export function validateQuery<T>(
  req: Request,
  res: Response,
  schema: { validate: (value: unknown) => { error?: { message: string }; value: T } },
  next: () => void,
): void {
  const result = schema.validate(req.query);
  if (result.error) {
    res.status(400).json({ error: result.error.message });
    return;
  }
  req.query = result.value as Request['query'];
  next();
}
