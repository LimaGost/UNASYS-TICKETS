import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';

/** Admin edita o perfil de outro usuário (papel, vertical, cargo, etc). */
export async function updateUserProfileHandler(req: Request, res: Response) {
  try {
    const { userId, role, vertical, can_access_all_verticals, tipo_perfil, cargo } = req.body ?? {};
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const data: Record<string, unknown> = {};
    if (role !== undefined) data.role = role;
    if (vertical !== undefined) data.vertical = vertical;
    if (can_access_all_verticals !== undefined) data.can_access_all_verticals = can_access_all_verticals;
    if (tipo_perfil !== undefined) data.tipo_perfil = tipo_perfil;
    if (cargo !== undefined) data.cargo = cargo;

    await prisma.user.update({ where: { id: userId }, data });

    return res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
