import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { env } from './config/env';
import { authRouter } from './auth/routes';
import { entitiesRouter } from './entities/routes';
import { uploadsRouter } from './uploads/routes';
import { functionsRouter } from './functions/routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.appPublicUrl,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));

  app.use('/uploads', express.static(path.resolve(env.uploadDir)));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/entities', entitiesRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/functions', functionsRouter);

  if (env.frontendDistDir) {
    const distDir = path.resolve(env.frontendDistDir);
    app.use(express.static(distDir));
    // SPA: qualquer rota que não seja /api/* ou /uploads/* devolve o
    // index.html, deixando o react-router decidir a tela no browser.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
