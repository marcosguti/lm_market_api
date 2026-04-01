import type { Express } from 'express';

import authRoutes from './auth.js';
import productRoutes from './products.js';

export default function setRoutes(app: Express): void {
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
}
