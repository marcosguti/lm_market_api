import type { OrderStatus } from '@prisma/client';

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  cancelled: 'Cancelada',
  delivered: 'Entregada',
  outForDelivery: 'En Reparto',
  paymentConfirmed: 'Pago Confirmado',
  pending: 'Pendiente',
  preparing: 'Preparando',
  readyForDelivery: 'Lista para Reparto',
};

export function formatOrderStatusChangeBody(
  previousStatus: OrderStatus | string,
  newStatus: OrderStatus | string,
): string {
  return `Tu orden cambió de ${formatOrderStatusLabel(previousStatus)} a ${formatOrderStatusLabel(newStatus)}`;
}

export function formatOrderStatusLabel(status: OrderStatus | string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}
