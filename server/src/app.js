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

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

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

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
