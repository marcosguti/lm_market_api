import type { Response } from 'express';

import type { AuthRequest } from '../../middlewares/auth.js';

import { joiValidationErrorMessage } from '../../libs/joiTranslate.js';
import {
  getAllPaymentMethodConfigs,
  getPaymentMethodConfig,
  updatePaymentMethodConfig,
} from '../../services/paymentMethodConfigService.js';
import { getParam } from '../shared/orderHttp.js';
import { isPaymentMethod, patchPaymentMethodConfigSchema } from './schemas.js';

export async function listAdminPaymentMethods(_req: AuthRequest, res: Response): Promise<void> {
  const methods = await getAllPaymentMethodConfigs();
  res.json({ data: methods });
}

export async function patchAdminPaymentMethod(req: AuthRequest, res: Response): Promise<void> {
  const methodParam = getParam(req.params.method);
  if (!methodParam || !isPaymentMethod(methodParam)) {
    res.status(400).json({ error: 'Método de pago inválido' });
    return;
  }

  const existing = await getPaymentMethodConfig(methodParam);
  if (!existing) {
    res.status(404).json({ error: 'Método de pago no encontrado' });
    return;
  }

  const validation = patchPaymentMethodConfigSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (validation.error) {
    res.status(400).json({ error: joiValidationErrorMessage(validation.error) });
    return;
  }

  const { active, information, noteEnabled, placeholder } = validation.value as {
    active?: boolean;
    information?: null | string;
    noteEnabled?: boolean;
    placeholder?: null | string;
  };

  if (
    active === undefined &&
    information === undefined &&
    noteEnabled === undefined &&
    placeholder === undefined
  ) {
    res.status(400).json({ error: 'Debe enviar al menos un campo para actualizar' });
    return;
  }

  const normalizeOptionalText = (value: null | string | undefined): null | string | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  const updated = await updatePaymentMethodConfig(methodParam, {
    ...(active !== undefined ? { active } : {}),
    ...(information !== undefined ? { information: normalizeOptionalText(information) } : {}),
    ...(noteEnabled !== undefined ? { noteEnabled } : {}),
    ...(placeholder !== undefined ? { placeholder: normalizeOptionalText(placeholder) } : {}),
  });

  res.json({ data: updated });
}
