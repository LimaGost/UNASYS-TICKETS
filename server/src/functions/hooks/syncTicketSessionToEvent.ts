import { prisma } from '../../db/prisma';
import type { TicketSession } from '@prisma/client';

/** Disparado quando uma TicketSession (cronômetro do ticket) é encerrada -
 * registra um TicketEvent com o tempo trabalhado, para aparecer na
 * timeline do ticket. */
export async function syncTicketSessionToEventHook(session: TicketSession, oldSession?: TicketSession) {
  if (session.status !== 'ended' || oldSession?.status === 'ended') return;

  const existing = await prisma.ticketEvent.findFirst({
    where: {
      ticket_id: session.ticket_id,
      type: 'time_entry',
      user_email: session.user_email ?? undefined,
      created_date: { gte: session.started_at },
    },
  });
  if (existing) return;

  const durationMinutes = Math.round(session.total_seconds / 60);
  const hours = Math.round((session.total_seconds / 3600) * 100) / 100;

  await prisma.ticketEvent.create({
    data: {
      ticket_id: session.ticket_id,
      type: 'time_entry',
      description: `Registro de tempo: ${hours}h (${durationMinutes} minutos)`,
      user_email: session.user_email,
      user_name: session.user_name,
      visible_to_client: false,
      email_sent: false,
    },
  });
}
