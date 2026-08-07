import { prisma } from '../../db/prisma';
import { createNotificationCore } from '../notifications/createNotification';
import { sendClientEmailCore } from '../gmail/sendClientEmail';
import { SYSTEM_ACTOR } from '../shared/actor';
import type { Ticket } from '@prisma/client';

/** Disparado quando um Ticket é editado e o responsável (assigned_to) muda
 * (ex: reatribuição manual via formulário, não pelo fluxo de status). */
export async function notifyAssignmentHook(newTicket: Ticket, oldTicket?: Ticket) {
  if (!oldTicket || newTicket.assigned_to === oldTicket.assigned_to) return;
  if (!newTicket.assigned_to) return;

  await createNotificationCore({
    user_email: newTicket.assigned_to,
    type: 'ticket_assigned',
    title: 'Novo ticket atribuído',
    message: `O ticket "${newTicket.title}" foi atribuído a você`,
    ticket_id: newTicket.id,
    ticket_title: newTicket.title,
    priority: 'high',
  });

  if (newTicket.client_id) {
    const client = await prisma.client.findUnique({ where: { id: newTicket.client_id } });
    if (client?.email) {
      try {
        await sendClientEmailCore(
          {
            ticket_id: newTicket.id,
            subject: `Chamado atribuído: ${newTicket.title}`,
            message: `Seu chamado foi atribuído para ${newTicket.assigned_to_name || 'nossa equipe'}.\n\nEm breve entraremos em contato.`,
          },
          SYSTEM_ACTOR
        );
      } catch (e) {
        console.error('Erro ao notificar cliente sobre atribuição:', e);
      }
    }
  }
}
