import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { gymRouter } from './routes/gym.js';
import { membersRouter } from './routes/members.js';
import { plansRouter } from './routes/plans.js';
import { membershipsRouter } from './routes/memberships.js';
import { paymentsRouter } from './routes/payments.js';
import { attendanceRouter } from './routes/attendance.js';
import { followupsRouter } from './routes/followups.js';
import { dashboardRouter } from './routes/dashboard.js';
import { reportsRouter } from './routes/reports.js';
import { batchesRouter } from './routes/batches.js';
import { photosRouter } from './routes/photos.js';

const webDist = fileURLToPath(new URL('../public', import.meta.url));

/**
 * In production the built React app (server/public, from `npm run build` in client/) is served from the same server,
 * so the site and /api share one domain. Any non-API GET that isn't a file gets
 * index.html, letting React Router handle /login, /owner/members, etc.
 */
function serveWebApp(app) {
  const indexHtml = path.join(webDist, 'index.html');
  if (!fs.existsSync(indexHtml)) return; // dev: Vite serves the client
  app.use('/assets', express.static(path.join(webDist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(webDist, { index: false }));
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path === '/api' || req.path.startsWith('/api/')) return next();
    res.set('Cache-Control', 'no-cache').sendFile(indexHtml);
  });
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '1mb' })); // photo uploads are ~50-150 KB of base64

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/gym', gymRouter);
  app.use('/api/members', membersRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/memberships', membershipsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/followups', followupsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/batches', batchesRouter);
  app.use('/api/photos', photosRouter);

  serveWebApp(app);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
