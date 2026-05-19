import './loadEnv.js';
import cors from 'cors';
import express from 'express';
import { createServer } from 'http';

import {
  runExternalProductsSync,
  startExternalProductsSyncSchedule,
} from './jobs/syncExternalProductsJob.js';
import { authMiddleware } from './middlewares/auth.js';
import { endpointGuard } from './middlewares/endpointGuard.js';
import { createSocketServer } from './realtime/socket.js';
import setRoutes from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(authMiddleware);

app.use(endpointGuard);

setRoutes(app);

const PORT = process.env.PORT ?? 3000;
const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console -- server startup message
  console.log(`LM Market API listening on port ${PORT}`);
  void runExternalProductsSync().catch((err) => {
    console.error('[product-sync] startup sync failed', err);
  });
  startExternalProductsSyncSchedule();
});
