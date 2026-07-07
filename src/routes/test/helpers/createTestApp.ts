import cors from 'cors';
import express from 'express';

import { authMiddleware } from '../../../middlewares/auth.js';
import setRoutes from '../../index.js';

export function createTestApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(authMiddleware);
  setRoutes(app);
  return app;
}
