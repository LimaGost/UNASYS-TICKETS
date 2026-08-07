import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';

/** Endpoint consultado pelo CRM Unasys Flow para exibir o status do ticket
 * de implantação. Contrato: recebe identificadores COMPARTILHADOS entre os
 * dois sistemas - numero_op (external_order_number), cnpj_cliente
 * (external_reference) ou numero_cliente (external_customer_code). Nunca
 * IDs internos do outro sistema. Protegido por WEBHOOK_SECRET_TOKEN. */
export async function consultarStatusTicketHandler(req: Request, res: Response) {
  try {
    const { numero_op, cnpj_cliente, numero_cliente } = req.body ?? {};

    if (!numero_op && !cnpj_cliente && !numero_cliente) {
      return res.status(400).json({ error: 'Informe ao menos um identificador: numero_op, cnpj_cliente ou numero_cliente' });
    }

    let ticket = null;
    if (numero_op) {
      ticket = await prisma.ticket.findFirst({ where: { external_order_number: numero_op }, orderBy: { created_date: 'desc' } });
    }
    if (!ticket && cnpj_cliente) {
      ticket = await prisma.ticket.findFirst({ where: { external_reference: cnpj_cliente }, orderBy: { created_date: 'desc' } });
    }
    if (!ticket && numero_cliente) {
      ticket = await prisma.ticket.findFirst({ where: { external_customer_code: numero_cliente }, orderBy: { created_date: 'desc' } });
    }

    if (!ticket) {
      return res.status(404).json({ status: 'nao_encontrado', message: 'Nenhum ticket encontrado para os identificadores informados' });
    }

    const column = (ticket.status_column_title || '').toLowerCase();
    let status = 'EM_PROGRESSO';
    if (ticket.closed_at || column.includes('finaliz') || column.includes('conclu')) {
      status = 'FINALIZADO';
    } else if (column.includes('parado') || column.includes('pausad')) {
      status = 'PARADO';
    } else if (column.includes('novo')) {
      status = 'NOVO';
    }

    return res.json({
      status,
      ticketId: ticket.id,
      kanbanColumn: ticket.status_column_title,
      message: `Ticket na coluna "${ticket.status_column_title}"`,
    });
  } catch (err) {
    console.error('Erro em consultarStatusTicket:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
