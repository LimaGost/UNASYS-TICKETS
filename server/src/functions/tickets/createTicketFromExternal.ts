import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { runAfterCreate } from '../../entities/hooks';

export type CreateTicketFromExternalInput = {
  client_identifier: string;
  title: string;
  description?: string;
  client_name?: string;
  client_vertical?: string;
  razao_social?: string;
  cnpj?: string;
  cnae?: string;
  client_email?: string;
  phone?: string;
  urgency?: string;
  ticket_type?: string;
  service_type?: string;
  category?: string;
  requester?: string;
  modulos?: string[] | string;
  observacoes_gerais?: string;
  external_order_number?: string;
  external_customer_code?: string;
  external_reference?: string;
  external_system?: string;
  dynamic_fields?: Record<string, unknown>;
  attachments?: { file_url: string; file_name?: string; file_size?: number }[];
};

/** Endpoint chamado por sistemas externos (CRM) para criar um ticket a
 * partir de um identificador de cliente (e-mail ou ID). Protegido por
 * webhook token (server/src/auth/middleware.ts#requireWebhookToken) -
 * a versão anterior deste endpoint não tinha checagem de auth nenhuma;
 * endurecido aqui de propósito. */
export async function createTicketFromExternalCore(payload: CreateTicketFromExternalInput) {
  if (!payload.client_identifier || !payload.title) {
    const err = new Error('Campos obrigatórios: client_identifier (email ou ID), title');
    throw Object.assign(err, { status: 400 });
  }

  let client = payload.client_identifier.includes('@')
    ? await prisma.client.findFirst({ where: { email: payload.client_identifier } })
    : await prisma.client.findUnique({ where: { id: payload.client_identifier } });

  if (!client) {
    if (payload.client_name && payload.client_vertical) {
      client = await prisma.client.create({
        data: {
          name: payload.client_name,
          nome_fantasia: payload.client_name,
          razao_social: payload.razao_social || payload.client_name,
          cnpj: payload.cnpj || '',
          cnae: payload.cnae || '',
          email: payload.client_identifier.includes('@') ? payload.client_identifier : payload.client_email || '',
          phone: payload.phone || '',
          vertical: payload.client_vertical,
          active: true,
        },
      });
    } else {
      const err = new Error('Cliente não encontrado. Para auto-criar, forneça também client_name e client_vertical.');
      throw Object.assign(err, { status: 404 });
    }
  }

  const urgency = payload.urgency || 'media';
  const slaConfig = await prisma.systemConfig.findUnique({ where: { key: `sla_${urgency}` } });
  const slaHours = slaConfig ? parseInt(slaConfig.value, 10) || 24 : 24;

  const columns = await prisma.kanbanColumn.findMany({ orderBy: { order: 'asc' }, take: 1 });
  const firstCol = columns[0];

  const expectedRes = new Date(Date.now() + slaHours * 3_600_000);

  const modulos = Array.isArray(payload.modulos) ? payload.modulos : payload.modulos ? [payload.modulos] : [];

  const ticket = await prisma.ticket.create({
    data: {
      title: payload.title,
      description: payload.description || '',
      client_id: client.id,
      client_name: client.name || client.nome_fantasia,
      client_email: client.email,
      vertical: client.vertical,
      urgency,
      ticket_type: payload.ticket_type || 'Suporte',
      service_type: payload.service_type || '',
      category: payload.category || '',
      requester: payload.requester || client.contact_person || '',
      status_column_id: firstCol?.id || '',
      status_column_title: firstCol?.title || 'Aberto',
      sla_hours: slaHours,
      expected_resolution: expectedRes,
      total_normal_hours: 0,
      total_extra_hours: 0,
      notified: false,
      sla_breached: false,
      modulos,
      observacoes_gerais: payload.observacoes_gerais || '',
      external_order_number: payload.external_order_number || '',
      external_customer_code: payload.external_customer_code || '',
      external_reference: payload.external_reference || '',
      external_system: payload.external_system || 'UNASYS',
      ...(payload.dynamic_fields || {}),
    },
  });

  await prisma.ticketEvent.create({
    data: {
      ticket_id: ticket.id,
      type: 'creation',
      description: `Ticket criado automaticamente via sistema externo${payload.external_system ? ` (${payload.external_system})` : ''}`,
      user_email: 'system@auto',
      user_name: 'Sistema Automático',
      visible_to_client: false,
      email_sent: false,
    },
  });

  if (Array.isArray(payload.attachments)) {
    for (const att of payload.attachments) {
      if (!att.file_url) continue;
      await prisma.ticketAttachment.create({
        data: {
          ticket_id: ticket.id,
          file_url: att.file_url,
          file_name: att.file_name || 'anexo.pdf',
          file_size: att.file_size || 0,
          uploaded_by_name: 'Sistema Externo',
          uploaded_by_email: 'system@auto',
        },
      });
    }
  }

  // Dispara os mesmos hooks do CRUD genérico (notificar analistas da
  // vertical, etc.) - essa criação não passa pelo controller genérico.
  await runAfterCreate('Ticket', ticket);

  return {
    status: 'success',
    ticket_id: ticket.id,
    ticket_number: ticket.ticket_number,
    message: 'Ticket criado com sucesso',
    data: {
      title: ticket.title,
      status: ticket.status_column_title,
      urgency: ticket.urgency,
      expected_resolution: ticket.expected_resolution,
    },
  };
}

export async function createTicketFromExternalHandler(req: Request, res: Response) {
  try {
    const result = await createTicketFromExternalCore(req.body ?? {});
    return res.status(201).json(result);
  } catch (err) {
    const status = (err as any).status ?? 500;
    return res.status(status).json({ error: (err as Error).message, status: 'error' });
  }
}
