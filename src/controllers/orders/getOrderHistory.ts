import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { getUserOrderHistory } from '../../services/orderService.js';
import { handleOrderError } from '../shared/orderHttp.js';
import { asClient } from './asClient.js';
import { orderHistoryQuerySchema } from './schemas.js';

export async function getOrderHistory(req: AuthRequest, res: Response): Promise<void> {
  const userId = asClient(req, res);
  if (!userId) return;
  const validation = orderHistoryQuerySchema.validate(req.query, { convert: true });
  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }
  try {
    const { createdFrom, createdTo, page, pageSize, q } = validation.value;
    const result = await getUserOrderHistory(userId, page, pageSize, {
      createdFrom,
      createdTo,
      q,
    });
    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}
