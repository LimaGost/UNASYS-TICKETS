import { prisma } from '../../db/prisma';
import type { Ticket } from '@prisma/client';

/** Disparado depois que um Ticket é criado: garante que existe um Client
 * correspondente ao e-mail do solicitante (hook automático). */
export async function criarClienteAoNovoTicketHook(ticket: Ticket) {
  if (!ticket.client_email || !ticket.client_name || !ticket.vertical) return;

  const existing = await prisma.client.findFirst({ where: { email: ticket.client_email } });
  if (existing) return;

  await prisma.client.create({
    data: {
      name: ticket.client_name,
      nome_fantasia: ticket.client_name,
      email: ticket.client_email,
      vertical: ticket.vertical,
      contact_person: ticket.requester || '',
      phone: '',
      active: true,
    },
  });
}
