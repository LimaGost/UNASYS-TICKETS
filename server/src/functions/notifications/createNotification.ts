import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';

export type CreateNotificationInput = {
  user_email: string;
  type: string;
  title: string;
  message: string;
  ticket_id?: string | null;
  ticket_title?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  priority?: string;
};

const TYPE_CONFIG_FIELD: Record<string, keyof PrismaNotificationConfig | null> = {
  ticket_assigned: 'notify_on_assignment',
  status_changed: 'notify_on_status_change',
  new_comment: 'notify_on_comments',
  new_time_entry: 'notify_on_comments',
  mentioned: 'notify_on_mention',
  sla_warning: 'notify_on_sla_warning',
  ticket_created: null, // sempre habilitado, sem config específica
};

type PrismaNotificationConfig = {
  notify_on_assignment: boolean;
  notify_on_status_change: boolean;
  notify_on_comments: boolean;
  notify_on_mention: boolean;
  notify_on_sla_warning: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

function isInQuietHours(config: PrismaNotificationConfig): boolean {
  if (!config.quiet_hours_enabled) return false;
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const start = config.quiet_hours_start || '22:00';
  const end = config.quiet_hours_end || '08:00';
  return start < end ? currentTime >= start && currentTime < end : currentTime >= start || currentTime < end;
}

export type CreateNotificationResult =
  | { status: 'success'; notification_id: string }
  | { status: 'skipped'; message: string }
  | { status: 'suppressed'; message: string };

/** Cria uma notificação respeitando as preferências do usuário (tipo
 * habilitado, horário silencioso). Chamada diretamente por outras funções
 * do backend (sem round-trip HTTP) e também exposta como rota para o
 * frontend/automação invocarem via functions.invoke. */
export async function createNotificationCore(
  input: CreateNotificationInput
): Promise<CreateNotificationResult> {
  const { user_email, type, title, message } = input;
  if (!user_email || !type || !title || !message) {
    throw new Error('Campos obrigatórios: user_email, type, title, message');
  }

  const config = await prisma.notificationConfig.findUnique({ where: { user_email } });

  const configField = TYPE_CONFIG_FIELD[type];
  const enabled = configField ? (config ? config[configField] : true) : true;
  if (!enabled) {
    return { status: 'skipped', message: 'Notification disabled by user preferences' };
  }

  if (config && isInQuietHours(config)) {
    return { status: 'suppressed', message: 'Notification suppressed due to quiet hours' };
  }

  const notification = await prisma.notification.create({
    data: {
      user_email,
      ticket_id: input.ticket_id ?? null,
      ticket_title: input.ticket_title ?? null,
      type,
      title,
      message,
      priority: input.priority ?? 'normal',
      actor_name: input.actor_name ?? null,
      actor_email: input.actor_email ?? null,
      read: false,
    },
  });

  return { status: 'success', notification_id: notification.id };
}

export async function createNotificationHandler(req: Request, res: Response) {
  try {
    const result = await createNotificationCore(req.body ?? {});
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message, status: 'error' });
  }
}
