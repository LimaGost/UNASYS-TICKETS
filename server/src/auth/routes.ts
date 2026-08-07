import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { hashPassword, verifyPassword } from './password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt';
import { mapUser } from './mapUser';
import { authenticate, requireRole } from './middleware';

export const authRouter = Router();

const REFRESH_COOKIE = 'refresh_token';
const isProd = process.env.NODE_ENV === 'production';

function setRefreshCookie(res: import('express').Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const tokenPayload = { sub: user.id, email: user.email };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  setRefreshCookie(res, refreshToken);
  return res.json({ access_token: accessToken, user: mapUser(user) });
});

authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ error: 'Sem refresh token' });

  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Usuário inválido' });
    }
    const tokenPayload = { sub: user.id, email: user.email };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);
    setRefreshCookie(res, refreshToken);
    return res.json({ access_token: accessToken, user: mapUser(user) });
  } catch {
    return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  return res.json({ success: true });
});

authRouter.get('/me', authenticate, (req, res) => {
  return res.json(req.user);
});

// Cadastro de novos usuários é restrito a admins (não há auto-registro
// público, refletindo o comportamento original: contas de analistas e
// clientes eram provisionadas pela equipe interna).
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().optional(),
  role: z.enum(['admin', 'user']).optional(),
  tipo_perfil: z.enum(['interno', 'cliente']).optional(),
  vertical: z.string().optional(),
  cliente_vertical: z.string().optional(),
  cargo: z.enum(['Diretor', 'Analista Senior', 'Analista Interno']).optional(),
  can_access_all_verticals: z.boolean().optional(),
  lojas_vinculadas: z.array(z.string()).optional(),
  cnpj_vinculado: z.string().optional(),
});

authRouter.post('/register', authenticate, requireRole('admin'), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) {
    return res.status(409).json({ error: 'Já existe um usuário com este e-mail' });
  }

  const password_hash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      password_hash,
      full_name: data.full_name,
      role: data.role ?? 'user',
      tipo_perfil: data.tipo_perfil,
      vertical: data.vertical,
      cliente_vertical: data.cliente_vertical,
      cargo: data.cargo,
      can_access_all_verticals: data.can_access_all_verticals ?? false,
      lojas_vinculadas: data.lojas_vinculadas ?? [],
      cnpj_vinculado: data.cnpj_vinculado,
    },
  });

  return res.status(201).json(mapUser(user));
});

authRouter.post('/change-password', authenticate, async (req, res) => {
  const schema = z.object({ current_password: z.string(), new_password: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const valid = await verifyPassword(parsed.data.current_password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });

  const password_hash = await hashPassword(parsed.data.new_password);
  await prisma.user.update({ where: { id: user.id }, data: { password_hash } });
  return res.json({ success: true });
});
