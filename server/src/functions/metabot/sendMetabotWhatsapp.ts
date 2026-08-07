import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { metabotHeaders } from '../../integrations/metabot';

/** Envia mensagem WhatsApp via Metabot a partir de um ticket. */
export async function sendMetabotWhatsappHandler(req: Request, res: Response) {
  const { ticket_id, number, message, attendance_id, force_send = false, media_url, media_type } = req.body ?? {};

  if (!message?.trim() && !media_url) {
    return res.status(400).json({ error: 'message ou media_url é obrigatório' });
  }
  if (!attendance_id && !number) {
    return res.status(400).json({ error: 'attendance_id ou number é obrigatório' });
  }

  let headers: Record<string, string>;
  try {
    headers = metabotHeaders();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }

  const cleanNumber = number ? String(number).replace(/\D/g, '') : null;

  let endpoint: string;
  let body: Record<string, unknown>;

  if (media_url) {
    endpoint = 'https://api.metabot.com.br/core/v2/api/chats/send-media';
    body = {
      ...(attendance_id ? { attendanceId: attendance_id } : {}),
      ...(cleanNumber ? { number: cleanNumber } : {}),
      LinkUrl: media_url,
      type: media_type || 'image',
      caption: message || '',
      forceSend: attendance_id ? true : force_send,
    };
  } else {
    endpoint = 'https://api.metabot.com.br/core/v2/api/chats/send-text';
    body = {
      ...(attendance_id ? { attendanceId: attendance_id } : {}),
      ...(cleanNumber ? { number: cleanNumber } : {}),
      text: message,
      message,
      forceSend: attendance_id ? true : force_send,
      isWhisper: false,
      verifyContact: false,
    };
  }

  const metabotResponse = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  const rawText = await metabotResponse.text();
  let metabotData: any;
  try {
    metabotData = JSON.parse(rawText);
  } catch {
    metabotData = { raw: rawText };
  }

  if (!metabotResponse.ok) {
    const errorMsg = metabotData?.message || metabotData?.error || 'Erro desconhecido';
    return res.status(metabotResponse.status).json({
      error: `Falha ao enviar mensagem: ${errorMsg}`,
      status: metabotResponse.status,
      details: metabotData,
    });
  }

  if (ticket_id) {
    const eventDesc = media_url
      ? `WhatsApp enviado: ${media_type || 'mídia'} ${message ? `com legenda: ${message}` : ''}`
      : `WhatsApp enviado: ${message}`;

    await prisma.ticketEvent
      .create({
        data: {
          ticket_id,
          type: 'comment_client',
          description: eventDesc,
          user_email: req.user!.email,
          user_name: req.user!.full_name || req.user!.email,
          visible_to_client: true,
          email_sent: false,
        },
      })
      .catch((e) => console.log('[SEND] Aviso: não registrou TicketEvent:', (e as Error).message));
  }

  return res.json({ success: true, metabot: metabotData });
}
