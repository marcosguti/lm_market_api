ALTER TYPE "OrderStatus" RENAME VALUE 'pendiente' TO 'pending';
ALTER TYPE "OrderStatus" RENAME VALUE 'pagoConfirmado' TO 'paymentConfirmed';
ALTER TYPE "OrderStatus" RENAME VALUE 'preparando' TO 'preparing';
ALTER TYPE "OrderStatus" RENAME VALUE 'listaParaReparto' TO 'readyForDelivery';
ALTER TYPE "OrderStatus" RENAME VALUE 'enReparto' TO 'outForDelivery';
ALTER TYPE "OrderStatus" RENAME VALUE 'entregada' TO 'delivered';
ALTER TYPE "OrderStatus" RENAME VALUE 'cancelada' TO 'cancelled';

ALTER TYPE "PaymentMethod" RENAME VALUE 'ZELLE' TO 'zelle';
ALTER TYPE "PaymentMethod" RENAME VALUE 'PAGO_MOVIL' TO 'mobilePayment';
ALTER TYPE "PaymentMethod" RENAME VALUE 'BINANCE' TO 'binance';