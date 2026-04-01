import './loadEnv.js';
import cors from 'cors';
import express from 'express';

import {
  runExternalProductsSync,
  startExternalProductsSyncSchedule,
} from './jobs/syncExternalProductsJob.js';
import { authMiddleware } from './middlewares/auth.js';
import setRoutes from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/products')) {
    next();
    return;
  }
  void authMiddleware(req, res, next).catch(next);
});

setRoutes(app);

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console -- server startup message
  console.log(`LM Market API listening on port ${PORT}`);
  void runExternalProductsSync().catch((err) => {
    console.error('[product-sync] startup sync failed', err);
  });
  startExternalProductsSyncSchedule();
});
