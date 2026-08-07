import { prisma } from '../../db/prisma';
import type { Aviso } from '@prisma/client';

/** Disparado quando um Aviso (mural) é criado - notifica todos os usuários
 * internos (exceto o autor). */
export async function notifyAvisoCreatedHook(aviso: Aviso) {
  const allUsers = await prisma.user.findMany();
  const targets = allUsers.filter((u) => (u.tipo_perfil === 'interno' || u.role === 'admin') && u.email !== aviso.autor_email);

  const autorNome = aviso.autor_nome || 'Sistema';
  const preview = aviso.texto ? aviso.texto.slice(0, 120) + (aviso.texto.length > 120 ? '...' : '') : '';

  await Promise.allSettled(
    targets.map((u) =>
      prisma.notification.create({
        data: {
          user_email: u.email,
          type: 'mentioned',
          title: `📌 Novo aviso de ${autorNome}`,
          message: preview,
          priority: aviso.pinned ? 'high' : 'normal',
          actor_name: autorNome,
          actor_email: aviso.autor_email,
          read: false,
        },
      })
    )
  );
}
