import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';

/** Recalcula total_normal_hours / total_extra_hours do Ticket a partir dos
 * apontamentos (TimeEntry). REGRA ÚNICA: TODAS as horas registradas contam,
 * inclusive as do tipo "interna" — mesma regra usada na página do ticket e
 * nos relatórios, para nunca haver divergência.
 * Chamada automaticamente (hook) sempre que um TimeEntry é criado/editado/apagado. */
export async function recomputeTicketHoursCore(ticketId: string) {
  if (!ticketId) throw Object.assign(new Error('ticket_id não encontrado'), { status: 400 });

  const entries = await prisma.timeEntry.findMany({
    where: { ticket_id: ticketId },
    orderBy: { created_date: 'desc' },
    take: 1000,
  });

  const totalN = Math.round(entries.reduce((s, e) => s + (e.normal_hours || 0), 0) * 100) / 100;
  const totalE = Math.round(entries.reduce((s, e) => s + (e.extra_hours || 0), 0) * 100) / 100;

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { total_normal_hours: totalN, total_extra_hours: totalE },
  });

  return { ticket_id: ticketId, total_normal_hours: totalN, total_extra_hours: totalE };
}

export async function recomputeTicketHoursHandler(req: Request, res: Response) {
  try {
    const ticketId = req.body?.ticket_id;
    const result = await recomputeTicketHoursCore(ticketId);
    return res.json(result);
  } catch (err) {
    const status = (err as any).status ?? 500;
    return res.status(status).json({ error: (err as Error).message });
  }
}
