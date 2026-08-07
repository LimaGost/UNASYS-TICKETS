import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { gmailFetch, gmailConfigured, encodeBase64UrlUnicode } from '../../integrations/gmail';
import type { Ticket } from '@prisma/client';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Envia a pesquisa de satisfação (CSAT) quando um ticket entra numa coluna
 * final do Kanban. Chamada diretamente por updateTicketStatusCore (não é
 * mais uma "automação" reagindo a evento - vira uma chamada direta no
 * ponto exato em que sabemos que a coluna é final). */
export async function sendCsatEmailCore(ticket: Ticket) {
  if (!gmailConfigured()) {
    console.warn(`[csat] Gmail não configurado - CSAT não enviado para o ticket ${ticket.id}`);
    return { success: false, reason: 'gmail_not_configured' };
  }

  let clientEmail = ticket.client_email;
  const clientName = ticket.client_name || 'Cliente';

  const isFakeEmail =
    !clientEmail || !EMAIL_REGEX.test(clientEmail) || clientEmail.includes('no-reply');

  if (isFakeEmail) {
    if (ticket.client_id) {
      const client = await prisma.client.findUnique({ where: { id: ticket.client_id } });
      if (client?.email && EMAIL_REGEX.test(client.email) && !client.email.includes('no-reply')) {
        clientEmail = client.email;
      } else {
        return { success: true, message: 'No valid email found' };
      }
    } else {
      return { success: true, message: 'No client_id' };
    }
  }

  const ticketRef = `#${ticket.id.slice(0, 8)}`;
  const subject = `[SuporTI] Como foi o nosso atendimento? – Chamado ${ticketRef}`;
  const ratingUrl = (score: number) => `${env.appPublicUrl}/csat?ticket=${ticket.id}&score=${score}`;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #f4f4f7;">
      <div style="background: linear-gradient(135deg, #8B5CF6, #6D28D9); padding: 32px 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Unasys Tickets</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Pesquisa de Satisfação</p>
      </div>
      <div style="background: white; padding: 36px 30px; text-align: center;">
        <p style="color: #374151; font-size: 17px; margin-top: 0;">Olá, <strong>${clientName}</strong>!</p>
        <p style="color: #6b7280; font-size: 15px; line-height: 1.6;">
          O chamado <strong>${ticketRef}</strong> – <em>${ticket.title}</em> foi concluído.<br>
          Sua opinião é muito importante para continuarmos melhorando.
        </p>
        <p style="color: #374151; font-size: 16px; font-weight: 600; margin: 28px 0 8px;">Como você avalia o nosso atendimento?</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 28px;">
          <tr>
            <td style="padding: 0 8px; text-align: center;">
              <a href="${ratingUrl(1)}" style="display:inline-block; text-decoration:none;">
                <div style="background:#fef2f2; border:2px solid #fca5a5; border-radius:12px; padding:16px 20px;">
                  <span style="font-size:36px;">😞</span>
                  <p style="color:#ef4444; font-size:12px; font-weight:600; margin:6px 0 0;">Ruim</p>
                </div>
              </a>
            </td>
            <td style="padding: 0 8px; text-align: center;">
              <a href="${ratingUrl(2)}" style="display:inline-block; text-decoration:none;">
                <div style="background:#fffbeb; border:2px solid #fcd34d; border-radius:12px; padding:16px 20px;">
                  <span style="font-size:36px;">😐</span>
                  <p style="color:#f59e0b; font-size:12px; font-weight:600; margin:6px 0 0;">Regular</p>
                </div>
              </a>
            </td>
            <td style="padding: 0 8px; text-align: center;">
              <a href="${ratingUrl(3)}" style="display:inline-block; text-decoration:none;">
                <div style="background:#f0fdf4; border:2px solid #86efac; border-radius:12px; padding:16px 20px;">
                  <span style="font-size:36px;">😊</span>
                  <p style="color:#22c55e; font-size:12px; font-weight:600; margin:6px 0 0;">Bom</p>
                </div>
              </a>
            </td>
            <td style="padding: 0 8px; text-align: center;">
              <a href="${ratingUrl(4)}" style="display:inline-block; text-decoration:none;">
                <div style="background:#f5f3ff; border:2px solid #c4b5fd; border-radius:12px; padding:16px 20px;">
                  <span style="font-size:36px;">🤩</span>
                  <p style="color:#8B5CF6; font-size:12px; font-weight:600; margin:6px 0 0;">Ótimo</p>
                </div>
              </a>
            </td>
          </tr>
        </table>
        <table style="width:100%; border-collapse:collapse; text-align:left; margin-top:8px; background:#f9fafb; border-radius:8px;">
          <tr>
            <td style="padding:10px 14px; font-size:13px; color:#6b7280; width:130px;">Chamado</td>
            <td style="padding:10px 14px; font-size:13px; color:#111827; font-weight:500;">${ticket.title}</td>
          </tr>
          ${ticket.assigned_to_name ? `<tr><td style="padding:10px 14px; font-size:13px; color:#6b7280;">Responsável</td><td style="padding:10px 14px; font-size:13px; color:#111827; font-weight:500;">${ticket.assigned_to_name}</td></tr>` : ''}
          <tr>
            <td style="padding:10px 14px; font-size:13px; color:#6b7280;">Status</td>
            <td style="padding:10px 14px; font-size:13px; color:#22c55e; font-weight:600;">${ticket.status_column_title}</td>
          </tr>
        </table>
      </div>
      <div style="background: #111827; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">Mensagem automática do Unasys Tickets. Em caso de dúvidas, entre em contato com nossa equipe.</p>
      </div>
    </div>
  `;

  const messageLines = [`To: ${clientEmail}`, `Subject: ${subject}`, 'MIME-Version: 1.0', 'Content-Type: text/html; charset=utf-8', '', emailHtml];
  const raw = encodeBase64UrlUnicode(messageLines.join('\r\n'));

  const gmailRes = await gmailFetch('/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });

  if (!gmailRes.ok) {
    const err: any = await gmailRes.json().catch(() => ({}));
    console.error('Erro ao enviar CSAT:', JSON.stringify(err));
    return { success: false, error: err.error?.message || 'Falha ao enviar e-mail' };
  }

  const result: any = await gmailRes.json();

  await prisma.ticketEvent.create({
    data: {
      ticket_id: ticket.id,
      type: 'comment_client',
      description: `Pesquisa de satisfação (CSAT) enviada para ${clientEmail}`,
      user_email: 'sistema@automatico',
      user_name: 'Sistema',
      visible_to_client: false,
    },
  });

  return { success: true, sent_to: clientEmail, message_id: result.id };
}
