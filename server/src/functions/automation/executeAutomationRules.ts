import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { createNotificationCore } from '../notifications/createNotification';
import { sendEmail } from '../../integrations/email';
import { SYSTEM_ACTOR } from '../shared/actor';

export type ExecuteAutomationRulesInput = {
  ticket_id: string;
  event_type: 'created' | 'status_changed' | 'assignment_changed' | 'urgency_changed';
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
};

const TRIGGER_MAP: Record<string, string> = {
  created: 'ticket_created',
  status_changed: 'status_changed',
  assignment_changed: 'assignment_changed',
  urgency_changed: 'urgency_changed',
};

function replaceTokens(text: string, ticket: Record<string, any>): string {
  return text
    .replace(/{ticket_title}/g, ticket.title || '')
    .replace(/{ticket_number}/g, String(ticket.ticket_number ?? ''))
    .replace(/{client_name}/g, ticket.client_name || '')
    .replace(/{urgency}/g, ticket.urgency || '')
    .replace(/{status}/g, ticket.status_column_title || '')
    .replace(/{assigned_to}/g, ticket.assigned_to_name || 'Não atribuído')
    .replace(/{vertical}/g, ticket.vertical || '');
}

async function executeAction(ticket: Record<string, any>, action: { action_type: string; parameters?: any }) {
  const params = action.parameters || {};

  switch (action.action_type) {
    case 'assign_to_user': {
      if (!params.user_email) break;
      const user = await prisma.user.findFirst({ where: { email: params.user_email } });
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { assigned_to: params.user_email, assigned_to_name: user?.full_name || params.user_email },
      });
      await prisma.ticketEvent.create({
        data: {
          ticket_id: ticket.id,
          type: 'assignment',
          description: `Ticket atribuído automaticamente para ${user?.full_name || params.user_email}`,
          new_value: params.user_email,
          user_email: SYSTEM_ACTOR.email,
          user_name: SYSTEM_ACTOR.name,
          visible_to_client: false,
        },
      });
      break;
    }

    case 'change_status': {
      if (!params.status_column_id) break;
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status_column_id: params.status_column_id,
          status_column_title: params.status_column_title,
        },
      });
      await prisma.ticketEvent.create({
        data: {
          ticket_id: ticket.id,
          type: 'status_change',
          description: `Status alterado automaticamente para ${params.status_column_title}`,
          old_value: ticket.status_column_title,
          new_value: params.status_column_title,
          user_email: SYSTEM_ACTOR.email,
          user_name: SYSTEM_ACTOR.name,
          visible_to_client: true,
        },
      });
      break;
    }

    case 'send_email': {
      if (!params.to_emails || !params.subject || !params.message) break;
      const message = replaceTokens(params.message, ticket);
      const subject = replaceTokens(params.subject, ticket);
      const emails = String(params.to_emails).split(',').map((e: string) => e.trim());
      for (const email of emails) {
        await sendEmail({ to: email, subject, body: message });
      }
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
          type: 'ticket_created',
          title: 'Regra de Automação',
          message,
          priority: 'normal',
          actor_name: SYSTEM_ACTOR.name,
          actor_email: SYSTEM_ACTOR.email,
        });
      }
      break;
    }

    case 'change_urgency': {
      if (!params.urgency) break;
      await prisma.ticket.update({ where: { id: ticket.id }, data: { urgency: params.urgency } });
      await prisma.ticketEvent.create({
        data: {
          ticket_id: ticket.id,
          type: 'field_change',
          description: `Urgência alterada automaticamente para ${params.urgency}`,
          old_value: ticket.urgency,
          new_value: params.urgency,
          user_email: SYSTEM_ACTOR.email,
          user_name: SYSTEM_ACTOR.name,
          visible_to_client: false,
        },
      });
      break;
    }

    case 'add_comment': {
      if (!params.comment) break;
      const comment = replaceTokens(params.comment, ticket);
      await prisma.ticketEvent.create({
        data: {
          ticket_id: ticket.id,
          type: 'comment_internal',
          description: comment,
          user_email: SYSTEM_ACTOR.email,
          user_name: SYSTEM_ACTOR.name,
          visible_to_client: false,
        },
      });
      break;
    }
  }
}

export async function executeAutomationRulesCore(input: ExecuteAutomationRulesInput) {
  const { ticket_id, event_type, old_data, new_data } = input;
  if (!ticket_id || !event_type) {
    throw new Error('Missing ticket_id or event_type');
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticket_id } });
  if (!ticket) throw new Error('Ticket not found');

  const triggerType = TRIGGER_MAP[event_type];
  const allRules = await prisma.automationRule.findMany({
    where: { vertical: ticket.vertical ?? undefined, active: true, trigger_type: triggerType },
  });

  const executedRules: string[] = [];

  for (const rule of allRules) {
    const conditions = (rule.trigger_conditions as Record<string, any>) || {};
    let matches = true;

    if (conditions.main_type && ticket.main_type !== conditions.main_type) matches = false;
    if (conditions.ticket_type && ticket.ticket_type !== conditions.ticket_type) matches = false;
    if (conditions.urgency && ticket.urgency !== conditions.urgency) matches = false;

    if (event_type === 'status_changed') {
      if (conditions.from_status_id && old_data?.status_column_id !== conditions.from_status_id) matches = false;
      if (conditions.from_status && old_data?.status_column_title !== conditions.from_status) matches = false;
      if (conditions.to_status_id && new_data?.status_column_id !== conditions.to_status_id) matches = false;
      if (conditions.to_status && new_data?.status_column_title !== conditions.to_status) matches = false;
    }

    if (!matches) continue;

    for (const action of (rule.actions as any[]) || []) {
      try {
        await executeAction(ticket, action);
      } catch (err) {
        console.error('Error executing action:', err);
      }
    }

    await prisma.automationRule.update({
      where: { id: rule.id },
      data: { execution_count: rule.execution_count + 1, last_executed_at: new Date() },
    });

    executedRules.push(rule.name);
  }

  return { success: true, executed_rules: executedRules, count: executedRules.length, ticket_vertical: ticket.vertical };
}

export async function executeAutomationRulesHandler(req: Request, res: Response) {
  try {
    const result = await executeAutomationRulesCore(req.body ?? {});
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
}
