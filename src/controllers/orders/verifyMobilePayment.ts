import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import {
  megasoftCertP2cPayload,
  megasoftConfig,
  resolveMegasoftAmount,
} from '../../config/megasoft.js';
import prisma from '../../prisma.js';
import {
  MegasoftPaymentRejectedError,
  MegasoftPlatformError,
} from '../../services/megasoft/index.js';
import { notifyOrderPaid, verifyMobilePaymentP2c } from '../../services/orderService.js';
import { asClient } from '../orders/asClient.js';
import { verifyMobilePaymentSchema } from '../payments/schemas.js';
import { getParam, handleOrderError } from '../shared/orderHttp.js';

export async function verifyMobilePayment(req: AuthRequest, res: Response): Promise<void> {
  if (!megasoftConfig.enabled) {
    res.status(503).json({ error: 'Verificación automática de pago móvil no disponible' });
    return;
  }

  const userId = asClient(req, res);
  if (!userId) return;

  const orderId = getParam(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'El id del pedido es requerido' });
    return;
  }

  const validation = verifyMobilePaymentSchema.validate(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error.message });
    return;
  }

  const { amount, bankCode, nationalId, phone, reference } = validation.value;

  const orderPreview = await prisma.order.findUnique({
    select: { id: true, totalAmount: true },
    where: { id: orderId },
  });
  const megasoftRequestLog = buildMegasoftP2cRequestLog({
    amount,
    bankCode,
    invoice: orderPreview ? orderPreview.id.replace(/-/g, '').slice(0, 20) : undefined,
    nationalId,
    orderTotalAmount: orderPreview ? Number(orderPreview.totalAmount) : undefined,
    phone,
    reference,
  });

  try {
    const result = await verifyMobilePaymentP2c(userId, orderId, {
      amount,
      clientBankCode: bankCode,
      clientPhone: phone,
      nationalId,
      reference,
    });

    await notifyOrderPaid(result.order);

    res.json({
      changes: result.changes,
      order: result.order,
      voucher: result.voucher,
    });
  } catch (err) {
    if (err instanceof MegasoftPlatformError) {
      res.status(err.statusCode).json({
        code: 'MEGASOFT_PLATFORM_ERROR',
        error: err.message,
      });
      return;
    }
    if (err instanceof MegasoftPaymentRejectedError) {
      res.status(422).json({
        code: 'MEGASOFT_PAYMENT_REJECTED',
        details: {
          description: err.result.description,
          status: err.result.status,
        },
        error: err.message,
        voucher: err.result.voucher || undefined,
      });
      return;
    }
    console.error('[orders.verifyMobilePayment] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
      megasoftRequest: megasoftRequestLog,
      orderId,
      stack: err instanceof Error ? err.stack : undefined,
      userId,
    });
    handleOrderError(err, res);
  }
}

function buildMegasoftP2cRequestLog(input: {
  amount: number;
  bankCode: string;
  invoice?: string;
  nationalId: string;
  orderTotalAmount?: number;
  phone: string;
  reference: string;
}) {
  const baseUrl = megasoftConfig.baseUrl;
  if (megasoftConfig.certHardcoded) {
    return {
      endpoints: {
        preRegister: `${baseUrl}/action/v2-preregistro`,
        processP2c: `${baseUrl}/action/v2-procesar-compra-p2c`,
        queryStatus: `${baseUrl}/action/v2-querystatus`,
      },
      hardcoded: true,
      payload: {
        affiliationCode: megasoftConfig.affiliationCode,
        amount: input.orderTotalAmount
          ? resolveMegasoftAmount(input.orderTotalAmount).toFixed(2)
          : undefined,
        clientBankCode: megasoftCertP2cPayload.clientBankCode,
        clientPhone: megasoftCertP2cPayload.clientPhone,
        invoice: input.invoice,
        merchantBankCode: megasoftCertP2cPayload.merchantBankCode,
        merchantPhone: megasoftCertP2cPayload.merchantPhone,
      },
    };
  }
  return {
    endpoints: {
      preRegister: `${baseUrl}/action/v2-preregistro`,
      processP2c: `${baseUrl}/action/v2-procesar-compra-p2c`,
      queryStatus: `${baseUrl}/action/v2-querystatus`,
    },
    payload: {
      affiliationCode: megasoftConfig.affiliationCode,
      amount: input.amount.toFixed(2),
      clientBankCode: input.bankCode,
      clientPhone: input.phone,
      invoice: input.invoice,
      merchantBankCode: megasoftConfig.merchantBankCode,
      merchantCid: megasoftConfig.merchantCid || undefined,
      merchantPhone: megasoftConfig.merchantPhone,
      nationalId: input.nationalId,
      reference: input.reference,
    },
  };
}
