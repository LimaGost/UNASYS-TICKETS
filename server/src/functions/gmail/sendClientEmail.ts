import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { gmailFetch, encodeHeader, encodeBase64UrlUnicode } from '../../integrations/gmail';
import { createNotificationCore } from '../notifications/createNotification';
import type { Actor } from '../shared/actor';

export type SendClientEmailInput = {
  ticket_id: string;
  subject: string;
  message: string;
  attachments?: unknown[];
};

/** Envia uma atualização formatada ao cliente do ticket (usado pelo botão
 * "Enviar e-mail ao cliente" da tela de ticket). */
export async function sendClientEmailCore(input: SendClientEmailInput, actor: Actor) {
  const { ticket_id, subject, message } = input;
  if (!ticket_id || !subject || !message) {
    throw Object.assign(new Error('Campos obrigatórios: ticket_id, subject, message'), { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticket_id } });
  if (!ticket) throw Object.assign(new Error('Ticket não encontrado'), { status: 404 });

  const client = ticket.client_id ? await prisma.client.findUnique({ where: { id: ticket.client_id } }) : null;
  const clientEmail = client?.email || ticket.client_email;
  if (!clientEmail) throw Object.assign(new Error('Cliente sem email cadastrado'), { status: 400 });

  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #8B5CF6, #6D28D9); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">Unasys Tickets</h1>
        <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Atualização do Chamado #${ticket_id.substring(0, 8)}</p>
      </div>
      <div style="background: #f9fafb; padding: 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">${subject}</h2>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8B5CF6;">
          ${message.replace(/\n/g, '<br>')}
        </div>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px; margin: 5px 0;"><strong>Título do Chamado:</strong> ${ticket.title}</p>
          <p style="color: #6b7280; font-size: 14px; margin: 5px 0;"><strong>Status:</strong> ${ticket.status_column_title || 'N/A'}</p>
          <p style="color: #6b7280; font-size: 14px; margin: 5px 0;"><strong>Responsável:</strong> ${ticket.assigned_to_name || 'Não atribuído'}</p>
        </div>
      </div>
      <div style="background: #111827; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">Esta é uma mensagem automática do Unasys Tickets.<br>Não responda este email.</p>
      </div>
    </div>
  `;

  const senderEmail = env.gmail.senderEmail;
  const email = [
    `From: Unasys Tickets <${senderEmail}>`,
    `Reply-To: ${senderEmail}`,
    `To: ${clientEmail}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    emailBody,
  ].join('\r\n');

  const encodedEmail = encodeBase64UrlUnicode(email);

  const response = await gmailFetch('/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encodedEmail }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Gmail API error: ${JSON.stringify(error)}`);
  }
  const result: any = await response.json();

  await prisma.ticketEvent.create({
    data: {
      ticket_id,
      type: 'comment_client',
      description: `Email enviado para ${clientEmail}`,
      user_email: actor.email,
      user_name: actor.name,
      visible_to_client: true,
      email_sent: true,
    },
  });

  if (ticket.assigned_to && ticket.assigned_to !== actor.email) {
    await createNotificationCore({
      user_email: ticket.assigned_to,
      type: 'new_comment',
      title: 'Email enviado ao cliente',
      message: `${actor.name} enviou um email para o cliente sobre o ticket: ${ticket.title}`,
      ticket_id: ticket.id,
      ticket_title: ticket.title,
      actor_name: actor.name,
      actor_email: actor.email,
    });
  }

  return { success: true, message_id: result.id, sent_to: clientEmail };
}

export async function sendClientEmailHandler(req: Request, res: Response) {
  try {
    const actor: Actor = { email: req.user!.email, name: req.user!.full_name || req.user!.email };
    const result = await sendClientEmailCore(req.body ?? {}, actor);
    return res.json(result);
  } catch (err) {
    const status = (err as any).status ?? 500;
    return res.status(status).json({ error: (err as Error).message, status: 'error' });
  }
}
