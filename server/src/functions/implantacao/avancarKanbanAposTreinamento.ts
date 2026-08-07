import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import type { Actor } from '../shared/actor';

type KanbanColumnDef = { id?: string; title: string; order: number };

/** Avança automaticamente o ticket no Kanban para a próxima coluna quando um
 * módulo de treinamento é concluído (aprovado). */
export async function avancarKanbanAposTreinamentoCore(
  input: { ticket_id: string; modulo_titulo?: string },
  actor: Actor
) {
  const { ticket_id, modulo_titulo } = input;
  if (!ticket_id) throw Object.assign(new Error('ticket_id é obrigatório'), { status: 400 });

  const ticket = await prisma.ticket.findUnique({ where: { id: ticket_id } });
  if (!ticket) throw Object.assign(new Error('Ticket não encontrado'), { status: 404 });

  const kanbanConfig = await prisma.kanbanConfig.findFirst({
    where: { vertical: ticket.vertical ?? undefined, main_type: ticket.main_type },
  });

  const columns = (kanbanConfig?.columns as KanbanColumnDef[]) || [];
  if (columns.length === 0) return { skipped: true, reason: 'Sem configuração de Kanban' };

  const colunas = [...columns].sort((a, b) => a.order - b.order);
  const idxAtual = colunas.findIndex((c) => c.title === ticket.status_column_title);
  if (idxAtual < 0) return { skipped: true, reason: 'Coluna atual não encontrada' };

  const colunaAtual = colunas[idxAtual];
  const isColunaDeTreinamento = modulo_titulo
    ? colunaAtual.title.toLowerCase().includes(modulo_titulo.toLowerCase().split(' ')[0]) ||
      modulo_titulo.toLowerCase().includes(colunaAtual.title.toLowerCase().split(' ')[0])
    : true;

  if (!isColunaDeTreinamento) {
    return { skipped: true, reason: 'Coluna atual não corresponde ao módulo concluído' };
  }

  const proximaColuna = colunas[idxAtual + 1];
  if (!proximaColuna) return { skipped: true, reason: 'Já está na última coluna' };

  await prisma.ticket.update({
    where: { id: ticket_id },
    data: {
      status_column_id: proximaColuna.id || proximaColuna.title,
      status_column_title: proximaColuna.title,
    },
  });

  await prisma.ticketEvent.create({
    data: {
      ticket_id,
      type: 'status_change',
      description: `Kanban avançado automaticamente: treinamento "${modulo_titulo || colunaAtual.title}" concluído`,
      old_value: colunaAtual.title,
      new_value: proximaColuna.title,
      user_email: actor.email,
      user_name: actor.name,
      visible_to_client: true,
    },
  });

  return { success: true, de: colunaAtual.title, para: proximaColuna.title };
}

export async function avancarKanbanAposTreinamentoHandler(req: Request, res: Response) {
  try {
    const actor: Actor = { email: req.user!.email, name: req.user!.full_name || req.user!.email };
    const result = await avancarKanbanAposTreinamentoCore(req.body ?? {}, actor);
    return res.json(result);
  } catch (err) {
    const status = (err as any).status ?? 500;
    return res.status(status).json({ error: (err as Error).message });
  }
}
