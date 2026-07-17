-- Insert between pending and paymentConfirmed to match schema order
ALTER TYPE "OrderStatus" ADD VALUE 'paymentPendingConfirmation' BEFORE 'paymentConfirmed';
