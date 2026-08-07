import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { createNotificationCore } from '../notifications/createNotification';
import { sendEmail } from '../../integrations/email';

function replaceTokens(text: string, ticket: Record<string, any>): string {
  return text
    .replace(/{ticket_title}/g, ticket.title || '')
    .replace(/{client_name}/g, ticket.client_name || '')
    .replace(/{urgency}/g, ticket.urgency || '')
    .replace(/{status}/g, ticket.status_column_title || '')
    .replace(/{assigned_to}/g, ticket.assigned_to_name || 'Não atribuído');
}

async function executeRuleActions(ticket: Record<string, any>, rule: { id: string; actions: any; execution_count: number }) {
  for (const action of (rule.actions as any[]) || []) {
    const params = action.parameters || {};

    switch (action.action_type) {
      case 'assign_to_user': {
        if (!params.user_email) break;
        const user = await prisma.user.findFirst({ where: { email: params.user_email } });
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { assigned_to: params.user_email, assigned_to_name: user?.full_name || params.user_email },
        });
        break;
      }
      case 'send_email': {
        if (!params.to_emails || !params.subject || !params.message) break;
        const message = replaceTokens(params.message, ticket);
        const subject = replaceTokens(params.subject, ticket);
        const emails = String(params.to_emails).split(',').map((e: string) => e.trim());
        for (const email of emails) await sendEmail({ to: email, subject, body: message });
        break;
      }
      case 'send_notification': {
        if (!params.to_emails || !params.message) break;
        const message = replaceTokens(params.message, ticket);
        const emails = String(params.to_emails).split(',').map((e: string) => e.trim());
        for (const email of emails) {
          await createNotificationCore({
            user_email: email,
            ticket_id: ticket.id,
            ticket_title: ticket.title,
            type: 'sla_warning',
            title: 'Alerta de SLA',
            message,
            priority: 'high',
            actor_name: 'Sistema de Automação',
            actor_email: 'system@automation',
          });
        }
        break;
      }
      case 'change_urgency': {
        if (!params.urgency) break;
        await prisma.ticket.update({ where: { id: ticket.id }, data: { urgency: params.urgency } });
        break;
      }
    }
  }

  await prisma.automationRule.update({
    where: { id: rule.id },
    data: { execution_count: rule.execution_count + 1, last_executed_at: new Date() },
  });
}

/** Job agendado: dispara regras de aviso de SLA (sla_warning) e de ausência
 * de resposta (no_response_timeout). Chamado pelo cron (jobs/cron.ts) e
 * também disponível como rota manual para admins. */
export async function checkSLAAndAutomationCore() {
  const tickets = await prisma.ticket.findMany({ where: { closed_at: null } });

  const kanbanConfigs = await prisma.kanbanConfig.findMany();
  const pausingColumnIds = new Set<string>();
  for (const config of kanbanConfigs) {
    for (const col of (config.columns as any[]) || []) {
      if (col.pauses_sla || col.is_final) {
        pausingColumnIds.add(`${config.vertical}|${config.ticket_type}|${col.title}`);
      }
    }
  }

  const slaRules = await prisma.automationRule.findMany({
    where: { active: true, trigger_type: 'sla_warning' },
  });
  const noResponseRules = await prisma.automationRule.findMany({
    where: { active: true, trigger_type: 'no_response_timeout' },
  });

  let slaTriggered = 0;
  let timeoutTriggered = 0;

  for (const ticket of tickets) {
    const colKey = `${ticket.vertical}|${ticket.ticket_type}|${ticket.status_column_title}`;
    if (pausingColumnIds.has(colKey)) continue;

    if (ticket.expected_resolution && ticket.sla_hours) {
      const now = Date.now();
      const totalSLA = ticket.sla_hours * 60 * 60 * 1000;
      const timeElapsed = now - ticket.created_date.getTime();
      const percentage = (timeElapsed / totalSLA) * 100;

      for (const rule of slaRules) {
        const threshold = (rule.trigger_conditions as any)?.sla_percentage || 80;
        if (percentage >= threshold && percentage < threshold + 5) {
          await executeRuleActions(ticket, rule);
          slaTriggered++;
        }
      }
    }

    const events = await prisma.ticketEvent.findMany({
      where: { ticket_id: ticket.id },
      orderBy: { created_date: 'desc' },
      take: 1,
    });
    if (events.length > 0) {
      const hoursSinceLastEvent = (Date.now() - events[0].created_date.getTime()) / (1000 * 60 * 60);
      for (const rule of noResponseRules) {
        const threshold = (rule.trigger_conditions as any)?.hours_threshold || 4;
        if (hoursSinceLastEvent >= threshold && hoursSinceLastEvent < threshold + 0.5) {
          await executeRuleActions(ticket, rule);
          timeoutTriggered++;
        }
      }
    }
  }

  return { success: true, tickets_checked: tickets.length, sla_warnings: slaTriggered, timeout_warnings: timeoutTriggered };
}

export async function checkSLAAndAutomationHandler(_req: Request, res: Response) {
  try {
    const result = await checkSLAAndAutomationCore();
    return res.json(result);
  } catch (err) {
    console.error('SLA Check error:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
