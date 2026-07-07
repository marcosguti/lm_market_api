import type { Response } from 'express';

import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middlewares/auth.js';

import { megasoftConfig } from '../../config/megasoft.js';
import { uploadPaymentScreenshot } from '../../libs/filesInDigitalOcean/index.js';
import {
  confirmPendingOrderPaymentWithDetails,
  notifyOrderPaid,
} from '../../services/orderService.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';
import { asClient } from './asClient.js';
import { confirmPaymentSchema } from './schemas.js';

export async function confirmOrderPayment(req: AuthRequest, res: Response): Promise<void> {
  const userId = asClient(req, res);
  if (!userId) return;

  const orderId = getParam(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }

  const file = req.file;
  const { method, paidAt, reference } = req.body as {
    method?: string;
    paidAt?: string;
    reference?: string;
  };

  const validation = confirmPaymentSchema.validate({ method, paidAt, reference });
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }

  if (validation.value.method === 'mobilePayment' && megasoftConfig.enabled) {
    res.status(400).json({
      code: 'USE_MOBILE_VERIFY',
      error: 'Use el endpoint de verificación automática de pago móvil',
    });
    return;
  }

  const isCash = validation.value.method === 'cash';

  if (!isCash && !file) {
    res.status(400).json({ error: 'El comprobante de pago es requerido' });
    return;
  }

  let paidAtDate: Date | null = null;
  let screenshotUrl: null | string = null;

  if (!isCash && paidAt) {
    paidAtDate = new Date(paidAt);
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (paidAtDate > now || paidAtDate < oneWeekAgo) {
      res.status(400).json({ error: 'La fecha de pago debe estar entre los últimos 7 días' });
      return;
    }
  }

  if (!isCash && file) {
    const fileName = uuidv4();
    const ext = file.mimetype.split('/')[1] ?? 'jpg';
    screenshotUrl = await uploadPaymentScreenshot(file.buffer, file.mimetype, ext, fileName);
  }

  try {
    const result = await confirmPendingOrderPaymentWithDetails(userId, orderId, {
      method: validation.value.method,
      paidAt: isCash ? null : paidAtDate,
      reference: isCash ? null : (validation.value.reference ?? null),
      screenshotUrl,
    });

    await notifyOrderPaid(result.order);

    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}
