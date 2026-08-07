import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { authenticate } from '../auth/middleware';

if (!fs.existsSync(env.uploadDir)) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
});

export const uploadsRouter = Router();

// Endpoint de upload de arquivo. Retorna { file_url } no mesmo formato
// que o frontend já espera (src/pages/*, src/components/tickets/*).
uploadsRouter.post('/', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const file_url = `${env.apiPublicUrl}/uploads/${req.file.filename}`;
  return res.status(201).json({
    file_url,
    file_name: req.file.originalname,
    file_size: req.file.size,
  });
});
