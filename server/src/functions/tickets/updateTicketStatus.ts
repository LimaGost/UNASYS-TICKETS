import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { createNotificationCore } from '../notifications/createNotification';
import { executeAutomationRulesCore } from '../automation/executeAutomationRules';
import { sendEmail } from '../../integrations/email';
import { sendCsatEmailCore } from '../gmail/sendCsatEmail';
import type { Actor } from '../shared/actor';

export type UpdateTicketStatusInput = {
  ticketId: string;
  newStatus: string;
  columnData?: {
    id?: string;
    is_final?: boolean;
    pauses_sla?: boolean;
    sla_hours?: number;
  };
  subStatus?: string | null;
};

const MS_PER_HOUR = 3_600_000;

export async function updateTicketStatusCore(input: UpdateTicketStatusInput, actor: Actor) {
  const { ticketId, newStatus, columnData, subStatus } = input;
  if (!ticketId || !newStatus) {
    throw Object.assign(new Error('Missing ticketId or newStatus'), { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { status: 404 });

  const oldStatus = ticket.status_column_title;
  if (oldStatus === newStatus) {
    return { skipped: true, reason: 'Same status' };
  }

  const isFinal = !!columnData?.is_final;
  const pausesSla = !!columnData?.pauses_sla;
  const rawSlaHours = typeof columnData?.sla_hours === 'number' ? columnData.sla_hours : null;
  // SLA "real" (<= 1 ano). Valores absurdos (ex: 100000000) = SLA desativado na coluna.
  const colSlaHours = rawSlaHours && rawSlaHours > 0 && rawSlaHours <= 8760 ? rawSlaHours : null;
  const slaDisabledOnColumn = !!(rawSlaHours && rawSlaHours > 8760);

  const updateData: Record<string, unknown> = {
    status_column_title: newStatus,
    sub_status: subStatus ?? null,
    ...(columnData?.id ? { status_column_id: columnData.id } : {}),
    ...(isFinal
      ? { closed_at: new Date(), sla_paused_at: null, sla_breached: false }
      : { closed_at: null }),
  };

  // ── SLA ── Atualiza a previsão conforme o SLA da coluna de destino
  if (isFinal) {
    // Coluna final: SLA encerrado (já tratado acima)
  } else if (pausesSla) {
    if (!ticket.sla_paused_at) updateData.sla_paused_at = new Date();
  } else {
    const wasPaused = !!ticket.sla_paused_at;
    if (wasPaused) updateData.sla_paused_at = null;
    const pausedMs = wasPaused ? Date.now() - new Date(ticket.sla_paused_at as Date).getTime() : 0;

    if (slaDisabledOnColumn) {
      updateData.expected_resolution = null;
    } else if (colSlaHours) {
      updateData.expected_resolution = new Date(Date.now() + colSlaHours * MS_PER_HOUR);
      updateData.sla_hours = colSlaHours;
      updateData.sla_breached = false;
    } else if (wasPaused && ticket.expected_resolution && pausedMs > 0) {
      updateData.expected_resolution = new Date(ticket.expected_resolution.getTime() + pausedMs);
    } else if (!ticket.expected_resolution) {
      const fallback =
        typeof ticket.sla_hours === 'number' && ticket.sla_hours > 0 && ticket.sla_hours <= 8760
          ? ticket.sla_hours
          : 24;
      updateData.expected_resolution = new Date(Date.now() + fallback * MS_PER_HOUR);
      updateData.sla_hours = fallback;
      updateData.sla_breached = false;
    }
  }

  const updatedTicket = await prisma.ticket.update({ where: { id: ticketId }, data: updateData });

  if (isFinal) {
    try {
      await sendCsatEmailCore(updatedTicket);
    } catch (e) {
      console.error('Erro ao enviar CSAT:', e);
    }
  }

  await prisma.ticketEvent.create({
    data: {
      ticket_id: ticketId,
      type: 'status_change',
      description: `Status alterado de "${oldStatus}" para "${newStatus}"${subStatus ? ` (${subStatus})` : ''}`,
      old_value: oldStatus,
      new_value: newStatus,
      user_email: actor.email,
      user_name: actor.name,
      visible_to_client: true,
      email_sent: false,
    },
  });

  if (ticket.assigned_to && ticket.assigned_to !== actor.email) {
    await createNotificationCore({
      user_email: ticket.assigned_to,
      type: 'status_changed',
      title: `Status alterado: ${ticket.title}`,
      message: `Status mudou de "${oldStatus}" para "${newStatus}"`,
      ticket_id: ticketId,
      ticket_title: ticket.title,
      actor_name: actor.name,
      actor_email: actor.email,
      priority: 'normal',
    });
  }

  if (newStatus.toLowerCase().includes('aguardando') || newStatus.toLowerCase().includes('pausado')) {
    try {
      await sendEmail({
        to: ticket.client_email ?? '',
        subject: `Ticket #${ticket.id.slice(0, 8)} - Aguardando Retorno`,
        body: `<h2>Olá ${ticket.client_name},</h2><p>O ticket <strong>#${ticket.id.slice(0, 8)}</strong> - "${ticket.title}" está aguardando seu retorno.</p><p><strong>Status:</strong> ${newStatus}</p>`,
      });
    } catch (e) {
      console.error('Email send error:', e);
    }
  }

  try {
    await executeAutomationRulesCore({
      ticket_id: ticketId,
      event_type: 'status_changed',
      old_data: { status_column_title: oldStatus },
      new_data: { status_column_title: newStatus },
    });
  } catch (e) {
    console.error('Automation error:', e);
  }

  // Push de status para o CRM (Unasys Flow) — apenas tickets vindos da integração comercial
  if ((ticket.external_order_number || ticket.external_reference) && env.flowSyncUrl) {
    try {
      const col = newStatus.toLowerCase();
      const statusTicket = columnData?.is_final || col.includes('finaliz') || col.includes('conclu')
        ? 'FINALIZADO'
        : col.includes('parado') || col.includes('pausad')
          ? 'PARADO'
          : col.includes('novo')
            ? 'NOVO'
            : 'EM_PROGRESSO';

      const flowRes = await fetch(env.flowSyncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-token': env.webhookSecretToken,
        },
        body: JSON.stringify({
          numero_op: ticket.external_order_number || null,
          cnpj_cliente: ticket.external_reference || null,
          numero_cliente: ticket.external_customer_code || null,
          status_ticket: statusTicket,
          ticketId,
        }),
      });
      console.log('Sync Unasys Flow:', flowRes.status, statusTicket);
    } catch (e) {
      // Falha no sync não pode bloquear a mudança de status
      console.error('Erro ao sincronizar status com Unasys Flow:', e);
    }
  }

  return { success: true, oldStatus, newStatus };
}

export async function updateTicketStatusHandler(req: Request, res: Response) {
  try {
    const actor = { email: req.user!.email, name: req.user!.full_name || req.user!.email };
    const result = await updateTicketStatusCore(req.body ?? {}, actor);
    return res.json(result);
  } catch (err) {
    const status = (err as any).status ?? 500;
    return res.status(status).json({ error: (err as Error).message });
  }
}
