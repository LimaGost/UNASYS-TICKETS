import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';

/** Fonte única dos dados usados pela tela de Relatórios (Visão Geral,
 * Discriminado, Detalhado e Horas/Pagamento).
 *
 * Por quê uma função em vez de deixar o frontend buscar Ticket/TimeEntry
 * direto pelo CRUD genérico? A policy de Ticket libera leitura para
 * qualquer analista da MESMA vertical (necessário para o Kanban, onde o
 * time trabalha uma fila compartilhada). Isso significa que, via CRUD
 * genérico, um analista comum consegue enxergar os tickets de TODOS os
 * colegas da vertical dele.
 *
 * Aqui filtramos explicitamente por usuário ANTES de devolver os dados:
 * todo usuário recebe só o que é dele (assigned_to / technician_email =
 * e-mail do próprio usuário), sem exceção de role/cargo. A visão agregada
 * de gestão já existe em separado, no Painel do Diretor. */
export async function getMyReportsDataHandler(req: Request, res: Response) {
  try {
    const userEmail = req.user!.email;

    const timeEntries = await prisma.timeEntry.findMany({ where: { technician_email: userEmail } });
    const ticketIdsFromEntries = [...new Set(timeEntries.map((e) => e.ticket_id).filter(Boolean))];

    const assignedTickets = await prisma.ticket.findMany({ where: { assigned_to: userEmail } });
    const assignedTicketIds = new Set(assignedTickets.map((t) => t.id));

    const missingIds = ticketIdsFromEntries.filter((id) => !assignedTicketIds.has(id));
    const extraTickets = missingIds.length > 0 ? await prisma.ticket.findMany({ where: { id: { in: missingIds } } }) : [];

    const tickets = [...assignedTickets, ...extraTickets];

    return res.json({ tickets, timeEntries, scope: 'own' });
  } catch (err) {
    console.error('Erro em getMyReportsData:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
