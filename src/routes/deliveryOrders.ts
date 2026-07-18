import { Router } from 'express';

import {
  getMyDeliveryOrders,
  markDeliveryOrderAsDelivered,
  putDeliveryOrderLocation,
  startDeliveryOrder,
} from '../controllers/deliveryOrders/index.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { deliveryProofUploadMiddleware } from '../middlewares/uploadDeliveryProof.js';

const router = Router();

router.get('/mine', requireAuth, requireRole(['deliveryDriver']), getMyDeliveryOrders);
router.patch('/:id/start', requireAuth, requireRole(['deliveryDriver']), startDeliveryOrder);
router.put('/:id/location', requireAuth, requireRole(['deliveryDriver']), putDeliveryOrderLocation);
router.patch('/:id/delivered', requireAuth, requireRole(['deliveryDriver']), (req, res, _next) => {
  deliveryProofUploadMiddleware(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : 'Error al subir la imagen';
      res.status(400).json({ error: message });
      return;
    }
    void markDeliveryOrderAsDelivered(req, res);
  });
});

export default router;
