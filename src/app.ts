import './loadEnv.js';
import cors from 'cors';
import express from 'express';
import { createServer } from 'http';

import {
  runExternalProductsSync,
  startExternalProductsSyncSchedule,
} from './jobs/syncExternalProductsJob.js';
import { corsOriginCallback } from './libs/corsOrigins.js';
import { authMiddleware } from './middlewares/auth.js';
import { createSocketServer } from './realtime/socket.js';
import setRoutes from './routes/index.js';

const app = express();

const corsOptions: cors.CorsOptions = {
  credentials: true,
  origin: corsOriginCallback,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use(authMiddleware);

setRoutes(app);

const PORT = Number(process.env.PORT ?? 3000);
const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console -- server startup message
  console.log(`LM Market API listening on port ${PORT} (all interfaces)`);
  void runExternalProductsSync().catch((err) => {
    console.error('[product-sync] startup sync failed', err);
  });
  startExternalProductsSyncSchedule();
});
