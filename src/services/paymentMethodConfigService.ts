import type { PaymentMethod, PaymentMethodConfig } from '@prisma/client';

import prisma from '../prisma.js';

export type PaymentMethodConfigUpdate = {
  active?: boolean;
  information?: null | string;
  noteEnabled?: boolean;
  placeholder?: null | string;
};

export type PublicPaymentMethodConfig = {
  information: null | string;
  method: PaymentMethod;
  noteEnabled: boolean;
  placeholder: null | string;
};

const METHOD_ORDER: PaymentMethod[] = ['cash', 'zelle', 'mobilePayment', 'binance'];

export async function getActivePaymentMethodConfigs(): Promise<PublicPaymentMethodConfig[]> {
  const configs = await prisma.paymentMethodConfig.findMany({
    where: { active: true },
  });
  return sortByMethodOrder(configs).map(toPublicPaymentMethodConfig);
}

export async function getAllPaymentMethodConfigs(): Promise<PaymentMethodConfig[]> {
  const configs = await prisma.paymentMethodConfig.findMany();
  return sortByMethodOrder(configs);
}

export async function getPaymentMethodConfig(
  method: PaymentMethod,
): Promise<null | PaymentMethodConfig> {
  return prisma.paymentMethodConfig.findUnique({ where: { method } });
}

export function toPublicPaymentMethodConfig(
  config: PaymentMethodConfig,
): PublicPaymentMethodConfig {
  return {
    information: config.information,
    method: config.method,
    noteEnabled: config.noteEnabled,
    placeholder: config.placeholder,
  };
}

export async function updatePaymentMethodConfig(
  method: PaymentMethod,
  data: PaymentMethodConfigUpdate,
): Promise<PaymentMethodConfig> {
  return prisma.paymentMethodConfig.update({
    data,
    where: { method },
  });
}

function sortByMethodOrder(configs: PaymentMethodConfig[]): PaymentMethodConfig[] {
  const index = new Map(METHOD_ORDER.map((method, i) => [method, i]));
  return [...configs].sort((a, b) => (index.get(a.method) ?? 99) - (index.get(b.method) ?? 99));
}
