import { prisma } from '../../db/prisma';
import type { Client } from '@prisma/client';

/** Disparado depois que um Client é criado: garante que existe uma
 * ClienteImplantacao correspondente (hook automático). */
export async function criarClienteImplantacaoAposClientHook(client: Client) {
  if (!client.email) return;

  const existing = await prisma.clienteImplantacao.findFirst({ where: { usuario_email: client.email } });
  if (existing) return;

  const user = await prisma.user.findUnique({ where: { email: client.email } });

  await prisma.clienteImplantacao.create({
    data: {
      usuario_email: client.email,
      usuario_id: user?.id,
      nome_empresa: client.name || client.nome_fantasia,
      status_geral: 'aguardando',
      progresso_percentual: 0,
      vertical: client.vertical,
    },
  });
}
