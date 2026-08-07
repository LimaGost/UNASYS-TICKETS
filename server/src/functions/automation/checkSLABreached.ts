import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { createNotificationCore } from '../notifications/createNotification';

const URGENCY_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'CRÍTICA',
};

/** Job agendado: verifica tickets com SLA estourado, marca sla_breached e
 * notifica o responsável + demais analistas da vertical. */
export async function checkSLABreachedCore() {
  const tickets = await prisma.ticket.findMany({
    where: { closed_at: null, expected_resolution: { not: null } },
  });

  const kanbanConfigs = await prisma.kanbanConfig.findMany();
  const pausingColumnIds = new Set<string>();
  for (const config of kanbanConfigs) {
    for (const col of (config.columns as any[]) || []) {
      if (col.pauses_sla || col.is_final) {
        pausingColumnIds.add(`${config.vertical}|${config.ticket_type}|${col.title}`);
      }
    }
  }

  const now = new Date();
  let notified = 0;

  for (const ticket of tickets) {
    const expected = ticket.expected_resolution as Date;
    if (now <= expected) continue;
    if (ticket.sla_breached) continue;

    const colKey = `${ticket.vertical}|${ticket.ticket_type}|${ticket.status_column_title}`;
    if (pausingColumnIds.has(colKey)) continue;

    await prisma.ticket.update({ where: { id: ticket.id }, data: { sla_breached: true } });

    const urgLabel = URGENCY_LABEL[ticket.urgency] || ticket.urgency;
    const msg = `SLA estourado! Ticket "${ticket.title}" | Cliente: ${ticket.client_name || '—'} | Urgência: ${urgLabel} | Previsto para: ${expected.toLocaleString('pt-BR')}`;

    if (ticket.assigned_to) {
      await createNotificationCore({
        user_email: ticket.assigned_to,
        type: 'sla_warning',
        title: '⏰ SLA Estourado!',
        message: msg,
        ticket_id: ticket.id,
        ticket_title: ticket.title,
        priority: 'high',
        actor_name: 'Sistema',
      });
      notified++;
    }

    if (ticket.vertical) {
      const analistas = await prisma.user.findMany({
        where: { tipo_perfil: 'interno', vertical: ticket.vertical, email: { not: ticket.assigned_to ?? undefined } },
      });
      for (const a of analistas) {
        await createNotificationCore({
          user_email: a.email,
          type: 'sla_warning',
          title: '⏰ SLA Estourado!',
          message: msg,
          ticket_id: ticket.id,
          ticket_title: ticket.title,
          priority: 'high',
          actor_name: 'Sistema',
        });
        notified++;
      }
    }
  }

  return { success: true, tickets_checked: tickets.length, notified };
}

export async function checkSLABreachedHandler(_req: Request, res: Response) {
  try {
    const result = await checkSLABreachedCore();
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
