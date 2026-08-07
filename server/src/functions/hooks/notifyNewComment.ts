import { prisma } from '../../db/prisma';
import { createNotificationCore } from '../notifications/createNotification';
import type { TicketEvent } from '@prisma/client';

const COMMENT_TYPES = new Set(['comment_internal', 'comment_client', 'new_time_entry']);

/** Disparado quando um TicketEvent de comentário/apontamento é criado -
 * notifica o responsável pelo ticket (se não for o autor). */
export async function notifyNewCommentHook(event: TicketEvent) {
  if (!COMMENT_TYPES.has(event.type)) return;

  const ticket = await prisma.ticket.findUnique({ where: { id: event.ticket_id } });
  if (!ticket?.assigned_to || ticket.assigned_to === event.user_email) return;

  const notifType = event.type === 'new_time_entry' ? 'new_time_entry' : 'new_comment';
  const title = event.type === 'new_time_entry' ? 'Novo apontamento de horas' : 'Novo comentário';

  await createNotificationCore({
    user_email: ticket.assigned_to,
    type: notifType,
    title,
    message: `${event.user_name} adicionou ${event.type === 'new_time_entry' ? 'um apontamento' : 'um comentário'} no ticket: ${ticket.title}`,
    ticket_id: ticket.id,
    ticket_title: ticket.title,
    actor_name: event.user_name,
    actor_email: event.user_email,
    priority: 'normal',
  });
}
