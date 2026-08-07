import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { verifyAccessToken } from './jwt';
import { mapUser } from './mapUser';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return null;
}

/** Exige um usuário autenticado válido; popula req.user. */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Usuário inválido ou inativo' });
    }
    req.user = mapUser(user);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

/** Igual a authenticate, mas não falha se não houver token (usado por rotas
 * chamadas tanto por automações quanto por usuários logados, no padrão
 * `api.auth.me().catch(() => null)`). */
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user?.is_active) req.user = mapUser(user);
  } catch {
    // ignora token inválido nesse modo
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
}

/** Autenticação de webhook (integrações externas: CRM Unasys Flow etc.),
 * via token compartilhado no header x-webhook-token. */
export function requireWebhookToken(expectedToken: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers['x-webhook-token'] || req.headers['authorization'];
    const headerValue = Array.isArray(header) ? header[0] : header;
    const ok =
      !!expectedToken &&
      (headerValue === expectedToken || headerValue === `Bearer ${expectedToken}`);
    if (!ok) {
      return res.status(401).json({ error: 'Unauthorized: forneça x-webhook-token válido' });
    }
    next();
  };
}
