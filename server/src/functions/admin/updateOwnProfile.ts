import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';

/** Autoatualização de perfil (nome, assinatura de e-mail). Nota: um campo
 * `email_signature_fields` (dados estruturados do editor de assinatura) não
 * foi trazido para o schema - o editor de assinatura no frontend guarda só
 * o HTML final em `email_signature`. */
export async function updateOwnProfileHandler(req: Request, res: Response) {
  try {
    const { full_name, email_signature, avatar_url } = req.body ?? {};

    const data: Record<string, unknown> = {};
    if (full_name !== undefined) data.full_name = full_name;
    if (email_signature !== undefined) data.email_signature = email_signature;
    if (avatar_url !== undefined) data.avatar_url = avatar_url;

    let updated = req.user!;
    if (Object.keys(data).length > 0) {
      const user = await prisma.user.update({ where: { id: req.user!.id }, data });
      updated = { ...req.user!, full_name: user.full_name, email_signature: user.email_signature, avatar_url: user.avatar_url };
    }

    return res.json({ success: true, user: updated });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
