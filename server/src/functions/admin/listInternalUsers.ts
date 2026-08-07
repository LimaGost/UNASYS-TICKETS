import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';

// Campos seguros para expor a qualquer usuário autenticado (nunca
// password_hash/refresh_token_hash). O User não é exposto pelo CRUD
// genérico por esse motivo - esta é a rota dedicada para listagens
// (dropdown de responsável, menções, etc.).
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  full_name: true,
  role: true,
  tipo_perfil: true,
  vertical: true,
  cliente_vertical: true,
  cargo: true,
  can_access_all_verticals: true,
  is_active: true,
  created_date: true,
} as const;

export async function listInternalUsersHandler(_req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({ select: SAFE_USER_SELECT });
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
