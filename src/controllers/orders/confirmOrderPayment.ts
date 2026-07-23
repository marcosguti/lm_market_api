import type { Response } from 'express';

import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middlewares/auth.js';

import { megasoftConfig } from '../../config/megasoft.js';
import { uploadPaymentScreenshot } from '../../libs/filesInDigitalOcean/index.js';
import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import { emitKitchenOrderUpdated, emitOrderUpdated } from '../../realtime/socket.js';
import {
  confirmPendingOrderPaymentWithDetails,
  notifyOrderStatusChange,
  notifyStoreAdminsNewOrderEmail,
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
  const {
    customerNotes,
    deliveryAddress,
    deliveryLatitude,
    deliveryLongitude,
    method,
    note,
    paidAt,
    reference,
  } = req.body as {
    customerNotes?: string;
    deliveryAddress?: string;
    deliveryLatitude?: string;
    deliveryLongitude?: string;
    method?: string;
    note?: string;
    paidAt?: string;
    reference?: string;
  };

  const validation = confirmPaymentSchema.validate({
    customerNotes,
    deliveryAddress,
    deliveryLatitude:
      deliveryLatitude === undefined || deliveryLatitude === ''
        ? undefined
        : Number(deliveryLatitude),
    deliveryLongitude:
      deliveryLongitude === undefined || deliveryLongitude === ''
        ? undefined
        : Number(deliveryLongitude),
    method,
    note,
    paidAt,
    reference,
  });
  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }

  if (validation.value.method === 'mobilePayment' && megasoftConfig.enabled) {
    res.status(400).json({
      code: 'USE_MOBILE_VERIFY',
      error: 'Use el endpoint de verificación automática de pago móvil',
    });
    return;
  }

  if (!file) {
    res.status(400).json({ error: 'El comprobante de pago es requerido' });
    return;
  }

  let paidAtDate: Date | null = null;
  if (paidAt) {
    paidAtDate = new Date(paidAt);
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (paidAtDate > now || paidAtDate < oneWeekAgo) {
      res.status(400).json({ error: 'La fecha de pago debe estar entre los últimos 7 días' });
      return;
    }
  }

  const fileName = uuidv4();
  const ext = file.mimetype.split('/')[1] ?? 'jpg';
  const screenshotUrl = await uploadPaymentScreenshot(file.buffer, file.mimetype, ext, fileName);

  try {
    const result = await confirmPendingOrderPaymentWithDetails(userId, orderId, {
      customerNotes: validation.value.customerNotes ?? null,
      deliveryAddress: validation.value.deliveryAddress ?? null,
      deliveryLatitude: validation.value.deliveryLatitude,
      deliveryLongitude: validation.value.deliveryLongitude,
      method: validation.value.method,
      note: validation.value.note ?? null,
      paidAt: paidAtDate,
      reference: validation.value.reference ?? null,
      screenshotUrl,
    });

    await notifyOrderStatusChange(result.order, 'pending');
    await notifyStoreAdminsNewOrderEmail(result.order);
    const orderPayload = {
      id: result.order.id,
      status: result.order.status,
      totalAmount: result.order.totalAmount,
    };
    emitOrderUpdated(result.order.userId, orderPayload);
    emitKitchenOrderUpdated(orderPayload);

    res.json(result);
  } catch (err) {
    handleOrderError(err, res);
  }
}
